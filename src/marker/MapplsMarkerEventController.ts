import { DefaultMarkerEventController, type MarkerEventHost } from '@mapconductor/js-sdk-core';
import { MapplsMarkerController } from './MapplsMarkerController';
import { type MapplsActualMarker } from './MarkerLayer';

/**
 * Mappls のマーカーイベント。
 *
 * ドラッグの状態遷移・パン抑止・リスナー転送はすべてコアの
 * {@link DefaultMarkerEventController} が持つ。ここに残るのは
 * **Mappls 固有のもの**だけ——いまは何も無い。
 *
 * 移行前はこのファイルが 165 行あり、maplibre / mapbox / maptiler / tomtom / mappls の
 * 5 本が**型名以外 1 文字も違わなかった**。
 */
export class MapplsMarkerEventController extends DefaultMarkerEventController<MapplsActualMarker> {
    constructor(controller: MapplsMarkerController) {
        super(controller as unknown as MarkerEventHost<MapplsActualMarker>);
    }
}
