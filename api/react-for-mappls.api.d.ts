import { MapConfig, GeoRectBounds, MarkerTilingOptions, MapProvider, MapViewControllerInterface, MapViewHolderBase, GeoPointInterface, Offset, GeoPoint, MarkerEntity, AbstractMarkerOverlayRenderer, MarkerManager, AddParams, ChangeParams, MarkerState, BitmapIcon, AbstractMarkerController, RasterLayerState, DefaultMarkerEventController, CircleEntity, AbstractCircleOverlayRenderer, CircleManagerInterface, CircleState, CircleController, PolylineEntity, AbstractPolylineOverlayRenderer, PolylineManagerInterface, PolylineState, PolylineController, MapCameraPosition, PolygonEntity, AbstractPolygonOverlayRenderer, PolygonManagerInterface, PolygonState, SlottedOverlayController, OnPolygonEventHandler, OverlayKind, OverlayHit, AbstractGroundImageOverlayRenderer, GroundImageState, GroundImageEntity, RasterLayerOverlayRenderer, RasterLayerAddParams, RasterLayerChangeParams, RasterLayerEntity, RasterLayerController, RasterHeaderSupport, BaseMapViewController, MarkerCapable, CircleCapable, PolylineCapable, PolygonCapable, GroundImageCapable, RasterLayerCapable, MapUISettings, OnMapInitializedHandler, OnMarkerEventHandler, MarkerAnimationOverlayHost, OnGroundImageEventHandler, MapDesignTypeInterface, AttributionRule, MapViewStateInterface, MapViewState, MapViewBaseProps, WebMercatorZoomAltitudeConverter } from '@mapconductor/js-sdk-core';
import * as maplibregl from 'maplibre-gl';
import React from 'react';

interface MapplsConfig extends MapConfig {
    /** Mappls web API key (from the Mappls console). Required for the map to load. */
    apiKey?: string;
    /**
     * `mappls.setStyle()` に渡すスタイル名。空文字/未指定はアカウントの既定スタイル。
     * （MapplsDesign.styleName がここへ入る）
     */
    styleName?: string;
    maxZoom?: number;
    minZoom?: number;
    /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
    restrictBounds?: GeoRectBounds;
    markerTilingOptions?: MarkerTilingOptions;
}
/**
 * Mappls provider implementation.
 *
 * Bootstraps the base map through the Mappls web SDK (`mappls.Map`), then
 * drives camera / events / overlays through the returned Mapbox-GL 互換マップ
 * — the same renderer architecture as the other MapLibre-family providers.
 * android-for-mappls / ios-for-mappls と同じく、スタイルはアカウント紐付きの
 * スタイル名で、既定スタイルは SDK に任せる。
 */
declare class MapplsProvider extends MapProvider {
    private mapplsMap;
    private container;
    private initToken;
    initialize(config: MapplsConfig): Promise<MapViewControllerInterface>;
    destroy(): void;
    /** Returns true if the rejection was caused by an intentional destroy() call. */
    static isDestroyedBeforeLoad(error: unknown): boolean;
}

declare class MapplsMapViewHolder extends MapViewHolderBase<HTMLElement, maplibregl.Map> {
    readonly mapView: HTMLElement;
    readonly map: maplibregl.Map;
    /** The Mappls web SDK map object that owns (or is) `map`. */
    readonly mapplsMap: unknown;
    private _controller;
    constructor(mapView: HTMLElement, map: maplibregl.Map, 
    /** The Mappls web SDK map object that owns (or is) `map`. */
    mapplsMap: unknown);
    getController(): MapplsViewController | null;
    setController(controller: MapplsViewController): void;
    toScreenOffset(position: GeoPointInterface): Offset;
    fromScreenOffsetSync(offset: Offset): GeoPoint;
}

type Coordinate = [number, number];
type PointFeature = {
    type: 'Feature';
    id?: string | number;
    geometry: {
        type: 'Point';
        coordinates: Coordinate;
    };
    properties: Record<string, unknown>;
};
type LineFeature = {
    type: 'Feature';
    id?: string | number;
    geometry: {
        type: 'LineString';
        coordinates: Coordinate[];
    };
    properties: Record<string, unknown>;
};
type PolygonFeature = {
    type: 'Feature';
    geometry: {
        type: 'Polygon';
        coordinates: Coordinate[][];
    };
    properties: Record<string, unknown>;
};
type FeatureCollection = {
    type: 'FeatureCollection';
    features: Array<PointFeature | LineFeature | PolygonFeature>;
};

type MapplsActualMarker = PointFeature;
declare class MarkerLayer {
    protected readonly holder: MapplsMapViewHolder;
    protected readonly canEditStyle: () => boolean;
    readonly sourceId: string;
    readonly layerId: string;
    constructor({ holder, canEditStyle, sourceId, layerId, }: {
        holder: MapplsMapViewHolder;
        canEditStyle: () => boolean;
        sourceId: string;
        layerId: string;
    });
    draw(entities: MarkerEntity<MapplsActualMarker>[]): boolean;
    ensureStyleResources(): boolean;
    protected setData(data: FeatureCollection): boolean;
    setIconOffsets(offsets: ReadonlyMap<string, [number, number]>, fallback: [number, number]): void;
}

declare class MarkerDragLayer extends MarkerLayer {
    selected: MarkerEntity<MapplsActualMarker> | null;
    constructor({ holder, canEditStyle, sourceId, layerId, }: {
        holder: MapplsMapViewHolder;
        canEditStyle: () => boolean;
        sourceId: string;
        layerId: string;
    });
    updatePosition(position: GeoPoint): boolean;
    drawSelected(): boolean;
}

declare class MapplsMarkerOverlayRenderer extends AbstractMarkerOverlayRenderer<MapplsMapViewHolder, MapplsActualMarker> {
    private readonly defaultMarkerIcon;
    private readonly iconRefCounter;
    private readonly iconBitmaps;
    private readonly pendingImageRemovals;
    readonly markerManager: MarkerManager<MapplsActualMarker>;
    readonly markerLayer: MarkerLayer;
    readonly dragLayer: MarkerDragLayer;
    constructor({ holder, markerManager, markerLayer, dragLayer, }: {
        holder: MapplsMapViewHolder;
        markerManager: MarkerManager<MapplsActualMarker>;
        markerLayer: MarkerLayer;
        dragLayer: MarkerDragLayer;
    });
    onAdd(data: AddParams[]): Promise<(MapplsActualMarker | null)[]>;
    onChange(data: ChangeParams<MapplsActualMarker>[]): Promise<(MapplsActualMarker | null)[]>;
    onRemove(data: MarkerEntity<MapplsActualMarker>[]): Promise<void>;
    onPostProcess(): Promise<void>;
    setMarkerVisible(entity: MarkerEntity<MapplsActualMarker>, visible: boolean): void;
    setMarkerPosition(entity: MarkerEntity<MapplsActualMarker>, position: GeoPoint): void;
    updateSelectedMarker({ entity, state, bitmapIcon, }: {
        entity: MarkerEntity<MapplsActualMarker>;
        state: MarkerState;
        bitmapIcon: BitmapIcon;
    }): Promise<void>;
    drawDragLayer(): void;
    redraw(): void;
    resync(): Promise<void>;
    private createMarkerFeature;
    private retainIcon;
    private releaseIcon;
    private customIconKey;
    private ensureImages;
    private ensureImage;
    private loadBitmapIcon;
    private ensureFallbackDefaultIcon;
    private removeUnusedImages;
    private syncIconOffsets;
    buildEntity(marker: MapplsActualMarker, state: MarkerState): MarkerEntity<MapplsActualMarker>;
}

declare class MapplsMarkerController extends AbstractMarkerController<MapplsActualMarker> {
    private readonly holder;
    readonly renderer: MapplsMarkerOverlayRenderer;
    private selected;
    private pendingSelectedPosition;
    private selectedPositionFrame;
    private readonly tilingOptions;
    private tileRenderer;
    private tileRouteId;
    private tileVersion;
    private tileGeneration;
    /** Called by MapplsViewController when RasterLayerState changes. */
    onRasterLayerUpdate: ((state: RasterLayerState | null) => Promise<void>) | null;
    constructor(holder: MapplsMapViewHolder, renderer: MapplsMarkerOverlayRenderer, tilingOptions?: MarkerTilingOptions);
    protected shouldTile(state: MarkerState, totalCount: number): boolean;
    protected onTiledMarkersChanged(): Promise<void>;
    private syncTiledOverlay;
    private serviceWorkerTileTemplate;
    private localTileTemplate;
    private removeTileOverlay;
    composition(data: MarkerState[]): Promise<void>;
    find(position: GeoPoint): MarkerEntity<MapplsActualMarker> | null;
    /**
     * Find the marker nearest to `position` at the given zoom level.
     * Handles both regular markers (icon-bounds check) and tiled markers (geographic radius).
     * Mirrors Android's `GoogleMapMarkerController.find(position, zoom)`.
     */
    findWithZoom(position: GeoPoint, zoom: number, pointerType: 'touch' | 'mouse'): MarkerEntity<MapplsActualMarker> | null;
    update(state: MarkerState): Promise<void>;
    has(state: MarkerState): boolean;
    getSelectedMarker(): MarkerEntity<MapplsActualMarker> | null;
    setSelectedMarker(entity: MarkerEntity<MapplsActualMarker> | null): Promise<void>;
    updateSelectedPosition(position: GeoPoint): void;
    resync(): Promise<void>;
    clear(): Promise<void>;
    destroy(): void;
    private flushSelectedPosition;
    private cancelSelectedPositionFrame;
    private hasCompositionChanges;
}

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
declare class MapplsMarkerEventController extends DefaultMarkerEventController<MapplsActualMarker> {
    constructor(controller: MapplsMarkerController);
}

type MapplsActualCircle = PolygonFeature & {
    id?: string | number;
};
declare class MapplsCircleLayer {
    static readonly Prop: {
        readonly FILL_COLOR: "fillColor";
        readonly STROKE_COLOR: "strokeColor";
        readonly STROKE_WIDTH: "strokeWidth";
        readonly Z_INDEX: "zIndex";
    };
    private readonly holder;
    private readonly canEditStyle;
    readonly sourceId: string;
    readonly layerId: string;
    readonly strokeLayerId: string;
    constructor({ holder, canEditStyle, sourceId, layerId, }: {
        holder: MapplsMapViewHolder;
        canEditStyle: () => boolean;
        sourceId?: string;
        layerId?: string;
    });
    draw(entities: CircleEntity<MapplsActualCircle>[]): boolean;
    private ensureStyleResources;
}

declare class MapplsCircleOverlayRenderer extends AbstractCircleOverlayRenderer<MapplsMapViewHolder, MapplsActualCircle> {
    readonly layer: MapplsCircleLayer;
    readonly circleManager: CircleManagerInterface<MapplsActualCircle>;
    constructor({ layer, circleManager, holder, }: {
        layer: MapplsCircleLayer;
        circleManager: CircleManagerInterface<MapplsActualCircle>;
        holder: MapplsMapViewHolder;
    });
    createCircle(state: CircleState): Promise<MapplsActualCircle | null>;
    updateCircleProperties({ current, }: {
        circle: MapplsActualCircle;
        current: CircleEntity<MapplsActualCircle>;
        prev: CircleEntity<MapplsActualCircle>;
    }): Promise<MapplsActualCircle | null>;
    removeCircle(_entity: CircleEntity<MapplsActualCircle>): Promise<void>;
    onPostProcess(): Promise<void>;
    redraw(): Promise<void>;
}

declare class MapplsCircleController extends CircleController<MapplsActualCircle> {
    readonly renderer: MapplsCircleOverlayRenderer;
    constructor(renderer: MapplsCircleOverlayRenderer);
    update(state: CircleState): Promise<void>;
    resync(): Promise<void>;
    clear(): Promise<void>;
    /**
     * Hit-test a map click (its lat/lng) against the circles geometrically (inside
     * the fill radius) and dispatch the click on the matching circle. Does NOT use
     * a Mappls layer/overlay click event — detection is driven by the map click
     * position, matching the marker/polyline paths and android. Returns true if hit.
     */
    handleMapClick(clicked: GeoPoint): boolean;
}

type MapplsActualPolyline = LineFeature[];
declare class MapplsPolylineLayer {
    static readonly Prop: {
        readonly STROKE_COLOR: "strokeColor";
        readonly STROKE_WIDTH: "strokeWidth";
        readonly Z_INDEX: "zIndex";
    };
    private readonly holder;
    private readonly canEditStyle;
    readonly sourceId: string;
    readonly layerId: string;
    constructor({ holder, canEditStyle, sourceId, layerId, }: {
        holder: MapplsMapViewHolder;
        canEditStyle: () => boolean;
        sourceId?: string;
        layerId?: string;
    });
    draw(entities: PolylineEntity<MapplsActualPolyline>[]): boolean;
    private ensureStyleResources;
}

declare class MapplsPolylineOverlayRenderer extends AbstractPolylineOverlayRenderer<MapplsMapViewHolder, MapplsActualPolyline> {
    readonly layer: MapplsPolylineLayer;
    readonly polylineManager: PolylineManagerInterface<MapplsActualPolyline>;
    constructor({ layer, polylineManager, holder, }: {
        layer: MapplsPolylineLayer;
        polylineManager: PolylineManagerInterface<MapplsActualPolyline>;
        holder: MapplsMapViewHolder;
    });
    createPolyline(state: PolylineState): Promise<MapplsActualPolyline | null>;
    updatePolylineProperties({ current, }: {
        polyline: MapplsActualPolyline;
        current: PolylineEntity<MapplsActualPolyline>;
        prev: PolylineEntity<MapplsActualPolyline>;
    }): Promise<MapplsActualPolyline | null>;
    removePolyline(_entity: PolylineEntity<MapplsActualPolyline>): Promise<void>;
    onPostProcess(): Promise<void>;
    redraw(): Promise<void>;
    private resolveZIndex;
}

declare class MapplsPolylineController extends PolylineController<MapplsActualPolyline> {
    readonly renderer: MapplsPolylineOverlayRenderer;
    constructor(renderer: MapplsPolylineOverlayRenderer);
    resync(): Promise<void>;
    clear(): Promise<void>;
    /**
     * Hit-test a map click (its lat/lng) against the polylines geometrically and,
     * if the click lands within the tap tolerance of a line, dispatch the click on
     * the nearest polyline (with the closest point on that line as `clicked`).
     *
     * This intentionally does NOT use a Mappls layer/overlay click event. Like
     * android (`TomTomMapViewController.onPolylineClickedInternal`) and the marker
     * path, the hit is derived from the map click position, so behaviour matches
     * across providers. Returns true if a polyline was hit (so the caller can
     * suppress the generic map click).
     */
    handleMapClick(clicked: GeoPoint, camera: MapCameraPosition | null): boolean;
}

interface MapplsActualPolygon {
    readonly fillFeatures: PolygonFeature[];
    readonly outlineFeatures: LineFeature[];
}
declare class MapplsPolygonLayer {
    static readonly Prop: {
        readonly FILL_COLOR: "fillColor";
        readonly STROKE_COLOR: "strokeColor";
        readonly STROKE_WIDTH: "strokeWidth";
        readonly Z_INDEX: "zIndex";
    };
    private readonly holder;
    private readonly canEditStyle;
    readonly sourceId: string;
    readonly layerId: string;
    readonly outlineSourceId: string;
    readonly outlineLayerId: string;
    constructor({ holder, canEditStyle, sourceId, layerId, outlineSourceId, outlineLayerId, }: {
        holder: MapplsMapViewHolder;
        canEditStyle: () => boolean;
        sourceId?: string;
        layerId?: string;
        outlineSourceId?: string;
        outlineLayerId?: string;
    });
    draw(entities: PolygonEntity<MapplsActualPolygon>[]): boolean;
    private ensureStyleResources;
}

declare class MapplsPolygonOverlayRenderer extends AbstractPolygonOverlayRenderer<MapplsMapViewHolder, MapplsActualPolygon> {
    readonly layer: MapplsPolygonLayer;
    readonly polygonManager: PolygonManagerInterface<MapplsActualPolygon>;
    constructor({ layer, polygonManager, holder, }: {
        layer: MapplsPolygonLayer;
        polygonManager: PolygonManagerInterface<MapplsActualPolygon>;
        holder: MapplsMapViewHolder;
    });
    createPolygon(state: PolygonState): Promise<MapplsActualPolygon | null>;
    updatePolygonProperties({ current, }: {
        polygon: MapplsActualPolygon;
        current: PolygonEntity<MapplsActualPolygon>;
        prev: PolygonEntity<MapplsActualPolygon>;
    }): Promise<MapplsActualPolygon | null>;
    removePolygon(_entity: PolygonEntity<MapplsActualPolygon>): Promise<void>;
    onPostProcess(): Promise<void>;
}

declare class MapplsPolygonConductor implements SlottedOverlayController {
    readonly polygonOverlay: MapplsPolygonOverlayRenderer;
    clickListener: OnPolygonEventHandler | null;
    private operation;
    constructor(polygonOverlay: MapplsPolygonOverlayRenderer);
    composition(data: PolygonState[]): Promise<void>;
    update(state: PolygonState): Promise<void>;
    has(state: PolygonState): boolean;
    resync(): Promise<void>;
    clear(): Promise<void>;
    private redraw;
    /**
     * Hit-test a map click (its lat/lng) against the polygons geometrically
     * (point-in-polygon, honouring holes and zIndex) and dispatch the click on the
     * top-most polygon that contains the point. Does NOT use a Mappls
     * layer/overlay click event — detection is driven by the map click position,
     * matching the marker/polyline paths and android. Returns true if hit.
     */
    handleMapClick(clicked: GeoPoint): boolean;
    private enqueue;
    readonly kind: OverlayKind;
    hasId(id: string): boolean;
    compositionAny(data: unknown[]): Promise<void>;
    updateAny(state: unknown): Promise<void>;
    setClickListenerAny(listener: unknown): void;
    /**
     * タップの当たり判定と配送。カスケードの 1 段（{@link OverlayHitResolver}）。
     * 判定は既存の handleMapClick と同じ（point-in-polygon、穴と zIndex を考慮）。
     */
    resolveTap(position: GeoPointInterface): OverlayHit | null;
}

declare class MapplsGroundImageOverlayRenderer extends AbstractGroundImageOverlayRenderer<MapplsMapViewHolder, string> {
    private readonly canEditStyle;
    /** Last values applied to the map style, keyed by state id. */
    private readonly applied;
    constructor({ holder, canEditStyle, }: {
        holder: MapplsMapViewHolder;
        canEditStyle: () => boolean;
    });
    sourceId(id: string): string;
    layerId(id: string): string;
    createGroundImage(state: GroundImageState): Promise<string | null>;
    updateGroundImageProperties({ current, }: {
        groundImage: string;
        current: GroundImageEntity<string>;
        prev: GroundImageEntity<string>;
    }): Promise<string | null>;
    /** Sync an already-created image source+layer to the current state (diffed). */
    private applyToExisting;
    removeGroundImage(entity: GroundImageEntity<string>): Promise<void>;
}

declare class MapplsGroundImageController implements SlottedOverlayController {
    private readonly groundImageStates;
    private readonly groundImageIds;
    private readonly pendingUpdates;
    private readonly renderer;
    private updateFrame;
    constructor(renderer: MapplsGroundImageOverlayRenderer);
    composition(data: GroundImageState[]): void;
    update(state: GroundImageState): void;
    has(state: GroundImageState): boolean;
    hasClickableAt(point: GeoPoint): boolean;
    dispatchClick(point: GeoPoint): boolean;
    resync(): void;
    clear(): void;
    private cancelPendingUpdates;
    private upsert;
    private removeById;
    readonly kind: OverlayKind;
    hasId(id: string): boolean;
    compositionAny(data: unknown[]): Promise<void>;
    updateAny(state: unknown): Promise<void>;
    setClickListenerAny(_listener: unknown): void;
    /**
     * タップの当たり判定と配送。カスケードの 1 段（{@link OverlayHitResolver}）。
     * 判定は既存の dispatchClick と同じ（後ろに追加したものから見る = 上に載る方が先）。
     */
    resolveTap(position: GeoPointInterface): OverlayHit | null;
}

/** GL のソース／レイヤー ID の対。android-sdk の MapplsRasterLayerHandle と同一。 */
interface MapplsRasterLayerHandle {
    readonly sourceId: string;
    readonly layerId: string;
}
/**
 * android-sdk と同じく汎用 RasterLayerController が駆動する OverlayRenderer 実装。
 * onAdd/onChange/onRemove でネイティブ GL のソース・レイヤーを操作する。スタイルが
 * まだ編集できない場合はハンドルだけ返し、スタイル (再)読み込み後に controller.resync()
 * で貼り直す。
 */
declare class MapplsRasterLayerOverlayRenderer implements RasterLayerOverlayRenderer<MapplsRasterLayerHandle> {
    readonly holder: MapplsMapViewHolder;
    private readonly canEditStyle;
    constructor(holder: MapplsMapViewHolder, canEditStyle: () => boolean);
    private sourceId;
    private layerId;
    onAdd(data: RasterLayerAddParams[]): Promise<(MapplsRasterLayerHandle | null)[]>;
    onChange(data: RasterLayerChangeParams<MapplsRasterLayerHandle>[]): Promise<(MapplsRasterLayerHandle | null)[]>;
    onRemove(data: RasterLayerEntity<MapplsRasterLayerHandle>[]): Promise<void>;
    onCameraChanged(_mapCameraPosition: MapCameraPosition): Promise<void>;
    onPostProcess(): Promise<void>;
    private addLayer;
    private updateLayer;
    /**
     * スタイル再読込中に頼まれた削除の保留分。
     *
     * 追加は「ハンドルだけ返して resync が貼り直す」で済むが、削除は manager から
     * 先に消えるため resync では拾えない。黙って捨てると、スタイル差分適用で
     * 生き残った GL レイヤが画面に残り続ける（RasterLayer ページで選んだレリーフが
     * GeoJSON Layer ページにも出る、という形で顕在化した）。ここで保留しておき、
     * スタイルが編集可能になった最初の操作でまとめて消す。
     */
    private pendingRemovals;
    private flushPendingRemovals;
    private removeLayer;
}

/**
 * android-sdk の MapplsRasterLayerController と同じく汎用 RasterLayerController の薄い
 * サブクラス。composition/update/has/clear は基底クラスが提供する。GL スタイルが
 * 再読み込みされると既存のソース・レイヤーは失われるため、resync() で登録済みの
 * ラスターレイヤーを貼り直す（android-sdk の reapplyStyle 相当）。
 */
declare class MapplsRasterLayerController extends RasterLayerController<MapplsRasterLayerHandle> {
    /**
     * Mappls Map JS のカスタムレイヤは URL しか受け取らない。
     *
     * userAgent はブラウザが上書きを許さないので、どのプロバイダでも web では効かない。
     */
    protected get headerSupport(): RasterHeaderSupport;
    constructor(renderer: MapplsRasterLayerOverlayRenderer);
    resync(): Promise<void>;
}

declare class MapplsViewController extends BaseMapViewController implements MapViewControllerInterface, MarkerCapable, CircleCapable, PolylineCapable, PolygonCapable, GroundImageCapable, RasterLayerCapable {
    private readonly mapInstance;
    private initialized;
    private logicalTiltHint;
    private readonly styleReadyRef;
    readonly holder: MapplsMapViewHolder;
    private readonly markerController;
    private readonly markerEventController;
    private groundImagePointerDown;
    private skipNextGroundImageClick;
    private readonly circleController;
    private readonly polylineController;
    private readonly polygonController;
    private readonly groundImageController;
    private readonly rasterLayerController;
    constructor(holder: MapplsMapViewHolder, markerController: MapplsMarkerController, markerEventController: MapplsMarkerEventController, circleController: MapplsCircleController, polylineController: MapplsPolylineController, polygonController: MapplsPolygonConductor, groundImageController: MapplsGroundImageController, rasterLayerController: MapplsRasterLayerController, styleReadyRef?: {
        current: boolean;
    }, logicalTiltHint?: number | null);
    getMap(): maplibregl.Map;
    /**
     * Mappls の Map は Mapbox GL 互換なので、ジェスチャは GL 側のハンドラで
     * そのまま制御できる（Longdo のような Ui.Mouse の中間層は無い）。
     */
    applyUISettings(settings: MapUISettings): void;
    private setupEventListeners;
    setMapInitializedListener(listener: OnMapInitializedHandler | null): void;
    moveCamera(position: MapCameraPosition): Promise<boolean>;
    animateCamera(position: MapCameraPosition, durationMillis: number): Promise<boolean>;
    fitBounds(bounds: GeoRectBounds, padding: number): Promise<boolean>;
    getCameraPosition(): MapCameraPosition | null;
    /**
     * Projects the four screen corners of the map viewport back to geo
     * coordinates via `fromScreenOffsetSync` and extends a bounds from them,
     * instead of using `map.getBounds()`'s axis-aligned box — this stays
     * correct when the map is rotated. Mirrors Android's
     * `MapplsViewControllerImpl.getMapCameraPosition()`.
     */
    private getVisibleRegion;
    compositionMarkers(data: MarkerState[]): Promise<void>;
    updateMarker(state: MarkerState): Promise<void>;
    setOnMarkerClickListener(_listener: OnMarkerEventHandler | null): void;
    setOnMarkerDragStart(_listener: OnMarkerEventHandler | null): void;
    setOnMarkerDrag(_listener: OnMarkerEventHandler | null): void;
    setOnMarkerDragEnd(_listener: OnMarkerEventHandler | null): void;
    setOnMarkerAnimateStart(_listener: OnMarkerEventHandler | null): void;
    setOnMarkerAnimateEnd(_listener: OnMarkerEventHandler | null): void;
    setMarkerAnimationOverlayHost(host: MarkerAnimationOverlayHost | null): void;
    setOnGroundImageClickListener(_listener: OnGroundImageEventHandler | null): void;
    clearOverlays(): Promise<void>;
    destroy(): void;
    /**
     * マーカーのヒットテストと配送。カスケードの先頭。
     *
     * ズームとポインタ種別（タッチかマウスかで許容半径が変わる）が要るので
     * コアの既定ではなくここで持つ。判定自体は core の MarkerManager。
     */
    protected dispatchMarkerTap(point: GeoPoint): boolean;
}

interface MapplsMapDesignType extends MapDesignTypeInterface<string> {
    /** `mappls.setStyle()` に渡すスタイル名。空文字は「アカウントの既定スタイル」。 */
    readonly styleName: string;
}
/**
 * Mappls のスタイルは URL ではなく**スタイル名**で切り替える
 * （`mapplsClassObject.setStyle(name)`）。使えるスタイル名はアカウントに
 * 紐づいていて、`getStyles()` で実行時に取れる。どのアカウントにも既定スタイルが
 * 1 つ設定されている。android / ios の `MapplsDesign` と同じ形。
 */
declare class MapplsDesign implements MapplsMapDesignType {
    readonly id: string;
    readonly styleName: string;
    readonly attributionRules: readonly AttributionRule[];
    constructor(id: string, styleName: string, attributionRules?: readonly AttributionRule[]);
    getValue(): string;
    /** アカウントの既定スタイル（`setStyle` を呼ばずに SDK に任せる）。 */
    static readonly Default: MapplsDesign;
    /**
     * 標準（昼）。どのアカウントにも入っている基本スタイル。
     *
     * これ以外のスタイルは**契約に紐づく**。コンソールで割り当てた名前を
     * `new MapplsDesign(id, styleName)` で指定する（契約に無い名前は SDK が弾く。
     * 実行時の一覧は `mapplsClassObject.getStyles()`）。
     */
    static readonly StandardDay: MapplsDesign;
    /**
     * 標準（夜）。**追加料金の有料オプション**。
     *
     * 契約に含まれていないアカウントでは `setStyle` が弾くため、このリポジトリの
     * サンプルでは選択肢に出していない（サンプルは追加料金を払っていない）。
     * ライブラリとしては、契約済みのアプリがそのまま使えるよう公開しておく。
     */
    static readonly StandardNight: MapplsDesign;
    /** グレー（昼）。**追加料金の有料オプション**。{@link StandardNight} と同じ扱い。 */
    static readonly GreyDay: MapplsDesign;
}

interface MapplsViewStateInterface extends MapViewStateInterface<MapplsMapDesignType> {
    /** Mappls Cloud API key used to load the style/tiles. */
    readonly apiKey: string;
}
interface MapplsViewStateParams {
    id?: string;
    /** Mappls Cloud API key. Required for the map/tiles to load. */
    apiKey?: string;
    mapDesignType?: MapplsMapDesignType;
    cameraPosition?: MapCameraPosition;
}
declare class MapplsViewState extends MapViewState<MapplsMapDesignType> implements MapplsViewStateInterface {
    readonly apiKey: string;
    private _mapDesignType;
    constructor({ id, apiKey, mapDesignType, cameraPosition, }?: MapplsViewStateParams);
    get mapDesignType(): MapplsMapDesignType;
    set mapDesignType(value: MapplsMapDesignType);
}
declare function useMapplsViewState(params?: MapplsViewStateParams): MapplsViewStateInterface;

interface MapplsMapViewProps extends MapViewBaseProps<MapplsViewStateInterface> {
    maxZoom?: number;
    minZoom?: number;
    /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
    restrictBounds?: GeoRectBounds;
    containerStyle?: React.CSSProperties;
    onError?: (error: Error) => void;
    children?: React.ReactNode;
    markerTilingOptions?: MarkerTilingOptions;
}
declare function MapplsMapView(props: MapplsMapViewProps): React.JSX.Element;
declare function MapplsMapView2D(props: MapplsMapViewProps): React.JSX.Element;

/**
 * 統一ズーム（Google Maps 基準・256px タイル）⇄ 高度の変換。
 *
 * 換算式はコアの {@link WebMercatorZoomAltitudeConverter} にある。
 */
declare class ZoomAltitudeConverter extends WebMercatorZoomAltitudeConverter {
    /** Empirical offset: GoogleZoom ≈ MapplsSDK.zoom + 1.0 */
    static readonly MAPLIBRE_TO_GOOGLE_ZOOM_OFFSET = 1;
    constructor(zoom0Altitude?: number);
    static maplibreZoomToGoogleZoom(maplibreZoom: number): number;
    static googleZoomToMaplibreZoom(googleZoom: number): number;
}

/**
 * Mappls (MapmyIndia) web SDK のロードとマップ生成。
 *
 * npm の `mappls-web-maps` は本体スクリプト
 * (`apis.mappls.com/advancedmaps/api/<key>/map_sdk?...&v=3.0`) を注入する薄い
 * ローダで、`initialize(key, loadObject, cb)` の callback で `window.mappls`
 * が使えるようになる。`Map({ id, properties })` が返すオブジェクトは
 * Mapbox GL ベースの地図で、`addSource` / `project` などの GL API を持つ
 * — mirroring android-for-mappls (Mapbox GL Android fork) と ios-for-mappls。
 *
 * 注意: Mappls の**ラッパー API は center を [lat, lng] 順**で受け取る
 * （GL の LngLat と逆）。このプロバイダはブート時の `properties.center` だけ
 * ラッパーへ渡し、以後のカメラ操作・投影はすべて GL API で行うので、
 * 混在による取り違えはブートの 1 箇所に閉じている。
 */
interface MapplsNamespace {
    Map: (props: {
        id: string | HTMLElement;
        properties?: Record<string, unknown>;
    }) => unknown;
    [key: string]: unknown;
}
/**
 * Mappls web SDK を一度だけロードして `window.mappls` を返す。
 * React StrictMode の二重マウントでも二重ロードしない（module-level memo）。
 */
declare function loadMappls(apiKey: string): Promise<MapplsNamespace>;

export { type MapplsConfig, MapplsDesign, type MapplsMapDesignType, MapplsMapView, MapplsMapView2D, type MapplsMapViewProps, MapplsProvider, MapplsViewController, MapplsViewState, type MapplsViewStateInterface, ZoomAltitudeConverter, loadMappls, useMapplsViewState };
