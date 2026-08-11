import type { AttributionRule, MapDesignTypeInterface } from '@mapconductor/js-sdk-core';

export interface MapplsMapDesignType extends MapDesignTypeInterface<string> {
  /** `mappls.setStyle()` に渡すスタイル名。空文字は「アカウントの既定スタイル」。 */
  readonly styleName: string;
}

/**
 * Mappls のスタイルは URL ではなく**スタイル名**で切り替える
 * （`mapplsClassObject.setStyle(name)`）。使えるスタイル名はアカウントに
 * 紐づいていて、`getStyles()` で実行時に取れる。どのアカウントにも既定スタイルが
 * 1 つ設定されている。android / ios の `MapplsDesign` と同じ形。
 */
export class MapplsDesign implements MapplsMapDesignType {
  readonly id: string;
  readonly styleName: string;
  readonly attributionRules: readonly AttributionRule[];

  constructor(
    id: string,
    styleName: string,
    attributionRules: readonly AttributionRule[] = [],
  ) {
    this.id = id;
    this.styleName = styleName;
    this.attributionRules = attributionRules;
  }

  getValue(): string {
    return `mapDesign_id=${this.id},style=${this.styleName}`;
  }

  /** アカウントの既定スタイル（`setStyle` を呼ばずに SDK に任せる）。 */
  static readonly Default = new MapplsDesign('default', '');

  /**
   * 標準（昼）。どのアカウントにも入っている基本スタイル。
   *
   * これ以外のスタイルは**アカウント紐付き**で、コンソールで割り当てた名前を
   * `new MapplsDesign(id, styleName)` で指定する（存在しない名前は SDK が弾く。
   * 実行時の一覧は `mapplsClassObject.getStyles()`）。
   */
  static readonly StandardDay = new MapplsDesign('standard_day', 'standard_day');
}
