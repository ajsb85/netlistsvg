// elk-wasm-browser.js — provides `window.ELK` backed by the elk-rust WebAssembly
// build (web target), a drop-in for the elkjs `elk.bundled.js` the demo used to load.
//
// The demo's bundle.js maps `require('elkjs')` to `window.ELK`, so setting that global
// to an elkjs-compatible class (new ELK() + async layout()) swaps the layout engine
// without rebuilding the demo. This classic script runs before bundle.js and sets the
// class synchronously; the wasm is initialized lazily (the first layout() awaits it).
(() => {
  const ready = import('./elk-wasm-web/elk_wasm.js').then(async (mod) => {
    await mod.default(); // __wbg_init: fetch + instantiate elk_wasm_bg.wasm
    return new mod.Elk(); // one instance, reused (algorithms register at construction)
  });

  const parse = (s) => JSON.parse(s);

  window.ELK = class {
    async layout(graph, opts = {}) {
      const elk = await ready;
      return parse(
        elk.layout(JSON.stringify(graph), JSON.stringify(opts.layoutOptions || {}), '{}'),
      );
    }
    async knownLayoutAlgorithms() {
      return parse((await ready).knownLayoutAlgorithms());
    }
    async knownLayoutOptions() {
      return parse((await ready).knownLayoutOptions());
    }
    async knownLayoutCategories() {
      return parse((await ready).knownLayoutCategories());
    }
  };

  // Surface init failures in the console / page (the demo shows a toast on render error).
  ready.catch((err) => console.error('[elk-wasm] init failed:', err));
})();
