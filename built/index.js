"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEngine = createEngine;
exports.buildLayoutGraph = buildLayoutGraph;
exports.dumpLayout = dumpLayout;
exports.render = render;
const elkjs_1 = __importDefault(require("elkjs"));
const onml = require("onml");
const FlatModule_1 = require("./FlatModule");
const Skin_1 = __importDefault(require("./Skin"));
const elkGraph_1 = require("./elkGraph");
const drawModule_1 = __importDefault(require("./drawModule"));
function createEngine(engine = 'auto') {
    const useWasm = engine === 'wasm' || (engine === 'auto' && typeof window === 'undefined');
    if (useWasm) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const WasmELK = require('./elkWasmAdapter').default;
        return new WasmELK();
    }
    return new elkjs_1.default();
}
// Default engine (node => WASM, browser => elkjs/window.ELK).
const elk = createEngine('auto');
// Default configuration: hierarchy disabled, top module taken from the netlist.
const defaultConfig = {
    hierarchy: {
        enable: 'off',
        expandLevel: 0,
        expandModules: { types: [], ids: [] },
    },
    top: { enable: false, module: '' },
};
/**
 * Creates a flat module representation from Yosys netlist using skin data.
 * The module is flattened recursively according to the supplied configuration
 * (constants, splits/joins and wires are all built during construction).
 */
function createFlatModule(skinData, yosysNetlist, configData) {
    // Parse skin data
    Skin_1.default.skin = onml.p(skinData);
    const config = configData || defaultConfig;
    return FlatModule_1.FlatModule.fromNetlist(yosysNetlist, config);
}
/**
 * Builds the un-laid-out ELK graph plus the skin's layout options. Lets a caller lay the
 * SAME input graph out with more than one engine (the layout-diff CLI) without rebuilding.
 */
function buildLayoutGraph(skinData, yosysNetlist, configData) {
    const flatModule = createFlatModule(skinData, yosysNetlist, configData);
    const kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
    const layoutOptions = (Skin_1.default.getProperties().layoutEngine || {});
    return { flatModule, kgraph, layoutOptions };
}
/**
 * Generates and returns the ELK graph layout JSON
 */
async function dumpLayout(skinData, yosysNetlist, prelayout, done, engine = 'auto') {
    try {
        // Create module and build graph
        const flatModule = createFlatModule(skinData, yosysNetlist);
        const kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
        // Return unlayouted graph if prelayout is true
        if (prelayout) {
            done(null, JSON.stringify(kgraph, null, 2));
            return;
        }
        // Apply layout and return result
        const layoutProps = Skin_1.default.getProperties();
        const eng = engine === 'auto' ? elk : createEngine(engine);
        const graph = await eng.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
        done(null, JSON.stringify(graph, null, 2));
    }
    catch (error) {
        done(error instanceof Error ? error : new Error(String(error)));
    }
}
/**
 * Renders the Yosys netlist using the provided skin and optional ELK data
 */
function render(skinData, yosysNetlist, done, elkData, configData) {
    // Create module and build graph
    const flatModule = createFlatModule(skinData, yosysNetlist, configData);
    const kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
    const layoutProps = Skin_1.default.getProperties();
    // Define rendering process
    const renderPromise = (async () => {
        // Use provided ELK data if available
        if (elkData) {
            return (0, drawModule_1.default)(elkData, flatModule);
        }
        // Otherwise perform layout and rendering
        try {
            const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
            return (0, drawModule_1.default)(graph, flatModule);
        }
        catch (error) {
            // tslint:disable-next-line:no-console
            console.error(error);
            throw error;
        }
    })();
    // Handle callback if provided
    if (done) {
        renderPromise
            .then(output => done(null, output))
            .catch(error => done(error instanceof Error ? error : new Error(String(error))));
    }
    return renderPromise;
}
//# sourceMappingURL=index.js.map