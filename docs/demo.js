'use strict';

const superagent = require('superagent');
const JSON5 = require('json5');
const netlistRenderer = require('../built');

const skinPaths = ['skin/default.svg', 'skin/analog.svg', 'skin/horizontal.svg'];

const textarea = document.querySelector('#editor');
const skinSelect = document.querySelector('#skinSelect');
const exampleSelect = document.querySelector('#exampleSelect');
const configSelect = document.querySelector('#configSelect');
const formatButton = document.querySelector('#formatButton');
const downloadButton = document.querySelector('#downloadButton');
const svgImage = document.querySelector('#svgArea');
const emptyState = document.querySelector('#emptyState');
const toast = document.querySelector('#toast');
const themeToggle = document.querySelector('#themeToggle');
const orientSelect = document.querySelector('#orientSelect');
const metricsEl = document.querySelector('#metrics');

let currentSvgString = '';

/* ---------------- Theme (auto + forced via toggle) ----------------
   The toggle cycles System -> Light -> Dark. "System" follows the OS; Light/Dark
   force the choice (persisted in localStorage). The active theme is mirrored onto
   <html data-theme> for the page CSS and onto the rendered SVG (class="light|dark")
   so the skins honor it regardless of the OS setting. */
const THEME_KEY = 'netlist2svg-theme';
const THEME_MODES = ['system', 'light', 'dark'];
const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
const THEME_ICONS = {
    system: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none"/></svg>',
    light: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};

function systemPrefersDark() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function storedThemeMode() {
    try { return localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { return 'system'; }
}

function effectiveTheme(mode) {
    return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
}

function applyTheme(mode) {
    document.documentElement.dataset.theme = effectiveTheme(mode);
    if (themeToggle) {
        const ico = themeToggle.querySelector('.ico');
        const label = themeToggle.querySelector('.label');
        if (ico) ico.innerHTML = THEME_ICONS[mode];
        if (label) label.textContent = THEME_LABELS[mode];
        themeToggle.setAttribute('aria-label', 'Theme: ' + THEME_LABELS[mode] + ' (click to change)');
    }
    applySchematicTheme();
}

function cycleTheme() {
    const next = THEME_MODES[(THEME_MODES.indexOf(storedThemeMode()) + 1) % THEME_MODES.length];
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    applyTheme(next);
}

// Re-skin the already-rendered schematic to the active theme without re-laying it
// out. The skins honor class="dark" / class="light" on the root <svg>.
function applySchematicTheme() {
    if (!currentSvgString) return;
    const eff = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const themed = currentSvgString.replace('<svg ', '<svg class="' + eff + '" ');
    svgImage.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(themed)));
}

// Hierarchy configurations selectable in the UI. An empty selection (key '')
// means "off" and renders submodules as opaque boxes.
const HIERARCHY_CONFIGS = {
    all: { hierarchy: { enable: 'all', expandLevel: 0, expandModules: { types: [], ids: [] } }, top: { enable: false, module: '' } },
    level1: { hierarchy: { enable: 'level', expandLevel: 1, expandModules: { types: [], ids: [] } }, top: { enable: false, module: '' } },
    foo: { hierarchy: { enable: 'modules', expandLevel: 0, expandModules: { types: [], ids: ['foo'] } }, top: { enable: false, module: '' } },
};

function showToast(message) {
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 5000);
}

function hideToast() {
    toast.style.display = 'none';
}

async function loadSkins(paths) {
    try {
        const skinPromises = paths.map(path => superagent.get(path).then(res => ({ path, svg: res.text })));
        const skins = await Promise.all(skinPromises);
        return skins;
    } catch (error) {
        console.error('Error loading skins:', error);
        showToast('Error loading skins. See console for details.');
        return [];
    }
}

function populateSkinSelect(skins) {
    skins.forEach((skin, index) => {
        const option = document.createElement('option');
        option.value = skin.svg;
        option.text = skin.path;
        option.selected = index === 0;
        skinSelect.append(option);
    });
}

/* ---------------- Analog component orientation (evaluation of PR #40) ----------------
   Many analog skins ship vertical and horizontal variants of a component
   (resistor r_v/r_h, capacitor c_v/c_h, inductor l_v/l_h, LED d_led_v/d_led_h).
   Today the netlist author must pick the orientation by hand. PR #40 proposed
   choosing it automatically by trying combinations and minimizing wire bends.

   Here we let you compare As-authored / All-vertical / All-horizontal / Auto, with a
   live metric readout, so the value of auto-orientation can be judged directly.
   "Auto" brute-forces 2^N orientations (capped) and picks the fewest bends, using
   total ELK bend points (ignoring straight runs) with graph area as a tiebreaker —
   a small refinement over the original PR which used bends alone. */
const ORIENT_BASES = ['r', 'c', 'l', 'd_led'];
const MAX_AUTO_PARTS = 6; // 2^6 = 64 layouts; beyond this we fall back to all-vertical
const ORIENT_LABELS = {
    '': 'As authored', vertical: 'All vertical', horizontal: 'All horizontal', auto: 'Auto (fewest bends)',
};

function orientBase(type) {
    if (typeof type !== 'string') return null;
    const m = type.match(/^(.*)_(v|h)$/);
    if (m && ORIENT_BASES.includes(m[1])) return m[1];
    if (ORIENT_BASES.includes(type)) return type;
    return null;
}

// Count orientable components across all modules (stable iteration order).
function orientableCount(netlist) {
    let n = 0;
    for (const mod of Object.values(netlist.modules || {})) {
        for (const cell of Object.values(mod.cells || {})) {
            if (orientBase(cell.type)) n++;
        }
    }
    return n;
}

// Re-orient every orientable component. mode: 'vertical' | 'horizontal' | 'as-authored'.
function applyOrientation(netlist, mode) {
    const nl = JSON.parse(JSON.stringify(netlist));
    for (const mod of Object.values(nl.modules || {})) {
        for (const cell of Object.values(mod.cells || {})) {
            const base = orientBase(cell.type);
            if (!base) continue;
            if (mode === 'vertical') cell.type = base + '_v';
            else if (mode === 'horizontal') cell.type = base + '_h';
            else if (cell.type === base) cell.type = base + '_v'; // normalize bare base
        }
    }
    return nl;
}

// Build the variant for a bitmask: bit i set => component i vertical, else horizontal.
function orientVariant(netlist, mask) {
    const nl = JSON.parse(JSON.stringify(netlist));
    let i = 0;
    for (const mod of Object.values(nl.modules || {})) {
        for (const cell of Object.values(mod.cells || {})) {
            const base = orientBase(cell.type);
            if (!base) continue;
            cell.type = base + (((mask >> i) & 1) ? '_v' : '_h');
            i++;
        }
    }
    return nl;
}

function layoutGraph(netlist) {
    return new Promise((resolve, reject) => {
        netlistRenderer.dumpLayout(skinSelect.value, netlist, false, (err, out) => {
            if (err) reject(err); else resolve(JSON.parse(out));
        });
    });
}

// Total bend points across all edges, ignoring straight runs (ELK reports bends on
// straight segments too). This is the PR #40 readability metric.
function countBends(graph) {
    return (graph.edges || []).reduce((acc, e) => acc + (e.sections || []).reduce((s, sec) => {
        const a = sec.startPoint, b = sec.endPoint;
        if (a && b && a.x !== b.x && a.y !== b.y) return s + (sec.bendPoints || []).length;
        return s;
    }, 0), 0);
}

function graphSize(graph) {
    return { w: Math.round(graph.width || 0), h: Math.round(graph.height || 0) };
}

// Brute-force the orientation with the fewest bends (area as tiebreaker).
async function autoOrient(netlist) {
    const count = orientableCount(netlist);
    if (count === 0) {
        return { netlist: applyOrientation(netlist, 'as-authored'), bends: 0, size: { w: 0, h: 0 }, layouts: 0 };
    }
    if (count > MAX_AUTO_PARTS) {
        const nl = applyOrientation(netlist, 'vertical');
        const g = await layoutGraph(nl);
        return {
            netlist: nl, bends: countBends(g), size: graphSize(g), layouts: 0,
            note: `${count} parts → 2^${count} layouts too many; showing all-vertical`,
        };
    }
    let best = null, bestBends = Infinity, bestArea = Infinity, bestSize = null;
    const total = 1 << count;
    for (let mask = 0; mask < total; mask++) {
        const nl = orientVariant(netlist, mask);
        const g = await layoutGraph(nl);
        const bends = countBends(g);
        const area = (g.width || 0) * (g.height || 0);
        if (bends < bestBends || (bends === bestBends && area < bestArea)) {
            best = nl; bestBends = bends; bestArea = area; bestSize = graphSize(g);
        }
    }
    return { netlist: best, bends: bestBends, size: bestSize, layouts: total };
}

async function updateMetrics(netlist, mode, pre) {
    const count = orientableCount(netlist);
    if (count === 0) { metricsEl.hidden = true; return; } // no orientable parts (e.g. digital)
    let bends, size, note = '';
    if (pre) {
        bends = pre.bends; size = pre.size;
        note = pre.note ? pre.note : (pre.layouts ? `evaluated ${pre.layouts} orientations` : '');
    } else {
        const g = await layoutGraph(netlist);
        bends = countBends(g); size = graphSize(g);
    }
    const isAuto = mode === 'auto';
    metricsEl.innerHTML =
        `<span class="stat${isAuto ? ' win' : ''}">Orientation: <strong>${ORIENT_LABELS[mode] || ORIENT_LABELS['']}</strong></span>` +
        `<span class="stat">Bends: <strong>${bends}</strong></span>` +
        `<span class="stat">Size: <strong>${size.w}&times;${size.h}</strong></span>` +
        `<span class="stat">Orientable parts: <strong>${count}</strong></span>` +
        (note ? `<span class="stat">${note}</span>` : '');
    metricsEl.hidden = false;
}

async function render() {
    hideToast();
    if (!textarea.value.trim()) {
        svgImage.style.display = 'none';
        emptyState.style.display = 'flex';
        downloadButton.style.display = 'none';
        metricsEl.hidden = true;
        return;
    }

    try {
        const netlist = JSON5.parse(textarea.value);
        const config = HIERARCHY_CONFIGS[configSelect.value];
        const mode = orientSelect.value;

        let toRender;
        let pre = null;
        if (mode === 'auto') {
            pre = await autoOrient(netlist);
            toRender = pre.netlist;
            if (pre.note) showToast('Auto-orient: ' + pre.note);
        } else {
            toRender = applyOrientation(netlist, mode || 'as-authored');
        }

        const svgString = await netlistRenderer.render(skinSelect.value, toRender, undefined, undefined, config);
        // Keep the theme-neutral SVG for export; the preview is themed to match the
        // active light/dark theme via applySchematicTheme().
        currentSvgString = svgString;
        applySchematicTheme();

        svgImage.style.display = 'block';
        emptyState.style.display = 'none';
        downloadButton.style.display = 'block';

        updateMetrics(toRender, mode, pre).catch(() => { metricsEl.hidden = true; });
    } catch (error) {
        console.error('Error rendering netlist:', error);
        if (error instanceof SyntaxError) {
            showToast('Syntax Error in JSON: Please check your formatting.');
        } else {
            showToast(error.message || 'Error rendering netlist. Check developer console.');
        }
        svgImage.style.display = 'none';
        emptyState.style.display = 'flex';
        downloadButton.style.display = 'none';
        metricsEl.hidden = true;
    }
}

function format() {
    try {
        const netlist = JSON5.parse(textarea.value);
        textarea.value = JSON5.stringify(netlist, null, 4);
    } catch (error) {
        console.error('Error formatting JSON:', error);
        showToast('Invalid JSON5. Please check your input.');
    }
}

// Select the skin option whose label contains the given substring.
function selectSkinByPath(substr) {
    for (const option of skinSelect.options) {
        if (option.text.includes(substr)) {
            skinSelect.value = option.value;
            return;
        }
    }
}

async function handleExampleChange() {
    const examplePath = exampleSelect.value;
    if (!examplePath) return;

    try {
        const res = await superagent.get(examplePath);
        textarea.value = res.text;
        // Pick a sensible skin per example: analog parts need the analog skin, the
        // hierarchy example needs the default skin (sub_odd/sub_even templates) with
        // expansion on; everything else uses the default digital skin.
        if (examplePath.includes('/analog/')) {
            selectSkinByPath('analog.svg');
            configSelect.value = '';
        } else if (examplePath.includes('hierarchy')) {
            selectSkinByPath('default.svg');
            configSelect.value = 'all';
        } else {
            selectSkinByPath('default.svg');
            configSelect.value = '';
        }
        format();
        render();
    } catch (error) {
        console.error('Error loading example:', error);
        showToast('Failed to load example netlist.');
    }
}

function handleDownload() {
    if (!currentSvgString) return;
    const blob = new Blob([currentSvgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schematic.svg';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// Debounce function to limit render calls
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

async function init() {
    // Reflect the persisted theme on the toggle (the head script already set the
    // initial data-theme to avoid a flash).
    applyTheme(storedThemeMode());

    const skins = await loadSkins(skinPaths);
    if (skins.length > 0) {
        populateSkinSelect(skins);
    }

    // Event listeners
    formatButton.addEventListener('click', format);
    downloadButton.addEventListener('click', handleDownload);
    exampleSelect.addEventListener('change', handleExampleChange);
    skinSelect.addEventListener('change', render);
    configSelect.addEventListener('change', render);
    orientSelect.addEventListener('change', render);
    if (themeToggle) {
        themeToggle.addEventListener('click', cycleTheme);
    }
    // Follow the OS when in "system" mode.
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (storedThemeMode() === 'system') applyTheme('system');
        });
    }

    // Debounced render on textarea input
    const debouncedRender = debounce(render, 300);
    textarea.addEventListener('input', debouncedRender);

    // Load default example
    await handleExampleChange();
}

init();