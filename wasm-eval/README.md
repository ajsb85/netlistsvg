# wasm-eval — elk-rust WASM as a drop-in for elkjs

This directory evaluates **[elk-rust](https://github.com/ajsb85/elk-rust)** (a pure-Rust,
bit-for-bit port of ELK, compiled to WebAssembly) as a drop-in replacement for `elkjs`
inside netlist2svg.

## The swap

- `lib/elkWasmAdapter.ts` — an elkjs-compatible `ELK` class (`new ELK()` + `await
  elk.layout(graph, {layoutOptions})`) backed by the wasm-bindgen `Elk` class.
- `lib/index.ts` now imports `./elkWasmAdapter` instead of `elkjs`.
- `elk-wasm/` — the vendored `wasm-pack --target nodejs --release` build (regenerate from
  `elk-rust/crates/elk-wasm` with `wasm-pack build --target nodejs --release --out-dir
  pkg-node`, then `cp -r pkg-node/. wasm-eval/elk-wasm/`).

To go back to elkjs: revert the one-line import in `lib/index.ts` and rebuild (`npx tsc`).

## Validation harness

```bash
# 1. baseline with the CURRENT elkjs (revert the swap first, or use a clean checkout)
bash wasm-eval/gen.sh wasm-eval/references/elkjs
# 2. with the WASM (swap applied)
bash wasm-eval/gen.sh wasm-eval/references/wasm
# 3. compare per netlist (max |Δ| over node/port/label coords; 0.0 = bit-for-bit)
python3 wasm-eval/compare.py
```

`gen.sh` runs every test netlist through **both** `bin/exportLayout.js` (the raw ELK
layout JSON — `*.elk.json`, the precise comparison target) and `bin/netlist2svg.js`
(the rendered `*.svg`). References live in `references/elkjs/` (baseline) and
`references/wasm/` (current WASM).

## Status

**The WASM works as a functional drop-in:** all 12 test netlists lay out and render with no
crashes, dropped nodes, or structural differences (identical node/port/label id sets). The
layouts are **not yet byte-identical** — see the gaps below.

This evaluation surfaced and fixed **four real elk-rust bugs** (none were caught by the
250-case corpus, which always sets `elk.algorithm` and explicit port sides):

1. **Default algorithm** — when no `elk.algorithm` is set, ELK defaults to
   `org.eclipse.elk.layered` (`LayoutAlgorithmResolver`); the engine did nothing. *(fixed)*
2. **BK `SimpleThresholdStrategy.postProcess` ordering** — it ran before the
   apply-final-coordinates step, panicking (`unwrap` on an unplaced `y`); ELK runs it
   last. *(fixed)*
3. **FIXED_POS port labels** — `distribute_explicit_ports` returned before placing port
   labels for FIXED_POS/FIXED_RATIO nodes. *(fixed)*
4. **Port-side inference** — ports with no explicit `elk.port.side` on a side-fixed node
   need `LGraphUtil.calcPortSide` (infer WEST/EAST/NORTH/SOUTH from position); without it
   the layered algorithm can't tell inputs from outputs. *(fixed)*

### Known remaining gaps (drive these with the comparison above)

- **Port-label vertical node margins** — port labels are added to the E/W (inter-layer)
  margin but not the node's top/bottom margin, so within-layer vertical spacing is ~10px
  per gap too tight (mux4/hierarchy Δ≈50). Needs ELK's `InnermostNodeMarginCalculator`
  contribution from port labels in BK spacing.
- The larger deltas (e.g. up3down5) likely involve further gaps (node-label sizing,
  edge-label-inline placement, hyperedge routing). Diagnose each with the
  **per-step Java oracle** methodology (`elk-rust/harness/oracle/`), the same way the
  corpus was made bit-for-bit.

These references are the regression baseline: as elk-rust closes the gaps, re-run
`gen.sh wasm-eval/references/wasm` + `compare.py` and watch the deltas fall to `0.0`.
