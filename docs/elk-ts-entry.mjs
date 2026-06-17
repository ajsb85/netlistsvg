/*
 * elk-ts-entry.mjs — esbuild entry that makes elk-ts the page's layout engine.
 *
 * netlist2svg's renderer calls `new ELK().layout(graph, { layoutOptions })` via the global
 * `window.ELK` (elkjs's shape). This entry replaces that global with an **elk-ts**-backed
 * class: elk-ts is the pure-TypeScript port (typed model, request normalization, `$H`
 * stripping, LRU compute cache, delta protocol), and it uses elkjs underneath only for the
 * raw coordinates — exactly the swap requested.
 *
 * Load order in index.html:
 *   1. elk.bundled.js   → window.ELK = elkjs (the coordinate backend)
 *   2. elk-ts.bundle.js → captures that elkjs, then sets window.ELK = elk-ts wrapper
 *   3. bundle.js        → new ELK() now constructs the elk-ts engine
 *
 * So elkjs is NOT bundled here (kept external); we reuse the one the page already loaded.
 */
import { Elk, ElkjsBackend } from "/home/gbast/elk/elk-rust/elk-ts/dist/index.js";

// The elkjs constructor the page loaded first (elk.bundled.js sets window.ELK).
const ElkjsCtor = window.ELK;
if (typeof ElkjsCtor !== "function") {
  // eslint-disable-next-line no-console
  console.error("[netlist2svg] elk-ts: window.ELK (elkjs) not found — load elk.bundled.js first");
}

class ElkTsEngine {
  constructor() {
    // elk-ts drives the page's elkjs for coordinates; everything else is elk-ts.
    this._elk = new Elk({ backend: new ElkjsBackend({ elk: ElkjsCtor }) });
  }

  /** elkjs-compatible: layout(graph, { layoutOptions }) → laid-out graph. */
  layout(graph, opts) {
    return this._elk.layout({ graph, layoutOptions: (opts && opts.layoutOptions) || {} });
  }

  // elkjs API surface netlist2svg may probe; harmless stubs.
  knownLayoutAlgorithms() { return Promise.resolve([]); }
  knownLayoutOptions() { return Promise.resolve([]); }
  knownLayoutCategories() { return Promise.resolve([]); }
  terminateWorker() {}
}

window.ELK = ElkTsEngine;
window.__ELK_ENGINE__ = "elk-ts";
// eslint-disable-next-line no-console
console.log("[netlist2svg] layout engine: elk-ts (pure-TS port; elkjs backend for coords)");
