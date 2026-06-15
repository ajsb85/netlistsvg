'use strict';

const superagent = require('superagent');
const JSON5 = require('json5');
const netlistRenderer = require('../built');

const skinPaths = ['skin/horizontal.svg', 'skin/default.svg'];

const textarea = document.querySelector('#editor');
const skinSelect = document.querySelector('#skinSelect');
const exampleSelect = document.querySelector('#exampleSelect');
const formatButton = document.querySelector('#formatButton');
const downloadButton = document.querySelector('#downloadButton');
const svgImage = document.querySelector('#svgArea');
const emptyState = document.querySelector('#emptyState');
const toast = document.querySelector('#toast');

let currentSvgString = '';

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
        const svgString = await netlistRenderer.render(skinSelect.value, netlist);
        currentSvgString = svgString;

        svgImage.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
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

async function handleExampleChange() {
    const examplePath = exampleSelect.value;
    if (!examplePath) return;

    try {
        const res = await superagent.get(examplePath);
        textarea.value = res.text;
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

    // Debounced render on textarea input
    const debouncedRender = debounce(render, 300);
    textarea.addEventListener('input', debouncedRender);

    // Load first example by default
    exampleSelect.selectedIndex = 1;
    await handleExampleChange();
}

init();