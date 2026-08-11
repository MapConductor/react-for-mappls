import type * as maplibregl from 'maplibre-gl';
import {
  buildVisibleRegion,
  BaseMapViewController,
  type CircleCapable,
  type GeoRectBounds,
  type GroundImageCapable,
  type MapCameraPosition,
  type OnMapInitializedHandler,
  type MapViewControllerInterface,
  type MarkerAnimationOverlayHost,
  type MarkerCapable,
  type MarkerState,
  type OnGroundImageEventHandler,
  type OnMarkerEventHandler,
  type PolygonCapable,
  type PolylineCapable,
  type RasterLayerCapable,
  type VisibleRegion,
  type MapUISettings,
  type GlGestureHandlers,
  applyGlMapUISettings,
  type GeoPoint,
} from '@mapconductor/js-sdk-core';
import { lngLatFromEvent } from './helpers';
import { toCameraPosition, toMapCameraPosition } from './MapCameraPosition';
import { MapplsMapViewHolder } from './MapplsMapViewHolder';
import { MapplsMarkerController } from './marker/MapplsMarkerController';
import { MapplsMarkerEventController } from './marker/MapplsMarkerEventController';
import { MapplsCircleController } from './circle/MapplsCircleController';
import { MapplsPolylineController } from './polyline/MapplsPolylineController';
import { MapplsPolygonConductor } from './polygon/MapplsPolygonConductor';
import { MapplsGroundImageController } from './groundimage/MapplsGroundImageController';
import { MapplsRasterLayerController } from './raster/MapplsRasterLayerController';

export class MapplsViewController
  extends BaseMapViewController
  implements
    MapViewControllerInterface,
    MarkerCapable,
    CircleCapable,
    PolylineCapable,
    PolygonCapable,
    GroundImageCapable,
    RasterLayerCapable
{
  private readonly mapInstance: maplibregl.Map;
  private initialized = false;
  private logicalTiltHint: number | null = null;
  private readonly styleReadyRef: { current: boolean };

  readonly holder: MapplsMapViewHolder;
  private readonly markerController: MapplsMarkerController;
  private readonly markerEventController: MapplsMarkerEventController;
  private groundImagePointerDown: { point: ReturnType<typeof lngLatFromEvent>; screen: { x: number; y: number } } | null = null;
  private skipNextGroundImageClick = false;
  private readonly circleController: MapplsCircleController;
  private readonly polylineController: MapplsPolylineController;
  private readonly polygonController: MapplsPolygonConductor;
  private readonly groundImageController: MapplsGroundImageController;
  private readonly rasterLayerController: MapplsRasterLayerController;

  constructor(
    holder: MapplsMapViewHolder,
    markerController: MapplsMarkerController,
    markerEventController: MapplsMarkerEventController,
    circleController: MapplsCircleController,
    polylineController: MapplsPolylineController,
    polygonController: MapplsPolygonConductor,
    groundImageController: MapplsGroundImageController,
    rasterLayerController: MapplsRasterLayerController,
    styleReadyRef: { current: boolean } = { current: true },
    logicalTiltHint: number | null = null,
  ) {
    super();
    this.mapInstance = holder.map;
    this.initialized = holder.map.loaded();
    this.holder = holder;
    this.holder.setController(this);
    this.styleReadyRef = styleReadyRef;
    this.logicalTiltHint = logicalTiltHint;
    this.markerController = markerController;
    this.markerEventController = markerEventController;
    this.circleController = circleController;
    this.polylineController = polylineController;
    this.polygonController = polygonController;
    this.groundImageController = groundImageController;
    this.rasterLayerController = rasterLayerController;

    // Capable ファサードの既定実装がここから kind で引く。
    // **登録を忘れると composition が黙って捨てられる。**
    this.registerOverlayController(this.markerController);
    this.registerOverlayController(this.circleController);
    this.registerOverlayController(this.polylineController);
    this.registerOverlayController(this.polygonController);
    this.registerOverlayController(this.groundImageController);
    this.registerOverlayController(this.rasterLayerController);
    this.markerController.onRasterLayerUpdate = async (state) => {
      if (state) {
        await this.rasterLayerController.composition([state]);
      } else {
        await this.rasterLayerController.clear();
      }
    };
    this.setupEventListeners();
  }

  getMap(): maplibregl.Map {
    return this.mapInstance;
  }

  /**
   * Mappls の Map は Mapbox GL 互換なので、ジェスチャは GL 側のハンドラで
   * そのまま制御できる（Longdo のような Ui.Mouse の中間層は無い）。
   */
  applyUISettings(settings: MapUISettings): void {
    applyGlMapUISettings(this.mapInstance as unknown as Partial<GlGestureHandlers>, settings, 'Mappls');
  }

  private setupEventListeners(): void {
    this.mapInstance.on('movestart', () => {
      const camera = this.getCameraPosition();
      if (camera) this.notifyCameraMoveStart(camera);
    });

    const preventGroundImageDrag = (e: { lngLat: { lat: number; lng: number }; point: { x: number; y: number }; preventDefault: () => void }) => {
      const point = lngLatFromEvent(e);
      if (this.groundImageController.hasClickableAt(point)) {
        e.preventDefault();
        this.groundImagePointerDown = { point, screen: e.point };
      }
    };
    const dispatchGroundImagePointerUp = (e: { point: { x: number; y: number } }) => {
      const down = this.groundImagePointerDown;
      this.groundImagePointerDown = null;
      if (!down) return;

      const dx = e.point.x - down.screen.x;
      const dy = e.point.y - down.screen.y;
      if (Math.hypot(dx, dy) > 8) return;
      if (this.groundImageController.dispatchClick(down.point)) {
        this.skipNextGroundImageClick = true;
      }
    };
    this.mapInstance.on('mousedown', preventGroundImageDrag);
    this.mapInstance.on('touchstart', preventGroundImageDrag);
    this.mapInstance.on('mouseup', dispatchGroundImagePointerUp);
    this.mapInstance.on('touchend', dispatchGroundImagePointerUp);

    this.mapInstance.on('click', (e) => {
      const point = lngLatFromEvent(e);
      // グラウンドイメージのドラッグ抑止で既に配送済みなら、その click は捨てる。
      if (this.skipNextGroundImageClick && this.groundImageController.hasClickableAt(point)) {
        this.skipNextGroundImageClick = false;
        return;
      }
      this.skipNextGroundImageClick = false;
      // marker → circle → groundImage → polyline → polygon → map の一本道。
      // 順序と先勝ちはコアの BaseMapViewController.dispatchTap が持つ。
      this.dispatchTap(point);
    });

    this.mapInstance.on('contextmenu', (e) => {
      this.notifyMapLongClick(lngLatFromEvent(e));
    });

    this.mapInstance.on('move', () => {
      const camera = this.getCameraPosition();
      if (camera) this.notifyCameraMove(camera);
    });

    this.mapInstance.on('moveend', () => {
      const camera = this.getCameraPosition();
      if (camera) this.notifyCameraMoveEnd(camera);
    });

    this.mapInstance.on('load', () => {
      this.styleReadyRef.current = true;
      this.initialized = true;
      this.notifyMapInitialized();
    });

    this.mapInstance.on('error', (e) => {
      console.error('[MapConductor] Mappls error:', e.error);
    });

    const resyncAll = () => {
      void this.markerController.resync().then(() => this.markerEventController.resync());
      void this.circleController.resync();
      void this.polylineController.resync();
      this.polygonController.resync();
      this.groundImageController.resync();
      void this.rasterLayerController.resync();
    };

    this.mapInstance.on('styledata', () => {
      const loaded = this.mapInstance.isStyleLoaded() === true;
      if (loaded && !this.styleReadyRef.current) {
        this.styleReadyRef.current = true;
        resyncAll();
      } else if (!loaded) {
        this.styleReadyRef.current = false;
      }
    });

    // Fallback: styledata can fire with isStyleLoaded()=false as the last event
    // (e.g. after setProjection), leaving styleReady stuck at false even though
    // the style is actually loaded.  The idle event fires once the map is stable,
    // guaranteeing isStyleLoaded()=true, so use it to recover.
    this.mapInstance.on('idle', () => {
      if (!this.styleReadyRef.current && this.mapInstance.isStyleLoaded()) {
        this.styleReadyRef.current = true;
        resyncAll();
      }
    });

    if (this.mapInstance.isStyleLoaded()) {
      this.styleReadyRef.current = true;
    }
  }

  override setMapInitializedListener(listener: OnMapInitializedHandler | null): void {
    super.setMapInitializedListener(listener);
    if (listener && this.initialized) this.notifyMapInitialized();
  }

  moveCamera(position: MapCameraPosition): Promise<boolean> {
    this.logicalTiltHint = position.tilt;
    const cam = toCameraPosition(position);
    return new Promise((resolve) => {
      this.mapInstance.once('moveend', () => resolve(true));
      // jumpTo (not flyTo) so duration = 0 moves the camera instantly with no animation.
      this.mapInstance.jumpTo({
        center: cam.center,
        zoom: cam.zoom,
        bearing: cam.bearing,
        pitch: cam.tilt,
      });
    });
  }

  animateCamera(position: MapCameraPosition, durationMillis: number): Promise<boolean> {
    this.logicalTiltHint = position.tilt;
    const cam = toCameraPosition(position);
    return new Promise((resolve) => {
      this.mapInstance.once('moveend', () => resolve(true));
      this.mapInstance.easeTo({
        center: cam.center,
        zoom: cam.zoom,
        bearing: cam.bearing,
        pitch: cam.tilt,
        duration: durationMillis || 500,
      });
    });
  }

  fitBounds(bounds: GeoRectBounds, padding: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.mapInstance.once('moveend', () => resolve(true));
      const fitPadding = padding;
      this.mapInstance.fitBounds(
        [
          [bounds.southWest!.longitude, bounds.southWest!.latitude],
          [bounds.northEast!.longitude, bounds.northEast!.latitude],
        ],
        {
          ...(fitPadding != null ? { padding: fitPadding } : {}),
          // Preserve current rotation/tilt so the fit is correct at any bearing/pitch
          // (maplibre-gl resets bearing to 0 when omitted).
          bearing: this.mapInstance.getBearing(),
          pitch: this.mapInstance.getPitch(),
        },
      );
    });
  }

  getCameraPosition(): MapCameraPosition | null {
    const camera = toMapCameraPosition({
      center: this.mapInstance.getCenter(),
      zoom: this.mapInstance.getZoom(),
      bearing: this.mapInstance.getBearing(),
      tilt: this.mapInstance.getPitch(),
      logicalTiltHint: this.logicalTiltHint,
    });
    if (!camera) return camera;
    const visibleRegion = this.getVisibleRegion();
    if (!visibleRegion) return camera;
    // Matches Android: the visible region rides on cameraPosition so that
    // mapViewState.cameraPosition.visibleRegion works without the controller.
    return camera.copy({ visibleRegion });
  }

  /**
   * Projects the four screen corners of the map viewport back to geo
   * coordinates via `fromScreenOffsetSync` and extends a bounds from them,
   * instead of using `map.getBounds()`'s axis-aligned box — this stays
   * correct when the map is rotated. Mirrors Android's
   * `MapplsViewControllerImpl.getMapCameraPosition()`.
   */
  private getVisibleRegion(): VisibleRegion | null {
    const canvas = this.mapInstance.getCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return null;

    // 4 隅の逆投影と bounds の組み立てはコアの buildVisibleRegion が持つ。
    return buildVisibleRegion(this.holder, { width, height });
  }

  // --- Marker ---

  async compositionMarkers(data: MarkerState[]): Promise<void> {
    await this.markerController.composition(data);
    this.markerEventController.resync();
  }

  async updateMarker(state: MarkerState): Promise<void> {
    await this.markerController.update(state);
    this.markerEventController.resync();
  }

  setOnMarkerClickListener(_listener: OnMarkerEventHandler | null): void {
    this.markerEventController.setClickListener(_listener);
  }
  setOnMarkerDragStart(_listener: OnMarkerEventHandler | null): void {
    this.markerEventController.setDragStartListener(_listener);
  }
  setOnMarkerDrag(_listener: OnMarkerEventHandler | null): void {
    this.markerEventController.setDragListener(_listener);
  }
  setOnMarkerDragEnd(_listener: OnMarkerEventHandler | null): void {
    this.markerEventController.setDragEndListener(_listener);
  }
  setOnMarkerAnimateStart(_listener: OnMarkerEventHandler | null): void {
    this.markerEventController.setAnimateStartListener(_listener);
  }
  setOnMarkerAnimateEnd(_listener: OnMarkerEventHandler | null): void {
    this.markerEventController.setAnimateEndListener(_listener);
  }
  setMarkerAnimationOverlayHost(host: MarkerAnimationOverlayHost | null): void {
    this.markerController.setMarkerAnimationOverlayHost(host);
  }

  // --- Circle ---

  // --- Polyline ---

  // --- Polygon ---

  // --- GroundImage ---

  setOnGroundImageClickListener(_listener: OnGroundImageEventHandler | null): void {}

  // --- RasterLayer ---

  // --- Lifecycle ---

  async clearOverlays(): Promise<void> {
    await this.markerController.clear();
    await this.circleController.clear();
    await this.polylineController.clear();
    await this.polygonController.clear();
    this.groundImageController.clear();
    await this.rasterLayerController.clear();
  }

  destroy(): void {
    this.markerEventController.destroy();
    void this.clearOverlays().finally(() => {
      this.markerController.destroy();
      this.mapInstance.remove();
    });
  }

  /**
   * マーカーのヒットテストと配送。カスケードの先頭。
   *
   * ズームとポインタ種別（タッチかマウスかで許容半径が変わる）が要るので
   * コアの既定ではなくここで持つ。判定自体は core の MarkerManager。
   */
  protected override dispatchMarkerTap(point: GeoPoint): boolean {
    const entity = this.markerController.findWithZoom(
      point,
      this.mapInstance.getZoom(),
      this.markerEventController.lastPointerType,
    );
    if (!entity?.state.clickable) return false;
    this.markerController.dispatchClick(entity.state);
    return true;
  }
}
