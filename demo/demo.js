'use strict';

const superagent = require('superagent');
const JSON5 = require('json5');
const netlistRenderer = require('../built');
const exampleNetlist = require('../test/analog/horizontal.json');

const skinPaths = ['skin/horizontal.svg', 'skin/default.svg'];

const textarea = document.querySelector('textarea');
const skinSelect = document.querySelector('#skinSelect');
const renderButton = document.querySelector('#renderButton'); // Keep for manual rendering
const formatButton = document.querySelector('#formatButton');
const svgImage = document.querySelector('#svgArea');

async function loadSkins(paths) {
    try {
        const skinPromises = paths.map(path => superagent.get(path).then(res => ({ path, svg: res.text })));
        const skins = await Promise.all(skinPromises);
        return skins;
    } catch (error) {
        console.error("Error loading skins:", error);
        alert("Error loading skins. See console for details.");
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
    try {
        const netlist = JSON5.parse(textarea.value);
        const svgString = await netlistRenderer.render(skinSelect.value, netlist);
        svgImage.src = 'data:image/svg+xml;base64,' + btoa(svgString);
    } catch (error) {
        console.error("Error rendering netlist:", error);
        // More specific error message for invalid JSON
        if (error instanceof SyntaxError) {
          alert("Invalid JSON in textarea.  Please correct the JSON and try again.");
        } else {
          alert("Error rendering netlist. See console for details.");
        }
    }
}

function format() {
    try {
        const netlist = JSON5.parse(textarea.value);
        textarea.value = JSON5.stringify(netlist, null, 4);
    } catch (error) {
        console.error("Error formatting JSON:", error);
        alert("Invalid JSON5. Please check your input.");
    }
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
    textarea.value = JSON5.stringify(exampleNetlist, null, 4);

    const skins = await loadSkins(skinPaths);
    if (skins.length > 0) {
        populateSkinSelect(skins);
    }

    renderButton.addEventListener('click', render); // Keep manual render
    formatButton.addEventListener('click', format);

    // Debounced render on textarea input
    const debouncedRender = debounce(render, 300); // 300ms delay
    textarea.addEventListener('input', debouncedRender);

    // Initial render
    render();
}

init();