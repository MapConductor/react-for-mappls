import {
  PolylineController,
  type GeoPoint,
  type MapCameraPosition,
} from '@mapconductor/js-sdk-core';
import {
  type MapplsActualPolyline,
} from './MapplsPolylineLayer';
import { MapplsPolylineOverlayRenderer } from './MapplsPolylineOverlayRenderer';

export class MapplsPolylineController extends PolylineController<MapplsActualPolyline> {
  declare readonly renderer: MapplsPolylineOverlayRenderer;

  constructor(renderer: MapplsPolylineOverlayRenderer) {
    super({ polylineManager: renderer.polylineManager, renderer });
  }

  async resync(): Promise<void> {
    await this.renderer.redraw();
  }

  override async clear(): Promise<void> {
    await super.clear();
    await this.renderer.redraw();
  }

  /**
   * Hit-test a map click (its lat/lng) against the polylines geometrically and,
   * if the click lands within the tap tolerance of a line, dispatch the click on
   * the nearest polyline (with the closest point on that line as `clicked`).
   *
   * This intentionally does NOT use a Mappls layer/overlay click event. Like
   * android (`TomTomMapViewController.onPolylineClickedInternal`) and the marker
   * path, the hit is derived from the map click position, so behaviour matches
   * across providers. Returns true if a polyline was hit (so the caller can
   * suppress the generic map click).
   */
  handleMapClick(clicked: GeoPoint, camera: MapCameraPosition | null): boolean {
    // findWithClosestPoint uses the current camera (zoom + visible region) for
    // its pixel-space tap tolerance, so refresh it from the click's camera.
    if (camera) void this.onCameraChanged(camera);
    const hit = this.findWithClosestPoint(clicked);
    if (!hit) return false;
    this.dispatchClick({ state: hit.entity.state, clicked: hit.closestPoint });
    return true;
  }
}
