import {
  AbstractPolylineOverlayRenderer,
  buildUnwrappedPolylinePath,
  type PolylineEntity,
  type PolylineManagerInterface,
  type PolylineState,
} from '@mapconductor/js-sdk-core';
import type { LineFeature } from '../helpers';
import { MapplsMapViewHolder } from '../MapplsMapViewHolder';
import {
  MapplsPolylineLayer,
  type MapplsActualPolyline,
} from './MapplsPolylineLayer';

export class MapplsPolylineOverlayRenderer extends AbstractPolylineOverlayRenderer<
  MapplsMapViewHolder,
  MapplsActualPolyline
> {
  readonly layer: MapplsPolylineLayer;
  readonly polylineManager: PolylineManagerInterface<MapplsActualPolyline>;

  constructor({
    layer,
    polylineManager,
    holder,
  }: {
    layer: MapplsPolylineLayer;
    polylineManager: PolylineManagerInterface<MapplsActualPolyline>;
    holder: MapplsMapViewHolder;
  }) {
    super(holder);
    this.layer = layer;
    this.polylineManager = polylineManager;
  }

  async createPolyline(state: PolylineState): Promise<MapplsActualPolyline | null> {
    if (state.points.length < 2) return null;
    return createMapplsLines(state, this.resolveZIndex(state));
  }

  async updatePolylineProperties({
    current,
  }: {
    polyline: MapplsActualPolyline;
    current: PolylineEntity<MapplsActualPolyline>;
    prev: PolylineEntity<MapplsActualPolyline>;
  }): Promise<MapplsActualPolyline | null> {
    return this.createPolyline(current.state);
  }

  async removePolyline(_entity: PolylineEntity<MapplsActualPolyline>): Promise<void> {
    // The source is rewritten from the remaining manager entities in onPostProcess().
  }

  override async onPostProcess(): Promise<void> {
    this.layer.draw(this.polylineManager.allEntities());
  }

  async redraw(): Promise<void> {
    await this.onPostProcess();
  }

  private resolveZIndex(state: PolylineState): number {
    if (state.zIndex !== 0) return state.zIndex;
    return typeof state.extra === 'number' ? state.extra : 0;
  }
}

function createMapplsLines(
  state: PolylineState,
  zIndex: number,
): MapplsActualPolyline {
  // Unwrapped path (longitudes continuous, may exceed ±180): Mappls GL renders
  // it seamlessly across the antimeridian without splitting.
  const path = buildUnwrappedPolylinePath(state.points, state.geodesic);
  if (path.length < 2) return [];

  const feature: LineFeature = {
    type: 'Feature',
    id: `polyline-${state.id}-0`,
    geometry: {
      type: 'LineString',
      coordinates: path.map((point) => [point.longitude, point.latitude]),
    },
    properties: {
      id: `polyline-${state.id}-0`,
      [MapplsPolylineLayer.Prop.STROKE_COLOR]: state.strokeColor,
      [MapplsPolylineLayer.Prop.STROKE_WIDTH]: state.strokeWidth,
      [MapplsPolylineLayer.Prop.Z_INDEX]: zIndex,
    },
  };
  return [feature];
}
