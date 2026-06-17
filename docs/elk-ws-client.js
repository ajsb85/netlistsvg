/*
 * elk-ws-client.js — a drop-in replacement for elkjs's `window.ELK`, backed by the
 * elk-py WebSocket layout server, using the INCREMENTAL (delta) protocol.
 *
 * netlist2svg only uses `new ELK()` and `elk.layout(graph, { layoutOptions })`. Under the
 * hood this client keeps a per-instance `session` and exchanges only RFC 6902 JSON Patches
 * with the server once the first layout has been sent:
 *
 *   upstream   : after the first call, send `requestPatch` = diff(lastRequest, request)
 *                instead of the whole graph (server reconstructs it from its memory).
 *   downstream : the server replies `type:"full"` once, then `type:"patch"`; this client
 *                applies the patch to its remembered response and returns the full graph
 *                netlist2svg expects.
 *
 * Correctness rests on WebSocket's ordered, reliable delivery: both sides apply the same
 * patches to the same base. If anything desyncs (server restarted → `type:"resync"`, or a
 * local patch fails to apply) the client transparently resends the full graph.
 *
 * Server URL: ?ws=ws://host:port  →  window.ELK_WS_URL  →  ws://127.0.0.1:8765.
 * A status pill (bottom-right) shows link state + last-layout metrics.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- JSON Pointer
  function unescapeToken(t) { return t.replace(/~1/g, '/').replace(/~0/g, '~'); }
  function parsePointer(p) { return p === '' ? [] : p.split('/').slice(1).map(unescapeToken); }

  function getAt(doc, tokens) {
    let cur = doc;
    for (const t of tokens) cur = Array.isArray(cur) ? cur[Number(t)] : cur[t];
    return cur;
  }
  function applyOp(doc, op) {
    const tokens = parsePointer(op.path);
    const last = tokens[tokens.length - 1];
    const parent = getAt(doc, tokens.slice(0, -1));
    switch (op.op) {
      case 'add': {
        if (Array.isArray(parent)) {
          if (last === '-') parent.push(op.value);
          else parent.splice(Number(last), 0, op.value);
        } else parent[last] = op.value;
        return doc;
      }
      case 'replace':
        if (Array.isArray(parent)) parent[Number(last)] = op.value; else parent[last] = op.value;
        return doc;
      case 'remove':
        if (Array.isArray(parent)) parent.splice(Number(last), 1); else delete parent[last];
        return doc;
      case 'move': {
        const from = parsePointer(op.from);
        const val = getAt(doc, from);
        applyOp(doc, { op: 'remove', path: op.from });
        applyOp(doc, { op: 'add', path: op.path, value: val });
        return doc;
      }
      case 'copy': {
        const val = JSON.parse(JSON.stringify(getAt(doc, parsePointer(op.from))));
        applyOp(doc, { op: 'add', path: op.path, value: val });
        return doc;
      }
      case 'test': {
        const actual = getAt(doc, tokens);
        if (JSON.stringify(actual) !== JSON.stringify(op.value)) throw new Error('test op failed');
        return doc;
      }
      default:
        throw new Error('unsupported op: ' + op.op);
    }
  }
  function applyPatch(doc, patch) { for (const op of patch) applyOp(doc, op); return doc; }

  // ---------------------------------------------------------------- JSON diff (RFC 6902)
  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (typeof a !== 'object') return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  const esc = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');

  function diff(a, b, path, ops) {
    if (deepEqual(a, b)) return ops;
    const bothArr = Array.isArray(a) && Array.isArray(b);
    const bothObj = a && b && typeof a === 'object' && typeof b === 'object' && !bothArr &&
                    !Array.isArray(a) && !Array.isArray(b);
    if (bothArr && a.length === b.length) {
      for (let i = 0; i < a.length; i++) diff(a[i], b[i], path + '/' + i, ops);
      return ops;
    }
    if (bothObj) {
      for (const k of Object.keys(a)) if (!(k in b)) ops.push({ op: 'remove', path: path + '/' + esc(k) });
      for (const k of Object.keys(b)) {
        if (!(k in a)) ops.push({ op: 'add', path: path + '/' + esc(k), value: b[k] });
        else diff(a[k], b[k], path + '/' + esc(k), ops);
      }
      return ops;
    }
    ops.push({ op: 'replace', path: path || '', value: b });
    return ops;
  }
  const makePatch = (a, b) => diff(a, b, '', []);

  // ---------------------------------------------------------------- URL + status pill
  function resolveUrl() {
    try { const q = new URLSearchParams(window.location.search).get('ws'); if (q) return q; }
    catch (e) { /* ignore */ }
    return window.ELK_WS_URL || 'ws://127.0.0.1:8765';
  }
  let pill;
  function ensurePill() {
    if (pill) return pill;
    pill = document.createElement('div');
    pill.id = 'elk-ws-status';
    pill.style.cssText =
      'position:fixed;right:12px;bottom:12px;z-index:9999;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;' +
      'padding:7px 11px;border-radius:10px;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.3);pointer-events:none;' +
      'max-width:340px;white-space:pre';
    (document.body || document.documentElement).appendChild(pill);
    return pill;
  }
  function setStatus(state, text) {
    const el = ensurePill();
    const colors = { connecting: '#b8860b', open: '#1a7f37', closed: '#b42318', error: '#b42318' };
    el.style.background = colors[state] || '#444';
    el.textContent = 'elk-py WS · ' + text;
  }
  const fmtBytes = (n) => (n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB');

  // ---------------------------------------------------------------- the client
  class ElkWebSocket {
    constructor(options) {
      this.url = (options && options.url) || resolveUrl();
      this.session = 's-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
      this._ws = null;
      this._nextId = 1;
      this._pending = new Map();  // id -> { resolve, reject, fullReq, t0 }
      this._queue = [];           // frames awaiting the socket
      this._lastReq = null;       // last { graph, layoutOptions } in sync with the server
      this._lastResponse = null;  // last full response (the patch base)
      this._n = 0;                // layout counter (for the pill)
    }

    _connect() {
      if (this._ws && (this._ws.readyState === 0 || this._ws.readyState === 1)) return;
      setStatus('connecting', 'connecting…  ' + this.url);
      const ws = new WebSocket(this.url);
      this._ws = ws;
      ws.onopen = () => {
        setStatus('open', 'connected  ' + this.url);
        const q = this._queue; this._queue = [];
        q.forEach((f) => ws.send(f));
      };
      ws.onmessage = (ev) => this._onMessage(ev);
      ws.onerror = () => setStatus('error', 'error — is elk-py-server running?');
      ws.onclose = () => {
        setStatus('closed', 'disconnected');
        this._pending.forEach((e) => e.reject(new Error('WebSocket closed')));
        this._pending.clear();
        this._lastReq = null; this._lastResponse = null; this._ws = null;
      };
    }

    _send(frame) {
      if (this._ws && this._ws.readyState === 1) this._ws.send(frame);
      else { this._connect(); this._queue.push(frame); }
    }

    _sendFull(id, req) {
      this._send(JSON.stringify({
        id, session: this.session, command: 'layout',
        graph: req.graph, layoutOptions: req.layoutOptions,
      }));
    }

    _onMessage(ev) {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      const entry = this._pending.get(msg.id);
      if (!entry) return;

      if (msg.type === 'resync') {
        // Server lost our base: drop memory and resend the whole graph for this id.
        this._lastReq = null; this._lastResponse = null;
        this._sendFull(msg.id, entry.fullReq);
        return; // keep the promise pending until the full reply arrives
      }
      if (msg.error) { this._pending.delete(msg.id); entry.reject(new Error(msg.error)); return; }

      let full;
      try {
        if (msg.type === 'patch') {
          if (this._lastResponse == null) throw new Error('patch with no base');
          full = applyPatch(structuredClone(this._lastResponse), msg.patch);
        } else {
          full = msg.data;
        }
      } catch (e) {
        // Local desync: forget everything and resend the full graph for this id.
        this._lastReq = null; this._lastResponse = null;
        this._sendFull(msg.id, entry.fullReq);
        return;
      }

      this._lastResponse = full;
      this._lastReq = entry.fullReq;        // now in lock-step with the server
      this._pending.delete(msg.id);

      const rtt = (performance.now() - entry.t0).toFixed(1);
      const up = fmtBytes(entry.bytes);
      const down = fmtBytes(ev.data.length);
      const mode = msg.type === 'patch' ? 'PATCH' : 'FULL';
      const ops = msg.type === 'patch' ? (msg.patch ? msg.patch.length : 0) + ' ops' : 'snapshot';
      const cache = msg.cached ? '  cache✓' : '';
      setStatus('open',
        '#' + (++this._n) + ' ' + mode + ' (' + ops + ')' + cache + '\n' +
        '↑' + up + ' ↓' + down + '  rtt ' + rtt + 'ms  srv ' + (msg.ms != null ? msg.ms + 'ms' : '?'));

      entry.resolve(structuredClone(full));
    }

    layout(graph, opts) {
      this._connect();
      const id = this._nextId++;
      // JSON round-trip so our remembered request matches the server's exactly: the wire
      // is JSON, which drops `undefined`-valued keys that buildElkGraph leaves in place.
      // Diffing the raw in-memory object would emit `remove` ops the server can't apply.
      const req = JSON.parse(JSON.stringify({ graph, layoutOptions: (opts && opts.layoutOptions) || {} }));

      let frame;
      if (this._lastReq) {
        const patch = makePatch(this._lastReq, req);
        frame = JSON.stringify({ id, session: this.session, command: 'layout', requestPatch: patch });
      } else {
        frame = JSON.stringify({ id, session: this.session, command: 'layout',
                                 graph: req.graph, layoutOptions: req.layoutOptions });
      }

      return new Promise((resolve, reject) => {
        this._pending.set(id, { resolve, reject, fullReq: req, t0: performance.now(), bytes: frame.length });
        this._send(frame);
      });
    }

    // elkjs API surface netlist2svg does not use, stubbed for safety.
    knownLayoutAlgorithms() { return Promise.resolve([]); }
    knownLayoutOptions() { return Promise.resolve([]); }
    knownLayoutCategories() { return Promise.resolve([]); }
    terminateWorker() { if (this._ws) this._ws.close(); }
  }

  window.ELK = ElkWebSocket;
  if (document.readyState !== 'loading') setStatus('connecting', 'idle');
  else document.addEventListener('DOMContentLoaded', () => setStatus('connecting', 'idle'));
})();
