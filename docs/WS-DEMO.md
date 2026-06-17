# netlist2svg + elk-py over WebSocket (incremental / delta mode)

This demo swaps netlist2svg's layout engine from **elkjs** (in-browser) to **elk-py** (the
pure-Python port of Eclipse ELK **0.11.0**) served over a **WebSocket**, using an
**incremental delta protocol**: the full laid-out graph is sent once, then only **RFC 6902
JSON Patches** travel in each direction. Nothing else in netlist2svg changes.

```
browser (bundle.js: new ELK().layout(graph,{layoutOptions}))
   │  window.ELK ← elk-ws-client.js   (drop-in for elkjs)
   │     • 1st call : sends the whole graph
   │     • next     : sends requestPatch = diff(lastRequest, request)
   ▼  ws://
elk-py server  (session memory + LRU compute cache)
   │     JsonImporter → Java ELK 0.11.0 (coords) → transfer_layout
   ▲     • 1st reply : {type:"full",  data}
   │     • next      : {type:"patch", patch}        (empty when unchanged)
   └─ browser applies the patch to its remembered response → full graph for drawModule
```

See [`elk-py/docs/PROTOCOL.md`](../../elk-py/docs/PROTOCOL.md) for the exact wire format.

## Why it's fast

| technique | effect |
|---|---|
| **One persistent JVM** (`ElkLayoutRunner --worker`) | no per-request JVM startup; the first layout after boot pays a ~1–2 s warm-up, then layouts are milliseconds |
| **LRU compute cache** (keyed by the canonical graph) | an unchanged graph skips the importer **and** the JVM entirely |
| **Request deltas** | after the first call the browser uploads a tiny JSON Patch, not the whole graph |
| **Response deltas** | the server returns only what moved; an unchanged layout is an empty patch |
| **One reused socket** | no reconnect per layout |

Measured on this machine (localhost, warm JVM):

| graph | nodes/edges | request size | first compute | **cache hit** |
|---|---|---|---|---|
| `and` | 14 / 1 | 4.8 KB | ~1–23 ms | <1 ms |
| `up3down5` | 31 / 40 | 26.8 KB | ~144 ms | **~3 ms** (≈48× faster) |

A re-render of the **same** graph (toggling skin, re-selecting, replaying) is a tiny patch
each way and **zero** layout work. The bottom-right pill shows per-layout mode, byte sizes,
round-trip and server time, and whether the cache was hit.

## Run it

1. **Start the layout server** (from the `elk-py` project):

   ```bash
   cd ../elk-py
   python -m venv .venv && . .venv/bin/activate && pip install -e .
   elk-py-server                 # ws://127.0.0.1:8765
   ```

2. **Serve this folder** and open the WS demo (the `/` root is the old elkjs demo — use
   **`index-ws.html`**):

   ```bash
   cd ../netlist2svg-ws
   npx http-server docs -p 8124 -a 127.0.0.1 -c-1
   # open http://127.0.0.1:8124/index-ws.html
   ```

   Override the server URL: `index-ws.html?ws=ws://host:port`.

   Pick an example, then **edit the netlist** or **re-select** — watch the pill switch from
   `FULL` to `PATCH (… ops)` and `cache✓`.

## Verify

Two checkers (both need `elk-py-server` running):

```bash
node bin/wsDeltaCheck.js      # delta protocol: patches reconstruct full graphs exactly
node bin/compareWsLayout.js   # renders elkjs vs elk-py and diffs the SVGs (4/5 identical)
```

`wsDeltaCheck` loads the **real** `docs/elk-ws-client.js` and asserts that (a) re-laying the
same graph reconstructs identically via an empty patch, and (b) an edited graph
reconstructed from request+response patches equals an independent full layout — for both a
small (`and`) and a large (`up3down5`) graph.

### Why `up3down5` looks different from the elkjs demo

elkjs here is **0.11.1**; elk-py reproduces ELK **0.11.0** (the stable checkout we
standardized on). For the exact graph the demo sends, elk-py is **byte-identical to real
Java ELK 0.11.0** (`elk-py diff` → *0 divergences*); the visual gap on `up3down5` is a
genuine 0.11.1-vs-0.11.0 difference, not a port or protocol defect. The other examples lay
out identically across the two patch versions.

## Correctness model

Client and server each keep the last request and last response and apply the **same
patches to the same base**, so their memories stay in lock-step. This relies on WebSocket's
ordered, reliable delivery. The protocol self-heals if that ever breaks:

- server lost the session (restart) → replies `type:"resync"` → client resends the full graph;
- a patch fails to apply on the client → client drops its memory and resends the full graph.

So a dropped/replayed frame degrades to a one-off full exchange, never a wrong layout.
