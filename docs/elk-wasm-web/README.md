# elk-wasm

The WASM entry point for the pure-Rust port of the elkjs Java layer. It exposes
the Eclipse Layout Kernel's worker protocol (the same `cmd`-based messages that
`elkjs`'s `elk-api.js` speaks) backed by Rust compiled to WebAssembly — a
drop-in replacement for the GWT-compiled `elk-worker.js`.

## What it provides

- `Dispatcher` (pure Rust): ports `ElkJs.layout` + `optsToCfg` and the
  `algorithms`/`options`/`categories`/`register` commands. Host-testable.
- `wasm_api::Elk` (`#[cfg(target_arch = "wasm32")]`): the `wasm-bindgen` class
  with `layout`, `knownLayoutAlgorithms`, `knownLayoutOptions`,
  `knownLayoutCategories`. All registered algorithms are wired in at construction.
- `js/elk-worker.mjs`: the JS worker shim (`makeDispatch` / `makeFakeWorker` /
  `installWorker`) implementing elkjs's 5-command postMessage protocol over `Elk`.

## Build

```sh
# Browser (ESM, async init):
wasm-pack build --target web --release            # → pkg/

# Node (CommonJS-style, sync require/import):
wasm-pack build --target nodejs --release --out-dir pkg-node   # → pkg-node/
```

Release `.wasm` is ~246 KB (dev ~937 KB); both `pkg/` and `pkg-node/` are
generated artifacts.

## Use (Node, via the worker shim)

```js
import { Elk } from './pkg-node/elk_wasm.js';
import { makeFakeWorker } from './js/elk-worker.mjs';

// Plug into elkjs's elk-api.js via its workerFactory, or drive directly:
const Worker = makeFakeWorker(Elk);
// ... elk-api.js's PromisedWorker posts {cmd:'layout', graph, layoutOptions, options}
```

Or call the WASM directly:

```js
const elk = new Elk();
const out = JSON.parse(elk.layout(JSON.stringify(graph), "", ""));
```

## Status

- ✅ Pipeline proven end-to-end: public ELK API → worker protocol → WASM →
  Rust dispatcher → algorithm → coordinates.
- ✅ Algorithms available: `force` (Fruchterman-Reingold + Eades), `stress`.
- ⏳ Remaining: the other 5 algorithms (`layered`, `mrtree`, `radial`,
  `rectpacking`, `spore`), full `CoreOptions`/MELK metadata, bit-for-bit
  fidelity (see `harness/` and `tests/differential.rs`), and packaging the shim
  + `.wasm` into `elkjs/lib` as the literal drop-in.
