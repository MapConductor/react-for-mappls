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
        // MIN/MAX_ZOOM_LEVEL は Google 系のズーム値。オフセットを引いた *あと* に
        // 当てると、Google 系の 0 がプロバイダ系の 0 へ潰れて戻ってこない
        // （読み戻しは +1 されるので 0 を指定したはずが 1 になる）。丸めるのは
        // 変換の前、値がまだ Google 系でいるあいだ。逆方向は変換してから丸めており、
        // そちらは元から Google 系どうしで正しい。
        const clamped = Math.min(
            Math.max(googleZoom, AbstractZoomAltitudeConverter.MIN_ZOOM_LEVEL),
            AbstractZoomAltitudeConverter.MAX_ZOOM_LEVEL,
        );
        return clamped - ZoomAltitudeConverter.MAPLIBRE_TO_GOOGLE_ZOOM_OFFSET;
    }
}
