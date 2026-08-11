import type * as maplibregl from 'maplibre-gl';
import { mappls as MapplsLoader } from 'mappls-web-maps';

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
export interface MapplsNamespace {
  Map: (props: { id: string | HTMLElement; properties?: Record<string, unknown> }) => unknown;
  [key: string]: unknown;
}

// `Window.mappls` は mappls-web-maps の d.ts が `any` で宣言済み。
function mapplsGlobal(): MapplsNamespace | undefined {
  const ns = (window as { mappls?: unknown }).mappls as MapplsNamespace | undefined;
  return ns && typeof ns.Map === 'function' ? ns : undefined;
}

let loaderInstance: MapplsLoader | null = null;
let loadPromise: Promise<MapplsNamespace> | null = null;

/**
 * Mappls web SDK を一度だけロードして `window.mappls` を返す。
 * React StrictMode の二重マウントでも二重ロードしない（module-level memo）。
 */
export function loadMappls(apiKey: string): Promise<MapplsNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Mappls Map can only be loaded in a browser environment'));
  }
  const existing = mapplsGlobal();
  if (existing) {
    return Promise.resolve(existing);
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<MapplsNamespace>((resolve, reject) => {
    try {
      loaderInstance = loaderInstance ?? new MapplsLoader();
      loaderInstance.initialize(apiKey, { map: true, version: '3.0' }, () => {
        const ns = mapplsGlobal();
        if (ns) {
          resolve(ns);
        } else {
          loadPromise = null;
          reject(new Error('Mappls SDK loaded but window.mappls.Map is unavailable (check the API key)'));
        }
      });
    } catch (error) {
      loadPromise = null;
      reject(error instanceof Error ? error : new Error('Failed to load the Mappls SDK'));
    }
  });

  return loadPromise;
}

/**
 * `mappls.Map()` の戻り値から GL 互換マップを取り出し、スタイルの読み込み完了を
 * 待って返す。戻り値そのものが GL マップである版と、`.map` に持つ版の両方に
 * 備えてプローブする（SDK はバージョンで内部構造が変わるため）。
 */
export function waitForGlMap(mapplsMap: unknown, timeoutMs = 20000): Promise<maplibregl.Map> {
  return new Promise<maplibregl.Map>((resolve, reject) => {
    const started = Date.now();
    let settled = false;

    const resolveGl = (): maplibregl.Map | null => {
      const candidates = [mapplsMap, (mapplsMap as { map?: unknown })?.map];
      for (const candidate of candidates) {
        if (
          candidate &&
          typeof (candidate as maplibregl.Map).addSource === 'function' &&
          typeof (candidate as maplibregl.Map).project === 'function'
        ) {
          return candidate as maplibregl.Map;
        }
      }
      return null;
    };

    const finish = (gl: maplibregl.Map) => {
      if (settled) return;
      if (typeof gl.isStyleLoaded === 'function' && gl.isStyleLoaded()) {
        settled = true;
        resolve(gl);
        return;
      }
      const done = () => {
        if (settled) return;
        settled = true;
        gl.off?.('idle', done);
        gl.off?.('load', done);
        resolve(gl);
      };
      gl.on?.('load', done);
      gl.on?.('idle', done);
      setTimeout(done, 8000);
    };

    const poll = () => {
      if (settled) return;
      const gl = resolveGl();
      if (gl) {
        finish(gl);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Timed out waiting for the Mappls map to initialize'));
        return;
      }
      setTimeout(poll, 50);
    };
    poll();
  });
}
