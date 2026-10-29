import {
  RasterLayerController,
  RasterLayerManager,
  type RasterHeaderSupport,
} from '@mapconductor/js-sdk-core';
import {
  type MapplsRasterLayerHandle,
  MapplsRasterLayerOverlayRenderer,
} from './MapplsRasterLayerOverlayRenderer';

/**
 * android-sdk の MapplsRasterLayerController と同じく汎用 RasterLayerController の薄い
 * サブクラス。composition/update/has/clear は基底クラスが提供する。GL スタイルが
 * 再読み込みされると既存のソース・レイヤーは失われるため、基底クラスの resync() で
 * 登録済みのラスターレイヤーを貼り直す（android-sdk の reapplyStyle 相当）。
 */
export class MapplsRasterLayerController extends RasterLayerController<MapplsRasterLayerHandle> {
  /**
   * Mappls Map JS のカスタムレイヤは URL しか受け取らない。
   *
   * userAgent はブラウザが上書きを許さないので、どのプロバイダでも web では効かない。
   */
  protected override get headerSupport(): RasterHeaderSupport {
    return { provider: 'Mappls', extraHeaders: false };
  }

  constructor(renderer: MapplsRasterLayerOverlayRenderer) {
    super({ rasterLayerManager: new RasterLayerManager<MapplsRasterLayerHandle>(), renderer });
  }
}
