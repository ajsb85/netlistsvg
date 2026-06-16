#!/usr/bin/env node
'use strict';

// netlist2svg-layoutdiff — lay a netlist out with BOTH engines (elkjs = reference,
// elk-rust WASM = current) and report the per-element divergence. This is the per-step
// oracle methodology applied to netlist2svg: the FIRST divergence is where to fix elk-rust.
//
//   netlist2svg-layoutdiff references/divider.json --skin skin/analog.svg
//   netlist2svg-layoutdiff references/divider.json --skin skin/analog.svg --out /tmp/divider
//
// Exit 0 if bit-for-bit (within --threshold), 1 if divergent — so it doubles as a gate.

var lib = require('../built'),
    fs = require('fs'),
    path = require('path'),
    json5 = require('json5'),
    clone = require('clone'),
    yargs = require('yargs'),
    Ajv = require('ajv');

var ajv = new Ajv({allErrors: true, allowUnionTypes: true});
require('ajv-errors')(ajv);

// Flatten a laid-out ELK graph to id -> {x,y,w,h} for nodes / ports / labels / edge points.
function collect(g, out) {
    out = out || new Map();
    (g.children || []).forEach(function (c) {
        out.set(c.id, {x: c.x || 0, y: c.y || 0, w: c.width || 0, h: c.height || 0});
        (c.ports || []).forEach(function (p) {
            out.set(p.id, {x: p.x || 0, y: p.y || 0, w: 0, h: 0});
            (p.labels || []).forEach(function (l, i) {
                out.set(p.id + '#pl' + i, {x: l.x || 0, y: l.y || 0, w: 0, h: 0});
            });
        });
        collect(c, out);
    });
    (g.edges || []).forEach(function (e) {
        (e.sections || []).forEach(function (s, i) {
            if (s.startPoint) out.set(e.id + '#s' + i + '#start', {x: s.startPoint.x, y: s.startPoint.y, w: 0, h: 0});
            if (s.endPoint) out.set(e.id + '#s' + i + '#end', {x: s.endPoint.x, y: s.endPoint.y, w: 0, h: 0});
            (s.bendPoints || []).forEach(function (b, j) {
                out.set(e.id + '#s' + i + '#b' + j, {x: b.x, y: b.y, w: 0, h: 0});
            });
        });
        (e.labels || []).forEach(function (l, i) {
            out.set(e.id + '#l' + i, {x: l.x || 0, y: l.y || 0, w: 0, h: 0});
        });
    });
    return out;
}

function delta(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
}

function renderSvg(skinData, netlist, elkData, config) {
    return new Promise(function (res, rej) {
        lib.render(skinData, netlist, function (err, svg) { return err ? rej(err) : res(svg); },
            clone(elkData), config);
    });
}

async function run(netlistPath, skinPath, configPath, outPrefix, topN, threshold) {
    skinPath = skinPath || path.join(__dirname, '../skin/default.svg');
    var schemaPath = path.join(__dirname, '../lib/yosys.schema.json5');
    var skinData = fs.readFileSync(skinPath, 'utf-8');
    var netlist = json5.parse(fs.readFileSync(netlistPath, 'utf-8'));
    var config = configPath ? json5.parse(fs.readFileSync(configPath, 'utf-8')) : undefined;

    if (!ajv.validate(json5.parse(fs.readFileSync(schemaPath)), netlist)) {
        throw Error(JSON.stringify(ajv.errors, null, 2));
    }

    var built = lib.buildLayoutGraph(skinData, netlist, config);
    var opts = {layoutOptions: built.layoutOptions};
    var ref = await lib.createEngine('elkjs').layout(clone(built.kgraph), opts);
    var cur = await lib.createEngine('wasm').layout(clone(built.kgraph), opts);

    var rc = collect(ref), cc = collect(cur);
    var ids = Array.from(new Set(Array.from(rc.keys()).concat(Array.from(cc.keys()))));
    var rows = ids.map(function (id) {
        var r = rc.get(id), c = cc.get(id);
        if (!r) return {id: id, kind: 'WASM-ONLY', d: Infinity};
        if (!c) return {id: id, kind: 'ELKJS-ONLY', d: Infinity};
        return {id: id, kind: 'pos', d: delta(r, c), r: r, c: c};
    });
    rows.sort(function (a, b) { return b.d - a.d; });
    var div = rows.filter(function (x) { return x.d > threshold; });
    var maxD = rows.length ? rows[0].d : 0;

    console.log('netlist : ' + netlistPath + '   skin: ' + skinPath);
    console.log('root    : elkjs ' + ref.width + 'x' + ref.height + '   wasm ' + cur.width + 'x' + cur.height);
    console.log('elements: ' + ids.length + '   divergent: ' + div.length +
        '   max|Δ|: ' + (maxD === Infinity ? 'structural' : maxD.toFixed(3)));
    if (div.length) {
        console.log('\nTop ' + Math.min(topN, div.length) + ' divergences (elkjs = expected, wasm = current):');
        div.slice(0, topN).forEach(function (x) {
            if (x.kind !== 'pos') { console.log('  ' + x.kind + '  ' + x.id); return; }
            console.log('  Δ ' + x.d.toFixed(2) + '  ' + x.id);
            console.log('       elkjs (' + x.r.x + ',' + x.r.y + ') ' + x.r.w + 'x' + x.r.h +
                '   wasm (' + x.c.x + ',' + x.c.y + ') ' + x.c.w + 'x' + x.c.h);
        });
    } else {
        console.log('\nBIT-FOR-BIT (within ' + threshold + ') ✓');
    }

    if (outPrefix) {
        fs.writeFileSync(outPrefix + '.elkjs.elk.json', JSON.stringify(ref, null, 2));
        fs.writeFileSync(outPrefix + '.wasm.elk.json', JSON.stringify(cur, null, 2));
        fs.writeFileSync(outPrefix + '.elkjs.svg', await renderSvg(skinData, netlist, ref, config));
        fs.writeFileSync(outPrefix + '.wasm.svg', await renderSvg(skinData, netlist, cur, config));
        console.log('\nwrote ' + outPrefix + '.{elkjs,wasm}.{elk.json,svg}');
    }
    return div.length ? 1 : 0;
}

if (require.main === module) {
    var argv = yargs
        .demand(1)
        .usage('usage: $0 netlist.json [--skin skin_file] [--config c.json] [--out prefix] [--top N] [--threshold T]')
        .option('skin', {describe: 'skin SVG (default: skin/default.svg)'})
        .option('config', {describe: 'hierarchy/top config JSON'})
        .option('out', {describe: 'write <prefix>.{elkjs,wasm}.{elk.json,svg}'})
        .option('top', {describe: 'show this many divergences', default: 10})
        .option('threshold', {describe: 'max |Δ| to treat as equal', default: 1e-6})
        .argv;
    run(argv._[0], argv.skin, argv.config, argv.out, Number(argv.top), Number(argv.threshold))
        .then(function (code) { process.exit(code); })
        .catch(function (e) { console.error(e); process.exit(2); });
}

module.exports.run = run;
