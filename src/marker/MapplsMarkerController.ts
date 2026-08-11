import {
  AbstractMarkerController,
  createDefaultIcon,
  createRasterLayerState,
  fingerPrintEquals,
  LocalTileServer,
  MARKER_HIT_RADIUS_MOUSE_PX,
  MARKER_HIT_RADIUS_TOUCH_PX,
  MarkerTileRenderer,
  MarkerTilingOptions,
  RasterLayerSource,
  Settings,
  type GeoPoint,
  type MarkerEntity,
  type MarkerFingerPrint,
  type MarkerState,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import { MapplsMapViewHolder } from '../MapplsMapViewHolder';
import { ZoomAltitudeConverter } from '../zoom/ZoomAltitudeConverter';
import { MapplsMarkerOverlayRenderer } from './MapplsMarkerOverlayRenderer';
import {
  type MapplsActualMarker,
} from './MarkerLayer';

const MAPCONDUCTOR_TILE_PROTOCOL = 'mc-local-tile';

const EMPTY_TILE = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 11, 73, 68, 65, 84, 8, 215, 99, 96, 0, 2, 0, 0, 5, 0, 1, 226, 38, 5, 155,
  0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

let mapLibreTileProtocolRegistered = false;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function parseLocalTileUrl(urlString: string): { routeId: string; x: number; y: number; z: number } | null {
  const url = new URL(urlString);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 4 && parts.length !== 5) return null;

  const offset = parts.length === 5 ? 1 : 0;
  const z = Number(parts[1 + offset]);
  const x = Number(parts[2 + offset]);
  const y = Number(parts[3 + offset].replace(/\.png$/, ''));
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

  return { routeId: url.hostname, x, y, z };
}

function registerMapplsTileProtocol(): void {
  if (mapLibreTileProtocolRegistered) return;

  // The marker-tiling custom protocol must be registered on the SAME MapLibre GL
  // module that Mappls renders with (map.Renderer), not the npm `maplibre-gl`
  // package — protocol handlers live in a module-level registry. Mappls exposes
  // its bundled MapLibre as `window.maplibregl`, so resolve addProtocol from there.
  const protocolApi = (typeof window !== 'undefined'
    ? (window as unknown as { maplibregl?: unknown }).maplibregl
    : undefined) as
    | {
        addProtocol?: (
          customProtocol: string,
          loadFn: (params: { url: string }) => Promise<{ data: ArrayBuffer }>,
        ) => void;
      }
    | undefined;
  if (!protocolApi?.addProtocol) return;

  protocolApi.addProtocol(MAPCONDUCTOR_TILE_PROTOCOL, async (params) => {
    const parsed = parseLocalTileUrl(params.url);
    if (!parsed) return { data: toArrayBuffer(EMPTY_TILE) };

    const result = await LocalTileServer.startServer().handleFetch(parsed.routeId, {
      x: parsed.x,
      y: parsed.y,
      z: parsed.z,
    });
    return { data: toArrayBuffer(result ?? EMPTY_TILE) };
  });

  mapLibreTileProtocolRegistered = true;
}

function localTileUrlTemplate({
  routeId,
  tileSize,
  cacheKey,
}: {
  routeId: string;
  tileSize: number;
  cacheKey?: string;
}): string {
  const base = `${MAPCONDUCTOR_TILE_PROTOCOL}://${routeId}/${tileSize}`;
  if (cacheKey) {
    return `${base}/${cacheKey}/{z}/{x}/{y}.png`;
  }
  return `${base}/{z}/{x}/{y}.png`;
}

export class MapplsMarkerController extends AbstractMarkerController<MapplsActualMarker> {
  declare readonly renderer: MapplsMarkerOverlayRenderer;

  private selected: MarkerEntity<MapplsActualMarker> | null = null;
  private pendingSelectedPosition: GeoPoint | null = null;
  private selectedPositionFrame: number | null = null;

  // ── Tile rendering ────────────────────────────────────────────────────────
  private readonly tilingOptions: MarkerTilingOptions;
  private tileRenderer: MarkerTileRenderer<MarkerState> | null = null;
  private tileRouteId: string | null = null;
  private tileVersion = 0;
  // Bumped on every syncTiledOverlay()/removeTileOverlay() call. syncTiledOverlay
  // awaits SW round-trips, so a later call (or clear()/destroy()) can finish first;
  // an earlier call resuming afterward must not clobber the newer result.
  private tileGeneration = 0;

  /** Called by MapplsViewController when RasterLayerState changes. */
  onRasterLayerUpdate: ((state: RasterLayerState | null) => Promise<void>) | null = null;

  constructor(
    private readonly holder: MapplsMapViewHolder,
    renderer: MapplsMarkerOverlayRenderer,
    tilingOptions: MarkerTilingOptions = MarkerTilingOptions.Default,
  ) {
    super({ markerManager: renderer.markerManager, renderer });
    this.tilingOptions = tilingOptions;
  }

  // ── shouldTile ────────────────────────────────────────────────────────────

  protected override shouldTile(state: MarkerState, totalCount: number): boolean {
    return (
      this.tilingOptions.enabled &&
      totalCount >= this.tilingOptions.minMarkerCount &&
      !state.draggable &&
      state.getAnimation() == null
    );
  }

  // ── onTiledMarkersChanged ─────────────────────────────────────────────────

  protected override async onTiledMarkersChanged(): Promise<void> {
    await this.syncTiledOverlay();
  }

  private async syncTiledOverlay(): Promise<void> {
    const generation = ++this.tileGeneration;

    const tiledStates = this.markerManager
      .allEntities()
      .filter(e => e.tiling)
      .map((e) => e.state);

    if (tiledStates.length === 0) {
      await this.removeTileOverlay();
      return;
    }

    if (!this.tileRouteId) {
      this.tileRouteId = `mc-tile-${generateId()}`;
    }

    const server = LocalTileServer.startServer();

    const { iconScaleCallback } = this.tilingOptions;
    // Mappls は GL マップの zoom が MapConductor zoom から 1 ずれる（Mappls zoom =
    // MapConductor zoom - 1）。タイルの z は GL(MapLibre) zoom なので、そのまま
    // iconScaleCallback に渡すと他プロバイダより 1 レベル低い zoom で評価され、ズームに応じた
    // アイコンスケールが噛み合わない。タイル z を MapConductor(Google 相当)zoom に戻してから
    // callback を呼び、他プロバイダと同じ実効 zoom でスケーリングする。
    const scaledCallback = iconScaleCallback
      ? (item: MarkerState, tileZoom: number) =>
          iconScaleCallback(item, ZoomAltitudeConverter.maplibreZoomToGoogleZoom(tileZoom))
      : undefined;
    const tileRenderer = new MarkerTileRenderer<MarkerState>(tiledStates, 256, scaledCallback);
    this.tileRenderer = tileRenderer;
    this.tileVersion++;
    server.register(this.tileRouteId, tileRenderer);

    const template = LocalTileServer.isServiceWorkerSupported()
      ? await this.serviceWorkerTileTemplate(server, tileRenderer)
      : this.localTileTemplate();

    // A newer sync (or clear()/destroy(), which unregisters our route and
    // bumps the generation) already ran while we were awaiting the SW
    // round-trip. Applying our (stale) result now would either resurrect a
    // removed overlay or overwrite a newer one — bail out.
    if (generation !== this.tileGeneration) return;

    const rasterState = createRasterLayerState({
      id: 'mc-marker-tiles',
      source: RasterLayerSource.UrlTemplate({
        template,
        tileSize: 256,
      }),
    });
    await this.onRasterLayerUpdate?.(rasterState);
  }

  private async serviceWorkerTileTemplate(
    server: LocalTileServer,
    tileRenderer: MarkerTileRenderer<MarkerState>,
  ): Promise<string> {
    server.startServiceWorker('/tile-sw.js');
    await server.waitForController();
    await server.sendSWRegisterAndWait(this.tileRouteId!, await tileRenderer.toSWData());
    return server.urlTemplate({
      routeId: this.tileRouteId!,
      tileSize: 256,
      cacheKey: String(this.tileVersion),
    });
  }

  private localTileTemplate(): string {
    registerMapplsTileProtocol();
    return localTileUrlTemplate({
      routeId: this.tileRouteId!,
      tileSize: 256,
      cacheKey: String(this.tileVersion),
    });
  }

  private async removeTileOverlay(): Promise<void> {
    this.tileGeneration++;
    if (!this.tileRouteId) return;
    LocalTileServer.startServer().unregister(this.tileRouteId);
    this.tileRenderer = null;
    this.tileRouteId = null;
    await this.onRasterLayerUpdate?.(null);
  }

  // ── composition ───────────────────────────────────────────────────────────

  async composition(data: MarkerState[]): Promise<void> {
    const selected = this.selected;
    if (!selected) {
      await this.add(data);
      return;
    }

    const selectedState = data.find((state) => state.id === selected.state.id);
    if (selectedState) {
      const dragPosition = selected.state.position;
      selectedState.position = dragPosition;
      await this.renderer.updateSelectedMarker({
        entity: selected,
        state: selectedState,
        bitmapIcon: selectedState.icon?.toBitmapIcon() ?? createDefaultIcon().toBitmapIcon(),
      });
    } else {
      await this.setSelectedMarker(null);
      await this.add(data);
      return;
    }

    const nonSelected = data.filter((state) => state.id !== selected.state.id);
    if (this.hasCompositionChanges(nonSelected)) {
      await this.add(nonSelected);
    }
  }

  // ── find / findWithZoom ───────────────────────────────────────────────────

  override find(position: GeoPoint): MarkerEntity<MapplsActualMarker> | null {
    return this.findWithZoom(position, this.holder.map.getZoom(), 'mouse');
  }

  /**
   * Find the marker nearest to `position` at the given zoom level.
   * Handles both regular markers (icon-bounds check) and tiled markers (geographic radius).
   * Mirrors Android's `GoogleMapMarkerController.find(position, zoom)`.
   */
  findWithZoom(
    position: GeoPoint,
    zoom: number,
    pointerType: 'touch' | 'mouse',
  ): MarkerEntity<MapplsActualMarker> | null {
    // Geometric marker hit-test computed from the clicked lat/lng — NOT the map
    // SDK's rendered-feature query. Mirrors the non-MapLibre providers (Leaflet /
    // HERE / OpenLayers): project the click and each marker to screen, test the
    // click against each marker's on-screen icon rectangle (icon size + anchor),
    // and resolve overlaps by stacking order (the same z-index the marker layer
    // paints with — higher is on top). A `tapTolerance` ring around the icon is
    // the fallback for near-misses on small icons. Falls back to the tiled-marker
    // (raster) radius hit-test when nothing regular is hit.
    const clickScreen = this.holder.toScreenOffset(position);
    const tolerance = Settings.Default.tapTolerance;
    let bestOnIcon: MarkerEntity<MapplsActualMarker> | null = null;
    let bestOnIconY = -Infinity;
    let bestNear: MarkerEntity<MapplsActualMarker> | null = null;
    let bestNearDistSq = Infinity;
    for (const entity of this.markerManager.allEntities()) {
      if (entity.marker === null) continue; // tiled markers are hit-tested below
      const markerScreen = this.holder.toScreenOffset(entity.state.position);
      const icon = (entity.state.icon ?? createDefaultIcon()).toBitmapIcon();
      const dx = clickScreen.x - markerScreen.x;
      const dy = clickScreen.y - markerScreen.y;
      const left = -icon.anchor.x * icon.size.width;
      const right = (1 - icon.anchor.x) * icon.size.width;
      const top = -icon.anchor.y * icon.size.height;
      const bottom = (1 - icon.anchor.y) * icon.size.height;
      if (dx >= left && dx <= right && dy >= top && dy <= bottom) {
        // Click is inside this marker's icon: keep the top-most drawn one. The
        // marker layer paints markers in latitude order (mc-z-index), so the one
        // lower on screen (larger y) is drawn on top — mirroring Leaflet/HERE.
        if (markerScreen.y > bestOnIconY) {
          bestOnIconY = markerScreen.y;
          bestOnIcon = entity;
        }
      } else if (
        dx >= left - tolerance &&
        dx <= right + tolerance &&
        dy >= top - tolerance &&
        dy <= bottom + tolerance
      ) {
        const distSq = dx * dx + dy * dy;
        if (distSq < bestNearDistSq) {
          bestNearDistSq = distSq;
          bestNear = entity;
        }
      }
    }
    const hit = bestOnIcon ?? bestNear;
    if (hit) return hit;

    const nearest = this.markerManager.findNearest(position);
    if (nearest?.marker === null) {
      const hitRadius =
        pointerType === 'touch' ? MARKER_HIT_RADIUS_TOUCH_PX : MARKER_HIT_RADIUS_MOUSE_PX;
      const found = this.tileRenderer?.findNearest(position, hitRadius, zoom);
      return found ? (this.markerManager.getEntity(found.id) ?? null) : null;
    }
    return null;
  }

  // ── other existing methods ────────────────────────────────────────────────

  override async update(state: MarkerState): Promise<void> {
    const selected = this.selected;
    if (selected?.state.id === state.id) {
      const nextFingerPrint = state.fingerPrint();
      if (hasOnlyPositionChanged(selected.fingerPrint, nextFingerPrint)) {
        selected.state = state;
        selected.fingerPrint = nextFingerPrint;
        this.updateSelectedPosition(state.position);
        return;
      }
      await this.renderer.updateSelectedMarker({
        entity: selected,
        state,
        bitmapIcon: state.icon?.toBitmapIcon() ?? createDefaultIcon().toBitmapIcon(),
      });
      return;
    }
    await super.update(state);
  }

  has(state: MarkerState): boolean {
    return this.selected?.state.id === state.id || this.markerManager.hasEntity(state.id);
  }

  getSelectedMarker(): MarkerEntity<MapplsActualMarker> | null {
    return this.selected;
  }

  async setSelectedMarker(
    entity: MarkerEntity<MapplsActualMarker> | null,
  ): Promise<void> {
    if (!entity) {
      const selected = this.selected;
      if (!selected) return;
      this.cancelSelectedPositionFrame();
      this.flushSelectedPosition();
      this.setDraggingState(selected.state, false);
      this.renderer.dragLayer.selected = null;
      this.renderer.drawDragLayer();
      this.markerManager.registerEntity(selected);
      this.renderer.redraw();
      this.selected = null;
      return;
    }

    this.cancelSelectedPositionFrame();
    this.pendingSelectedPosition = null;
    this.selected = entity;
    this.markerManager.removeEntity(entity.state.id);
    this.setDraggingState(entity.state, true);
    this.renderer.dragLayer.selected = entity;
    this.renderer.dragLayer.updatePosition(entity.state.position);
    this.renderer.redraw();
    this.renderer.drawDragLayer();
  }

  updateSelectedPosition(position: GeoPoint): void {
    this.pendingSelectedPosition = position;
    if (this.selectedPositionFrame != null) return;
    this.selectedPositionFrame = requestAnimationFrame(() => {
      this.selectedPositionFrame = null;
      this.flushSelectedPosition();
    });
  }

  async resync(): Promise<void> {
    await this.renderer.resync();
  }

  override async clear(): Promise<void> {
    this.cancelSelectedPositionFrame();
    this.pendingSelectedPosition = null;
    if (this.selected) {
      this.setDraggingState(this.selected.state, false);
      this.selected = null;
      this.renderer.dragLayer.selected = null;
      this.renderer.drawDragLayer();
    }
    await this.removeTileOverlay();
    await super.clear();
    await this.renderer.onPostProcess();
  }

  override destroy(): void {
    this.cancelSelectedPositionFrame();
    this.pendingSelectedPosition = null;
    this.tileGeneration++;
    this.selected = null;
    this.renderer.dragLayer.selected = null;
    if (this.tileRouteId) {
      LocalTileServer.startServer().unregister(this.tileRouteId);
      this.tileRouteId = null;
    }
    super.destroy();
  }

  private flushSelectedPosition(): void {
    const position = this.pendingSelectedPosition;
    this.pendingSelectedPosition = null;
    if (!position || !this.selected) return;
    if (this.renderer.dragLayer.updatePosition(position)) {
      this.selected.fingerPrint = this.selected.state.fingerPrint();
      this.renderer.drawDragLayer();
      this.holder.map.triggerRepaint();
    }
  }

  private cancelSelectedPositionFrame(): void {
    if (this.selectedPositionFrame == null) return;
    cancelAnimationFrame(this.selectedPositionFrame);
    this.selectedPositionFrame = null;
  }

  private hasCompositionChanges(data: MarkerState[]): boolean {
    const nextIds = new Set(data.map((state) => state.id));
    const currentEntities = this.markerManager.allEntities();
    if (currentEntities.length !== nextIds.size) return true;

    for (const entity of currentEntities) {
      if (!nextIds.has(entity.state.id)) return true;
    }

    return data.some((state) => {
      const entity = this.markerManager.getEntity(state.id);
      return !entity || !fingerPrintEquals(state.fingerPrint(), entity.fingerPrint);
    });
  }
}

function hasOnlyPositionChanged(
  previous: MarkerFingerPrint,
  current: MarkerFingerPrint,
): boolean {
  return (
    previous.id === current.id &&
    previous.icon === current.icon &&
    previous.clickable === current.clickable &&
    previous.draggable === current.draggable &&
    previous.animation === current.animation &&
    previous.zIndex === current.zIndex
  );
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
