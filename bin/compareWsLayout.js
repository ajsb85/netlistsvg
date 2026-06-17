#!/usr/bin/env node
/*
 * compareWsLayout.js — render each example two ways and diff:
 *   A) elkjs (in-process, the current engine)
 *   B) elk-py over WebSocket (the new engine)
 *
 * Writes both SVGs (+ the laid-out ELK graphs) under docs/compare/ for visual inspection
 * and prints whether the rendered SVGs are byte-identical. Requires the elk-py server:
 *     cd elk-py && elk-py-server         # ws://127.0.0.1:8765
 *
 * Usage: node bin/compareWsLayout.js [ws://host:port]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('../built');
const Skin = require('../built/Skin').default;
const { buildElkGraph } = require('../built/elkGraph');
const { FlatModule } = require('../built/FlatModule');
const onml = require('onml');

const WS_URL = process.argv[2] || 'ws://127.0.0.1:8765';
const SKIN = path.join(__dirname, '../skin/default.svg');
const OUT = path.join(__dirname, '../docs/compare');

const EXAMPLES = [
  'test/analog/and.json',
  'test/analog/resistor_divider.json',
  'test/digital/mux4.json',
  'test/digital/up3down5.json',
  'test/digital/hierarchy.json',
];

function wsLayout(graph, layoutOptions) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, command: 'layout', graph, layoutOptions }));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      ws.close();
      msg.error ? reject(new Error(msg.error)) : resolve(msg.data);
    };
    ws.onerror = () => reject(new Error('WS error — is elk-py-server running at ' + WS_URL + '?'));
  });
}

const render = (skin, netlist, elkData) =>
  new Promise((res, rej) => lib.render(skin, netlist, (e, svg) => (e ? rej(e) : res(svg)), elkData));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const skin = fs.readFileSync(SKIN, 'utf-8');
  let allMatch = true;

  for (const ex of EXAMPLES) {
    const name = path.basename(ex, '.json');
    const netlist = JSON.parse(fs.readFileSync(path.join(__dirname, '..', ex), 'utf-8'));

    // A) elkjs path.
    const svgElkjs = await render(skin, netlist);

    // B) elk-py-over-WS path: build the same kgraph, lay it out via the WS server.
    Skin.skin = onml.p(skin);
    const flat = FlatModule.fromNetlist(netlist, {
      hierarchy: { enable: 'off', expandLevel: 0, expandModules: { types: [], ids: [] } },
      top: { enable: false, module: '' },
    });
    const kgraph = buildElkGraph(flat);
    const layoutEngine = Skin.getProperties().layoutEngine || {};
    const graphWs = await wsLayout(kgraph, layoutEngine);
    const svgWs = await render(skin, netlist, graphWs);

    fs.writeFileSync(path.join(OUT, `${name}.elkjs.svg`), svgElkjs);
    fs.writeFileSync(path.join(OUT, `${name}.elkpy.svg`), svgWs);
    fs.writeFileSync(path.join(OUT, `${name}.elkpy.graph.json`), JSON.stringify(graphWs, null, 2));

    const same = svgElkjs === svgWs;
    allMatch = allMatch && same;
    console.log(`${same ? '✓' : '✗'} ${name.padEnd(18)} ${same ? 'SVG identical' : 'SVG DIFFERS'} ` +
                `(elkjs ${svgElkjs.length}B / elk-py ${svgWs.length}B)`);
  }
  console.log(allMatch ? '\nAll examples identical — elk-py is a drop-in for elkjs here.'
                       : '\nSome differ (see docs/compare/*.svg).');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
