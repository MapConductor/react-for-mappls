import { AbstractZoomAltitudeConverter, WebMercatorZoomAltitudeConverter } from '@mapconductor/js-sdk-core';

/**
 * 統一ズーム（Google Maps 基準・256px タイル）⇄ 高度の変換。
 *
 * 換算式はコアの {@link WebMercatorZoomAltitudeConverter} にある。
 */
export class ZoomAltitudeConverter extends WebMercatorZoomAltitudeConverter {
    /** Empirical offset: GoogleZoom ≈ MapplsSDK.zoom + 1.0 */
    static readonly MAPLIBRE_TO_GOOGLE_ZOOM_OFFSET = 1.0;

    constructor(zoom0Altitude: number = AbstractZoomAltitudeConverter.DEFAULT_ZOOM0_ALTITUDE) {
        super(zoom0Altitude, ZoomAltitudeConverter.MAPLIBRE_TO_GOOGLE_ZOOM_OFFSET);
    }

    static maplibreZoomToGoogleZoom(maplibreZoom: number): number {
        const google = maplibreZoom + ZoomAltitudeConverter.MAPLIBRE_TO_GOOGLE_ZOOM_OFFSET;
        return Math.min(Math.max(google, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL), AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL);
    }

    static googleZoomToMaplibreZoom(googleZoom: number): number {
        const maplibre = googleZoom - ZoomAltitudeConverter.MAPLIBRE_TO_GOOGLE_ZOOM_OFFSET;
        return Math.min(Math.max(maplibre, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL), AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL);
    }
}
