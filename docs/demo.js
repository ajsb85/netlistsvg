'use strict';

const superagent = require('superagent');
const JSON5 = require('json5');
const netlistRenderer = require('../built');

const skinPaths = ['skin/horizontal.svg', 'skin/default.svg'];

const textarea = document.querySelector('#editor');
const skinSelect = document.querySelector('#skinSelect');
const exampleSelect = document.querySelector('#exampleSelect');
const configSelect = document.querySelector('#configSelect');
const formatButton = document.querySelector('#formatButton');
const downloadButton = document.querySelector('#downloadButton');
const svgImage = document.querySelector('#svgArea');
const emptyState = document.querySelector('#emptyState');
const toast = document.querySelector('#toast');

let currentSvgString = '';

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

async function render() {
    hideToast();
    if (!textarea.value.trim()) {
        svgImage.style.display = 'none';
        emptyState.style.display = 'flex';
        downloadButton.style.display = 'none';
        return;
    }

    try {
        const netlist = JSON5.parse(textarea.value);
        const config = HIERARCHY_CONFIGS[configSelect.value];
        const svgString = await netlistRenderer.render(skinSelect.value, netlist, undefined, undefined, config);
        // Export keeps the theme-neutral SVG so it adapts (light/dark) wherever it
        // is embedded. The preview forces the dark theme to match this dashboard.
        currentSvgString = svgString;
        const darkSvg = svgString.replace('<svg ', '<svg class="dark" ');

        svgImage.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(darkSvg)));
        svgImage.style.display = 'block';
        emptyState.style.display = 'none';
        downloadButton.style.display = 'block';
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
        // Auto-enable hierarchy expansion for the hierarchy example so the new
        // feature is visible immediately. The default skin is required because it
        // defines the sub_odd/sub_even templates and the constant/split passes the
        // hierarchical netlist relies on.
        if (examplePath.includes('hierarchy')) {
            selectSkinByPath('default.svg');
            configSelect.value = 'all';
        } else {
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

    // Debounced render on textarea input
    const debouncedRender = debounce(render, 300);
    textarea.addEventListener('input', debouncedRender);

    // Load default example
    await handleExampleChange();
}

init();