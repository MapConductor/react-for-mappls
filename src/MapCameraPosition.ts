import { createGeoPoint, createMapCameraPosition, computeOffset, type MapCameraPosition } from '@mapconductor/js-sdk-core';
import type * as maplibregl from 'maplibre-gl';
import { ZoomAltitudeConverter } from './zoom/ZoomAltitudeConverter';

const converter = new ZoomAltitudeConverter();
const NEGATIVE_TILT_TARGET_DISTANCE_SCALE = 1.83;
const NEGATIVE_TILT_ZOOM_OFFSET_AT_MAX_TILT = -0.9;

/**
 * Quantize a programmatic zoom target to the nearest integer, mirroring how
 * Google Maps 2D (the project-wide camera reference) snaps zoom. Keeps Mappls
 * aligned with Google at fractional demo zooms (Oahu 9.5 -> 10, Kiribati
 * 4.5 -> 5) instead of rendering the true half level Google never shows.
 */
function snapZoomToGoogle(zoom: number): number {
    return Math.round(zoom);
}

/**
 * Converts a MapConductor MapCameraPosition to Mappls camera parameters.
 * Applies the zoom offset: Mappls zoom = MapConductor zoom - 1.
 */
export function toCameraPosition(pos: MapCameraPosition): {
    center: [number, number];
    zoom: number;
    bearing: number;
    tilt: number;
} {
    if (pos.tilt >= 0) {
        return {
            center: [pos.center.longitude, pos.center.latitude],
            // Google Maps 2D (the project-wide reference) snaps zoom to the
            // nearest integer (9.5 -> 10, 4.5 -> 5); Mappls renders the true
            // fractional zoom, leaving the two up to half a level apart at
            // fractional targets (e.g. Oahu 9.5). Quantize programmatic targets
            // the way Google does. Reported zoom (toMapCameraPosition) stays
            // fractional and faithful.
            zoom: ZoomAltitudeConverter.googleZoomToMaplibreZoom(snapZoomToGoogle(pos.zoom)),
            bearing: pos.bearing,
            tilt: pos.tilt,
        };
    } else {
        // tilt < 0: Mappls cannot represent an upward pitch directly.
        // Match the Google Maps workaround: move the ground target forward and render with abs(tilt).
        const tiltAbsDeg = Math.min(Math.max(Math.abs(pos.tilt), 0), 60);
        const tiltAbsRad = (tiltAbsDeg * Math.PI) / 180;
        const maplibreZoomForAltitude = ZoomAltitudeConverter.googleZoomToMaplibreZoom(pos.zoom);
        const altitude = converter.zoomLevelToAltitude({
            zoomLevel: maplibreZoomForAltitude,
            latitude: pos.position.latitude,
            tilt: 0,
        });
        const distanceForward = altitude * Math.cos(tiltAbsRad) * Math.tan(tiltAbsRad) * NEGATIVE_TILT_TARGET_DISTANCE_SCALE;
        const target = computeOffset({
            origin: pos.position,
            distance: distanceForward,
            heading: pos.bearing,
        });
        const adjustedZoom = pos.zoom + NEGATIVE_TILT_ZOOM_OFFSET_AT_MAX_TILT * (tiltAbsDeg / 60);

        return {
            center: [target.longitude, target.latitude],
            zoom: ZoomAltitudeConverter.googleZoomToMaplibreZoom(adjustedZoom),
            bearing: pos.bearing,
            tilt: tiltAbsDeg,
        };
    }
}

/**
 * Converts Mappls camera state to a MapConductor MapCameraPosition.
 * Applies the zoom offset: MapConductor zoom = Mappls zoom + 1.
 */
export function toMapCameraPosition({
    center,
    zoom,
    bearing,
    tilt,
    logicalTiltHint = null,
}: {
    center: maplibregl.LngLat;
    zoom: number;
    bearing: number;
    tilt: number;
    logicalTiltHint?: number | null;
}): MapCameraPosition {
    const pitchAbsDeg = Math.min(Math.max(Math.abs(tilt), 0), 60);
    if (logicalTiltHint != null && logicalTiltHint < 0 && pitchAbsDeg > 0) {
        const pitchAbsRad = (pitchAbsDeg * Math.PI) / 180;
        const shiftedCenter = createGeoPoint({ latitude: center.lat, longitude: center.lng });
        const googleZoom = ZoomAltitudeConverter.maplibreZoomToGoogleZoom(zoom);
        const originalGoogleZoom = googleZoom - NEGATIVE_TILT_ZOOM_OFFSET_AT_MAX_TILT * (pitchAbsDeg / 60);
        const originalMaplibreZoom = ZoomAltitudeConverter.googleZoomToMaplibreZoom(originalGoogleZoom);
        const altitude = converter.zoomLevelToAltitude({
            zoomLevel: originalMaplibreZoom,
            latitude: shiftedCenter.latitude,
            tilt: 0,
        });
        const distanceBackward = altitude * Math.cos(pitchAbsRad) * Math.tan(pitchAbsRad) * NEGATIVE_TILT_TARGET_DISTANCE_SCALE;
        const originalPosition = computeOffset({
            origin: shiftedCenter,
            distance: distanceBackward,
            heading: bearing + 180,
        });
        return createMapCameraPosition({
            position: originalPosition,
            zoom: originalGoogleZoom,
            bearing,
            tilt: -pitchAbsDeg,
        });
    }
    return createMapCameraPosition({
        position: createGeoPoint({ latitude: center.lat, longitude: center.lng }),
        zoom: ZoomAltitudeConverter.maplibreZoomToGoogleZoom(zoom),
        bearing,
        tilt,
    });
}
