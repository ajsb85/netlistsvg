// elkjs-compatible adapter backed by the elk-rust WebAssembly build.
//
// Drop-in for `import ELK from 'elkjs'`: exposes the subset of the elkjs public
// API that netlist2svg uses — `new ELK()` and `await elk.layout(graph, opts)` —
// on top of the synchronous wasm-bindgen `Elk` class (which takes/returns JSON).
//
// The relative specifier resolves the same from `lib/` (tsc types) and from the
// compiled `built/` output (runtime require), since both sit at the repo root.
import { Elk as WasmElk } from '../wasm-eval/elk-wasm/elk_wasm';

interface LayoutOptions {
  layoutOptions?: Record<string, unknown>;
  // elkjs also accepts logging / measureExecutionTime; netlist2svg passes neither.
}

export default class ELK {
  private elk: WasmElk;

  constructor() {
    this.elk = new WasmElk();
  }

  async layout(graph: unknown, opts: LayoutOptions = {}): Promise<unknown> {
    const result = this.elk.layout(
      JSON.stringify(graph),
      JSON.stringify(opts.layoutOptions ?? {}),
      '{}',
    );
    return JSON.parse(result);
  }

  async knownLayoutAlgorithms(): Promise<unknown> {
    return JSON.parse(this.elk.knownLayoutAlgorithms());
  }
  async knownLayoutOptions(): Promise<unknown> {
    return JSON.parse(this.elk.knownLayoutOptions());
  }
  async knownLayoutCategories(): Promise<unknown> {
    return JSON.parse(this.elk.knownLayoutCategories());
  }
}
