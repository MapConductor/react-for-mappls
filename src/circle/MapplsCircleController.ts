import {
  CircleController,
  type CircleState,
  type GeoPoint,
} from '@mapconductor/js-sdk-core';
import {
  type MapplsActualCircle,
} from './MapplsCircleLayer';
import { MapplsCircleOverlayRenderer } from './MapplsCircleOverlayRenderer';

export class MapplsCircleController extends CircleController<MapplsActualCircle> {
  declare readonly renderer: MapplsCircleOverlayRenderer;

  constructor(renderer: MapplsCircleOverlayRenderer) {
    super({ circleManager: renderer.circleManager, renderer });
  }

  override async update(state: CircleState): Promise<void> {
    await super.update(state);
    await this.renderer.redraw();
  }

  async resync(): Promise<void> {
    await this.renderer.redraw();
  }

  override async clear(): Promise<void> {
    await super.clear();
    await this.renderer.redraw();
  }

  /**
   * Hit-test a map click (its lat/lng) against the circles geometrically (inside
   * the fill radius) and dispatch the click on the matching circle. Does NOT use
   * a Mappls layer/overlay click event — detection is driven by the map click
   * position, matching the marker/polyline paths and android. Returns true if hit.
   */
  handleMapClick(clicked: GeoPoint): boolean {
    const entity = this.find(clicked);
    if (!entity) return false;
    this.dispatchClick({ state: entity.state, clicked });
    return true;
  }
}
