import {
  useState } from 'react';
import {
  MapViewState,
  type MapViewStateInterface,
  type MapCameraPosition,
  MapCameraPosition as MapCameraPositionNS,
  createRandomId,
} from '@mapconductor/js-sdk-core';
import { MapplsDesign, type MapplsMapDesignType } from './MapplsDesign';

export interface MapplsViewStateInterface
  extends MapViewStateInterface<MapplsMapDesignType> {
  /** Mappls Cloud API key used to load the style/tiles. */
  readonly apiKey: string;
}

export interface MapplsViewStateParams {
  id?: string;
  /** Mappls Cloud API key. Required for the map/tiles to load. */
  apiKey?: string;
  mapDesignType?: MapplsMapDesignType;
  cameraPosition?: MapCameraPosition;
}

export class MapplsViewState
  extends MapViewState<MapplsMapDesignType>
  implements MapplsViewStateInterface {
  readonly apiKey: string;
  private _mapDesignType: MapplsMapDesignType;

  constructor({
    id = createRandomId(),
    apiKey = '',
    mapDesignType = MapplsDesign.Default,
    cameraPosition = MapCameraPositionNS.Default,
  }: MapplsViewStateParams = {}) {
    super({ id, cameraPosition });
    this.apiKey = apiKey;
    this._mapDesignType = mapDesignType;
  }

  override get mapDesignType(): MapplsMapDesignType {
    return this._mapDesignType;
  }

  override set mapDesignType(value: MapplsMapDesignType) {
    this._mapDesignType = value;
  }

  // Called by MapplsView when controller is initialized

  // Called by MapplsView when camera position changes

  // If zoom/bearing/tilt are all 0, treat as position-only update (matches Android/iOS behavior)
}

export function useMapplsViewState(params: MapplsViewStateParams = {}): MapplsViewStateInterface {
  const [state] = useState(() => new MapplsViewState(params));
  return state;
}
