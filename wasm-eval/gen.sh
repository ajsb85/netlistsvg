#!/usr/bin/env bash
# Generate the ELK layout JSON (.elk.json, the raw layout output) and the rendered
# SVG for every test netlist into $1 (default: wasm-eval/references/elkjs).
# Run from the repo root. Used for both the elkjs baseline and the WASM output.
set -euo pipefail
out="${1:-wasm-eval/references/elkjs}"
mkdir -p "$out"
digital="generics ports_splitjoin up3down5 mux4 hyperedges pc"
analog="and common_emitter_full mcu resistor_divider vcc_and_gnd"
for t in $digital; do
  node bin/exportLayout.js "test/digital/$t.json" -o "$out/$t.elk.json" --skin skin/default.svg
  node bin/netlist2svg.js   "test/digital/$t.json" -o "$out/$t.svg"      --skin skin/default.svg
done
for t in $analog; do
  node bin/exportLayout.js "test/analog/$t.json" -o "$out/$t.elk.json" --skin skin/analog.svg
  node bin/netlist2svg.js   "test/analog/$t.json" -o "$out/$t.svg"      --skin skin/analog.svg
done
node bin/exportLayout.js "test/digital/hierarchy.json" -o "$out/hierarchy.elk.json" --skin skin/default.svg
node bin/netlist2svg.js   "test/digital/hierarchy.json" -o "$out/hierarchy.svg" --skin skin/default.svg --config examples/config/config.json
echo "generated $(ls "$out" | wc -l) files in $out"
