"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dumpLayout = dumpLayout;
exports.render = render;
// No major structural changes, just minor cleanup and consistency.
const ELK = require("elkjs");
const onml = require("onml");
const FlatModule_1 = require("./FlatModule");
const Skin_1 = __importDefault(require("./Skin"));
const elkGraph_1 = require("./elkGraph");
const drawModule_1 = __importDefault(require("./drawModule"));
const elk = new ELK();
function createFlatModule(skinData, yosysNetlist) {
    Skin_1.default.skin = onml.p(skinData);
    const layoutProps = Skin_1.default.getProperties();
    const flatModule = new FlatModule_1.FlatModule(yosysNetlist);
    if (layoutProps.constants !== false) {
        flatModule.addConstants();
    }
    if (layoutProps.splitsAndJoins !== false) {
        flatModule.addSplitsJoins();
    }
    flatModule.createWires();
    return flatModule;
}
async function dumpLayout(skinData, yosysNetlist, prelayout, done) {
    try {
        const flatModule = createFlatModule(skinData, yosysNetlist);
        const kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
        if (prelayout) {
            done(null, JSON.stringify(kgraph, null, 2));
            return;
        }
        const layoutProps = Skin_1.default.getProperties();
        const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
        done(null, JSON.stringify(graph, null, 2));
    }
    catch (error) {
        done(error);
    }
}
function render(skinData, yosysNetlist, done, elkData) {
    const flatModule = createFlatModule(skinData, yosysNetlist);
    const kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
    const layoutProps = Skin_1.default.getProperties();
    const renderPromise = (async () => {
        if (elkData) {
            return (0, drawModule_1.default)(elkData, flatModule);
        }
        else {
            try {
                const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
                return (0, drawModule_1.default)(graph, flatModule);
            }
            catch (error) {
                // tslint:disable-next-line:no-console
                console.error(error); // Consistent error handling, even with async/await
                throw error; // Re-throw to propagate to the caller if needed
            }
        }
    })();
    if (done) {
        renderPromise.then((output) => done(null, output), (error) => done(error));
    }
    return renderPromise;
}
//# sourceMappingURL=index.js.map