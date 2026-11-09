import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'tsup';
import { createGeoPoint, createMarkerState } from '@mapconductor/js-sdk-core';

// The Mappls map is on the mapbox-gl v1 line: loadImage(url, callback) returns nothing.
// The renderer awaited it in maplibre's promise form, never passed a callback, and the SDK
// threw "e is not a function" when its fetch finished (a pageerror on every page with a
// marker). This fake has exactly that callback-only signature.
mkdirSync(new URL('../build/', import.meta.url), { recursive: true });
const outDir = mkdtempSync(new URL('../build/marker-icon-tests-', import.meta.url));
after(() => rmSync(outDir, { recursive: true, force: true }));
await build({
    entry: { renderer: 'src/marker/MapplsMarkerOverlayRenderer.ts' },
    outDir, format: ['esm'], platform: 'node', splitting: false,
    dts: false, sourcemap: false, config: false, silent: true,
});
const { MapplsMarkerOverlayRenderer } = await import(pathToFileURL(resolve(outDir, 'renderer.mjs')));

function fixture() {
    const images = new Map();
    const calls = [];
    const map = {
        hasImage: (id) => images.has(id),
        addImage: (id, image) => { images.set(id, image); },
        loadImage(url, callback) {
            calls.push({ url, callbackType: typeof callback });
            setTimeout(() => {
                if (typeof callback !== 'function') return; // the real SDK throws here
                callback(null, { fakeImage: url });
            }, 0);
            return undefined;
        },
    };
    const noLayer = { draw() { return true; }, drawSelected() { return true; }, setIconOffsets() {} };
    const renderer = new MapplsMarkerOverlayRenderer({
        holder: { map },
        markerManager: { allEntities: () => [] },
        markerLayer: noLayer,
        dragLayer: noLayer,
    });
    return { renderer, images, calls };
}

test('marker icons are loaded through the callback form of map.loadImage', async () => {
    const f = fixture();
    const state = createMarkerState({ id: 'M', position: createGeoPoint({ latitude: 35, longitude: 139 }) });
    await f.renderer.onAdd([{ state, bitmapIcon: state.icon?.toBitmapIcon?.() ?? { url: 'data:image/png;base64,' } }]);
    assert.ok(f.calls.length > 0, 'loadImage was used');
    assert.ok(f.calls.every((c) => c.callbackType === 'function'), 'every loadImage call passes a callback');
    assert.deepEqual(f.images.get('mc-default'), { fakeImage: f.calls[0].url }, 'the loaded image is registered');
});
