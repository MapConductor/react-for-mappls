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
loaded from `apis.mappls.com` on demand — you do **not** need to install or
configure `maplibre-gl` yourself, and there is no stylesheet to import.

## API key

Mappls requires a [Mappls API key](https://map.mappls.com/console/) that
is authorized for the **web origin** your app is served from (unlike the mobile
SDKs, which authenticate with credential files bound to the app identifier).
Pass it to the view state:

```tsx
const state = useMapplsViewState({
  apiKey: import.meta.env.VITE_MAPPLS_API_KEY,
  mapDesignType: MapplsDesign.Default,
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
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';

function Map() {
  const state = useMapplsViewState({
    apiKey: import.meta.env.VITE_MAPPLS_API_KEY,
    mapDesignType: MapplsDesign.Default,
    cameraPosition: createMapCameraPosition({
      position: createGeoPoint({ latitude: 28.6139, longitude: 77.209 }), // New Delhi
      zoom: 11,
    }),
  });

  return <MapplsMapView2D state={state} />;
}
```

## Map designs

Which tiles you can use is **decided by your Mappls contract**, not by a fixed
catalogue. `MapplsDesign` ships four presets:

- `MapplsDesign.Default` — leaves the account's default style untouched
- `MapplsDesign.StandardDay` — the `standard_day` style; included in every contract
- `MapplsDesign.StandardNight` — the `standard_night` style; **paid add-on**
- `MapplsDesign.GreyDay` — the `grey_day` style; **paid add-on**

The two add-on styles are only usable once your contract includes them; without
them the SDK rejects the name. This repository's sample apps do not pay for the
add-ons, so they list only `Default` and `StandardDay`.

Any other style your Mappls account has been assigned can be selected with
`new MapplsDesign(id, styleName)`; the SDK rejects names the account does not
have, and the available names can be listed at runtime with
`mapplsClassObject.getStyles()`. Switch design by updating the view state's
`mapDesignType` — it is applied through `mappls.setStyle()`.

## How it works

Mappls API3 boots through the vendor wrapper (`mappls.Map`) — which is also
where the account style is applied — and then resolves the underlying MapLibre
GL JS map behind it. Camera control, map events, and all overlays (markers,
polylines, polygons, circles, ground images, raster layers) are driven directly
on that GL map, the same MapLibre-based renderer architecture used by the other
MapConductor MapLibre-family providers. Mappls API3 renders in mercator only,
so `MapplsMapView` and `MapplsMapView2D` are the same 2D view — the former
exists for naming symmetry with the other providers.

## License

Apache-2.0
