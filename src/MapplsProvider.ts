import {
  CircleManager,
  MapProvider,
  MarkerManager,
  MarkerTilingOptions,
  PolygonManager,
  PolylineManager,
  type GeoRectBounds,
  type MapConfig,
  type MapViewControllerInterface,
} from '@mapconductor/js-sdk-core';
import { MapplsViewController } from './MapplsViewController';
import { loadMappls, waitForGlMap } from './mapplsApi';
import { toCameraPosition } from './MapCameraPosition';
import { MapplsMapViewHolder } from './MapplsMapViewHolder';
import { MapplsMarkerController } from './marker/MapplsMarkerController';
import { MapplsMarkerEventController } from './marker/MapplsMarkerEventController';
import { MapplsMarkerOverlayRenderer } from './marker/MapplsMarkerOverlayRenderer';
import { MarkerLayer, type MapplsActualMarker } from './marker/MarkerLayer';
import { MarkerDragLayer } from './marker/MarkerDragLayer';
import { MapplsCircleController } from './circle/MapplsCircleController';
import { MapplsCircleLayer, type MapplsActualCircle } from './circle/MapplsCircleLayer';
import { MapplsCircleOverlayRenderer } from './circle/MapplsCircleOverlayRenderer';
import { MapplsPolylineController } from './polyline/MapplsPolylineController';
import { MapplsPolylineLayer, type MapplsActualPolyline } from './polyline/MapplsPolylineLayer';
import { MapplsPolylineOverlayRenderer } from './polyline/MapplsPolylineOverlayRenderer';
import { MapplsPolygonConductor } from './polygon/MapplsPolygonConductor';
import { MapplsPolygonLayer, type MapplsActualPolygon } from './polygon/MapplsPolygonLayer';
import { MapplsPolygonOverlayRenderer } from './polygon/MapplsPolygonOverlayRenderer';
import { MapplsGroundImageController } from './groundimage/MapplsGroundImageController';
import { MapplsGroundImageOverlayRenderer } from './groundimage/MapplsGroundImageOverlayRenderer';
import { MapplsRasterLayerController } from './raster/MapplsRasterLayerController';
import { MapplsRasterLayerOverlayRenderer } from './raster/MapplsRasterLayerOverlayRenderer';

export interface MapplsConfig extends MapConfig {
  /** Mappls web API key (from the Mappls console). Required for the map to load. */
  apiKey?: string;
  /**
   * `mappls.setStyle()` に渡すスタイル名。空文字/未指定はアカウントの既定スタイル。
   * （MapplsDesign.styleName がここへ入る）
   */
  styleName?: string;
  maxZoom?: number;
  minZoom?: number;
  /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
  restrictBounds?: GeoRectBounds;
  markerTilingOptions?: MarkerTilingOptions;
}

// Sentinel used to silently cancel initialization when destroy() is called before load.
// Distinct from real errors so callers can ignore it without swallowing actual failures.
const DESTROYED_BEFORE_LOAD = Symbol('DESTROYED_BEFORE_LOAD');

/**
 * Mappls provider implementation.
 *
 * Bootstraps the base map through the Mappls web SDK (`mappls.Map`), then
 * drives camera / events / overlays through the returned Mapbox-GL 互換マップ
 * — the same renderer architecture as the other MapLibre-family providers.
 * android-for-mappls / ios-for-mappls と同じく、スタイルはアカウント紐付きの
 * スタイル名で、既定スタイルは SDK に任せる。
 */
export class MapplsProvider extends MapProvider {
  // Track the Mappls map + container separately from the controller so destroy()
  // works even while async initialization (script load + map ready) is in flight.
  private mapplsMap: unknown = null;
  private container: HTMLElement | null = null;
  // Bumped by destroy() and by every initialize() call. An in-flight init whose
  // captured token no longer matches has been superseded (e.g. React StrictMode's
  // mount → unmount → remount, or a design re-init) and must abort. A sticky
  // boolean flag would wrongly abort the *next* real init after the first destroy.
  private initToken = 0;

  async initialize(config: MapplsConfig): Promise<MapViewControllerInterface> {
    if (this.controller) {
      return this.controller;
    }
    const token = ++this.initToken;

    const container =
      typeof config.container === 'string'
        ? document.getElementById(config.container)
        : config.container;

    if (!container) {
      throw new Error('Container element not found');
    }
    this.container = container;
    // Defensive: wipe any leftover Mappls DOM (e.g. after a design re-init) so a
    // new map is not created on top of a previous map's controls/canvas.
    container.replaceChildren();

    const mappls = await loadMappls(config.apiKey ?? '');
    if (token !== this.initToken) throw DESTROYED_BEFORE_LOAD;

    const initialCamera = config.initCameraPosition ? toCameraPosition(config.initCameraPosition) : null;

    // Mappls の Map() は要素 id で受けるので、無ければ振っておく
    if (!container.id) {
      container.id = `mc-mappls-${Math.random().toString(36).slice(2)}`;
    }

    // 注意: Mappls ラッパーの center は **[lat, lng] 順**（GL と逆）。
    // ここ以外のカメラ操作はすべて GL API で行う。
    const mapplsMap = mappls.Map({
      id: container.id,
      properties: {
        center: initialCamera ? [initialCamera.center[1], initialCamera.center[0]] : [28.61, 77.23],
        zoom: initialCamera ? initialCamera.zoom : 9,
        zoomControl: false,
        location: false,
        fullscreenControl: false,
        ...(config.minZoom !== undefined ? { minZoom: config.minZoom } : {}),
        ...(config.maxZoom !== undefined ? { maxZoom: config.maxZoom } : {}),
      },
    });
    this.mapplsMap = mapplsMap;

    // スタイル名の指定があればアカウント既定から差し替える
    // （空文字 = 既定スタイルのまま。android/ios と同じ規約）
    if (config.styleName) {
      try {
        (mappls as { setStyle?: (name: string) => void }).setStyle?.(config.styleName);
      } catch {
        // 未対応の SDK バージョンでは既定スタイルのまま進める
      }
    }

    const map = await waitForGlMap(mapplsMap);
    if (token !== this.initToken) {
      try {
        map.remove();
      } catch {
        // ignore
      }
      throw DESTROYED_BEFORE_LOAD;
    }

    // Use the internal MapLibre map's container (a properly-sized element) as the
    // holder's mapView, mirroring the other MapLibre-family providers — the outer
    // Mappls placeholder can report a 0×0 rect once Mappls takes it over.
    const mapView = (map.getContainer?.() as HTMLElement | undefined) ?? container;
    const holder = new MapplsMapViewHolder(mapView, map, mapplsMap);
    // Rely solely on styleReady rather than also calling isStyleLoaded() here.
    // isStyleLoaded() can return false transiently while Mappls processes an
    // addLayer/addSource call, which would incorrectly block overlay resync.
    const styleReadyRef = { current: true };
    const canEditStyle = () => styleReadyRef.current;
    const markerController = getMarkerController(holder, canEditStyle, config);
    const markerEventController = new MapplsMarkerEventController(markerController);
    const circleController = getCircleController(holder, canEditStyle);
    const polylineController = getPolylineController(holder, canEditStyle);
    const polygonController = getPolygonController(holder, canEditStyle);
    const groundImageController = getGroundImageController(holder, canEditStyle);
    const rasterLayerController = getRasterLayerController(holder, canEditStyle);

    this.controller = new MapplsViewController(
      holder,
      markerController,
      markerEventController,
      circleController,
      polylineController,
      polygonController,
      groundImageController,
      rasterLayerController,
      styleReadyRef,
      config.initCameraPosition?.tilt ?? null,
    );
    return this.controller;
  }

  destroy(): void {
    this.initToken++;
    if (this.controller) {
      // Controller.destroy() removes the internal MapLibre map (map.Renderer).
      this.controller.destroy();
      this.controller = null;
    } else if (this.mapplsMap) {
      // Map was created but the controller hasn't been set yet (not ready).
      try {
        (this.mapplsMap as { remove?: () => void }).remove?.();
      } catch {
        // ignore
      }
    }
    // Remove any Mappls-injected DOM (controls/attribution) left in the container.
    this.container?.replaceChildren();
    this.mapplsMap = null;
    this.container = null;
  }

  /** Returns true if the rejection was caused by an intentional destroy() call. */
  static isDestroyedBeforeLoad(error: unknown): boolean {
    return error === DESTROYED_BEFORE_LOAD;
  }
}

function getMarkerController(
  holder: MapplsMapViewHolder,
  canEditStyle: () => boolean,
  config: MapplsConfig,
): MapplsMarkerController {
  const markerManager = MarkerManager.defaultManager<MapplsActualMarker>();
  const markerLayer = new MarkerLayer({
    holder,
    canEditStyle,
    sourceId: 'mc-markers',
    layerId: 'mc-marker-layer',
  });
  const dragLayer = new MarkerDragLayer({
    holder,
    canEditStyle,
    sourceId: 'mc-marker-drag',
    layerId: 'mc-marker-drag-layer',
  });
  const renderer = new MapplsMarkerOverlayRenderer({
    holder,
    markerManager,
    markerLayer,
    dragLayer,
  });
  return new MapplsMarkerController(holder, renderer, config.markerTilingOptions);
}

function getCircleController(
  holder: MapplsMapViewHolder,
  canEditStyle: () => boolean,
): MapplsCircleController {
  const circleManager = new CircleManager<MapplsActualCircle>();
  const layer = new MapplsCircleLayer({ holder, canEditStyle });
  const renderer = new MapplsCircleOverlayRenderer({ layer, circleManager, holder });
  return new MapplsCircleController(renderer);
}

function getPolylineController(
  holder: MapplsMapViewHolder,
  canEditStyle: () => boolean,
): MapplsPolylineController {
  const polylineManager = new PolylineManager<MapplsActualPolyline>();
  const layer = new MapplsPolylineLayer({ holder, canEditStyle });
  const renderer = new MapplsPolylineOverlayRenderer({ layer, polylineManager, holder });
  return new MapplsPolylineController(renderer);
}

function getPolygonController(
  holder: MapplsMapViewHolder,
  canEditStyle: () => boolean,
): MapplsPolygonConductor {
  const polygonManager = new PolygonManager<MapplsActualPolygon>();
  const layer = new MapplsPolygonLayer({ holder, canEditStyle });
  const renderer = new MapplsPolygonOverlayRenderer({ layer, polygonManager, holder });
  return new MapplsPolygonConductor(renderer);
}

function getGroundImageController(
  holder: MapplsMapViewHolder,
  canEditStyle: () => boolean,
): MapplsGroundImageController {
  const renderer = new MapplsGroundImageOverlayRenderer({ holder, canEditStyle });
  return new MapplsGroundImageController(renderer);
}

function getRasterLayerController(
  holder: MapplsMapViewHolder,
  canEditStyle: () => boolean,
): MapplsRasterLayerController {
  const renderer = new MapplsRasterLayerOverlayRenderer(holder, canEditStyle);
  return new MapplsRasterLayerController(renderer);
}
