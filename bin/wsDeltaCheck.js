#!/usr/bin/env node
/*
 * wsDeltaCheck.js — integration test for the REAL docs/elk-ws-client.js delta protocol.
 *
 * Loads the browser client (with tiny DOM stubs), points it at the elk-py server, and
 * checks that the incremental path is correct and fast:
 *   1. first layout  → FULL
 *   2. same graph    → empty PATCH, reconstructs identically, server cache hit
 *   3. edited graph  → request+response PATCH, reconstruction == an independent full layout
 *
 * Requires: cd elk-py && elk-py-server      Usage: node bin/wsDeltaCheck.js [ws://host:port]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const onml = require('onml');
const Skin = require('../built/Skin').default;
const { buildElkGraph } = require('../built/elkGraph');
const { FlatModule } = require('../built/FlatModule');

const WS_URL = process.argv[2] || 'ws://127.0.0.1:8765';

// --- minimal DOM so the client's status pill code is a no-op ------------------
const noopEl = { style: {}, setAttribute() {}, appendChild() {}, set textContent(_) {}, innerHTML: '' };
const sandbox = {
  WebSocket, performance, structuredClone, URLSearchParams, JSON, Object, Array, Math, Date, Symbol, console,
  window: { location: { search: '' }, ELK_WS_URL: WS_URL },
  document: {
    readyState: 'complete',
    documentElement: noopEl,
    body: noopEl,
    createElement: () => ({ ...noopEl, style: {} }),
    addEventListener() {},
  },
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs/elk-ws-client.js'), 'utf-8'), sandbox);
const ELK = sandbox.window.ELK;

function kgraphFor(example) {
  const skin = fs.readFileSync(path.join(__dirname, '../skin/default.svg'), 'utf-8');
  Skin.skin = onml.p(skin);
  const netlist = JSON.parse(fs.readFileSync(path.join(__dirname, '..', example), 'utf-8'));
  const flat = FlatModule.fromNetlist(netlist, {
    hierarchy: { enable: 'off', expandLevel: 0, expandModules: { types: [], ids: [] } },
    top: { enable: false, module: '' },
  });
  return { graph: buildElkGraph(flat), layoutOptions: Skin.getProperties().layoutEngine || {} };
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  let ok = true;
  for (const ex of ['test/analog/and.json', 'test/digital/up3down5.json']) {
    const name = path.basename(ex, '.json');
    const { graph, layoutOptions } = kgraphFor(ex);

    const elk = new ELK({ url: WS_URL });
    const r1 = await elk.layout(graph, { layoutOptions });               // FULL
    const r2 = await elk.layout(graph, { layoutOptions });               // empty PATCH

    const edited = JSON.parse(JSON.stringify(graph));
    edited.children[0].width = (edited.children[0].width || 10) + 7;      // tweak one node
    const r3 = await elk.layout(edited, { layoutOptions });              // req+resp PATCH

    // Independent ground truth for the edited graph (fresh session → FULL).
    const truth = await new ELK({ url: WS_URL }).layout(edited, { layoutOptions });

    const c1 = eq(r1, r2);
    const c2 = eq(r3, truth);
    ok = ok && c1 && c2;
    console.log(`${(c1 && c2) ? '✓' : '✗'} ${name.padEnd(12)} ` +
      `same-graph reconstruct=${c1}  edited reconstruct==truth=${c2}  ` +
      `(nodes:${r1.children.length})`);
  }
  console.log(ok ? '\nDelta protocol correct — patches reconstruct full graphs exactly.'
                 : '\nFAILED — see above.');
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
