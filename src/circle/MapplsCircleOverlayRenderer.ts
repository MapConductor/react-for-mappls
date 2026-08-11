import {
  AbstractCircleOverlayRenderer,
  circleToRing,
  closeRing,
  type CircleEntity,
  type CircleManagerInterface,
  type CircleState,
} from '@mapconductor/js-sdk-core';
import { MapplsMapViewHolder } from '../MapplsMapViewHolder';
import {
  MapplsCircleLayer,
  type MapplsActualCircle,
} from './MapplsCircleLayer';

export class MapplsCircleOverlayRenderer extends AbstractCircleOverlayRenderer<
  MapplsMapViewHolder,
  MapplsActualCircle
> {
  readonly layer: MapplsCircleLayer;
  readonly circleManager: CircleManagerInterface<MapplsActualCircle>;

  constructor({
    layer,
    circleManager,
    holder,
  }: {
    layer: MapplsCircleLayer;
    circleManager: CircleManagerInterface<MapplsActualCircle>;
    holder: MapplsMapViewHolder;
  }) {
    super(holder);
    this.layer = layer;
    this.circleManager = circleManager;
  }

  async createCircle(state: CircleState): Promise<MapplsActualCircle | null> {
    return createMapplsCircle(state);
  }

  async updateCircleProperties({
    current,
  }: {
    circle: MapplsActualCircle;
    current: CircleEntity<MapplsActualCircle>;
    prev: CircleEntity<MapplsActualCircle>;
  }): Promise<MapplsActualCircle | null> {
    return this.createCircle(current.state);
  }

  async removeCircle(_entity: CircleEntity<MapplsActualCircle>): Promise<void> {
    // The source is rewritten from the remaining manager entities in onPostProcess().
  }

  override async onPostProcess(): Promise<void> {
    this.layer.draw(this.circleManager.allEntities());
  }

  async redraw(): Promise<void> {
    await this.onPostProcess();
  }
}

function createMapplsCircle(state: CircleState): MapplsActualCircle | null {
  // Ground-anchored circle polygon from the shared core geometry. The ring is
  // unwrapped (longitudes may exceed ±180), which Mappls GL renders seamlessly
  // across the antimeridian without splitting.
  const ring = closeRing(circleToRing(state.center, state.radiusMeters, state.geodesic));
  if (ring.length < 4) return null;
  const zIndex = state.zIndex ?? calculateZIndex(state.center.latitude, state.center.longitude);

  return {
    type: 'Feature',
    id: `circle-${state.id}`,
    geometry: {
      type: 'Polygon',
      coordinates: [ring.map((point) => [point.longitude, point.latitude])],
    },
    properties: {
      id: `circle-${state.id}`,
      [MapplsCircleLayer.Prop.FILL_COLOR]: state.fillColor,
      [MapplsCircleLayer.Prop.STROKE_COLOR]: state.strokeColor,
      [MapplsCircleLayer.Prop.STROKE_WIDTH]: state.strokeWidth,
      [MapplsCircleLayer.Prop.Z_INDEX]: zIndex,
    },
  };
}

function calculateZIndex(latitude: number, longitude: number): number {
  return Math.round(-latitude * 1_000_000 - longitude);
}
