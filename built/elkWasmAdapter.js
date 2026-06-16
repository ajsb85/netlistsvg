"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// elkjs-compatible adapter backed by the elk-rust WebAssembly build.
//
// Drop-in for `import ELK from 'elkjs'`: exposes the subset of the elkjs public
// API that netlist2svg uses — `new ELK()` and `await elk.layout(graph, opts)` —
// on top of the synchronous wasm-bindgen `Elk` class (which takes/returns JSON).
//
// The relative specifier resolves the same from `lib/` (tsc types) and from the
// compiled `built/` output (runtime require), since both sit at the repo root.
const elk_wasm_1 = require("../wasm-eval/elk-wasm/elk_wasm");
class ELK {
    constructor() {
        this.elk = new elk_wasm_1.Elk();
    }
    async layout(graph, opts = {}) {
        var _a;
        const result = this.elk.layout(JSON.stringify(graph), JSON.stringify((_a = opts.layoutOptions) !== null && _a !== void 0 ? _a : {}), '{}');
        return JSON.parse(result);
    }
    async knownLayoutAlgorithms() {
        return JSON.parse(this.elk.knownLayoutAlgorithms());
    }
    async knownLayoutOptions() {
        return JSON.parse(this.elk.knownLayoutOptions());
    }
    async knownLayoutCategories() {
        return JSON.parse(this.elk.knownLayoutCategories());
    }
}
exports.default = ELK;
//# sourceMappingURL=elkWasmAdapter.js.map