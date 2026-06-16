#!/usr/bin/env python3
"""Compare the WASM layout output against the elkjs baseline, per netlist.
Reports max |Δ| over node/port/label coordinates. 0.0 = bit-for-bit."""
import json, sys
from pathlib import Path
here = Path(__file__).parent
elk = here / "references/elkjs"; wasm = here / "references/wasm"

def walk(g):
    for c in g.get("children", []):
        yield c
        yield from walk(c)

def coords(g):
    out = {}
    for c in walk(g):
        out[c["id"]] = (c.get("x", 0.0), c.get("y", 0.0))
        for p in c.get("ports", []):
            out[p["id"]] = (p.get("x", 0.0), p.get("y", 0.0))
            for i, l in enumerate(p.get("labels", []) or []):
                out[f'{p["id"]}#pl{i}'] = (l.get("x", 0.0), l.get("y", 0.0))
    return out

rows = []
for ef in sorted(elk.glob("*.elk.json")):
    name = ef.name
    wf = wasm / name
    if not wf.exists():
        rows.append((name, "MISSING")); continue
    ec, wc = coords(json.loads(ef.read_text())), coords(json.loads(wf.read_text()))
    if set(ec) != set(wc):
        rows.append((name, f"id-set differs ({len(set(ec)^set(wc))})")); continue
    d = max((max(abs(ec[k][0]-wc[k][0]), abs(ec[k][1]-wc[k][1])) for k in ec), default=0.0)
    rows.append((name, "0.0 ✓" if d == 0 else f"Δ {d:.3g}"))

w = max(len(r[0]) for r in rows)
print(f"{'netlist':<{w}}  vs elkjs")
print("-" * (w + 12))
for n, s in rows:
    print(f"{n:<{w}}  {s}")
