# @mapconductor/react-for-mappls

Mappls provider for the MapConductor React SDK. Renders a
[Mappls](https://map.mappls.com/) (Mappls API3, which uses MapLibre GL JS
internally) through MapConductor's provider-independent camera, marker, and
overlay API, so the same application code can also run on Google Maps, MapLibre,
Mapbox, MapTiler, Leaflet, OpenLayers, ArcGIS, Cesium, HERE, or TomTom.

## Installation

```shell
npm install @mapconductor/react-for-mappls @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

The Mappls API3 script (which bundles MapLibre GL JS and its Web Worker) is
loaded from `api.mappls.com` on demand — you do **not** need to install or
configure `maplibre-gl` yourself, and there is no stylesheet to import.

## API key

Mappls requires a [Mappls API key](https://map.mappls.com/console/) that
is authorized for the **web origin** your app is served from (unlike the Android
key, which is restricted by package name). Pass it to the view state:

```tsx
const state = useMapplsViewState({
  apiKey: import.meta.env.VITE_MAPPLS,
  mapDesignType: MapplsDesign.Normal,
  cameraPosition,
});
```

## Usage

```tsx
import {
  MapplsDesign,
  MapplsMapView2D,
  useMapplsViewState,
} from '@mapconductor/react-for-mappls';
import { MapCameraPosition, createGeoPoint } from '@mapconductor/js-sdk-core';

function Map() {
  const state = useMapplsViewState({
    apiKey: import.meta.env.VITE_MAPPLS,
    mapDesignType: MapplsDesign.Normal,
    cameraPosition: MapCameraPosition.create({
      position: createGeoPoint({ latitude: 13.7563, longitude: 100.5018 }),
      zoom: 11,
    }),
  });

  return <MapplsMapView2D state={state} />;
}
```

## Map designs

`MapplsDesign` exposes the standard base layers provided by `mappls.Layers`:

`Normal`, `Easy`, `Pastel`, `PastelGray`, `Hard`, `Gray`, `Light`, `Night`,
`Dark`, `Political`, `Osm`, `Satellite` (`SPHERE_IMAGES`), `Hybrid`
(`SPHERE_HYBRID`).

Switch design by updating the view state's `mapDesignType`.

## How it works

Mappls API3 renders through an internal MapLibre GL JS map exposed as
`map.Renderer`. This provider bootstraps the base map, camera, and base-layer
designs through the Mappls wrapper (`mappls.Map`) and drives camera control,
map events, and all overlays (markers, polylines, polygons, circles, ground
images, raster layers) through `map.Renderer` — the same MapLibre-based renderer
architecture used by the other MapConductor MapLibre-family providers.

## License

Apache-2.0
