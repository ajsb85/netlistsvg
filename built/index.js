'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dumpLayout = dumpLayout;
exports.render = render;
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
    // this can be skipped if there are no 0's or 1's
    if (layoutProps.constants !== false) {
        flatModule.addConstants();
    }
    // this can be skipped if there are no splits or joins
    if (layoutProps.splitsAndJoins !== false) {
        flatModule.addSplitsJoins();
    }
    flatModule.createWires();
    return flatModule;
}
function dumpLayout(skinData, yosysNetlist, prelayout, done) {
    const flatModule = createFlatModule(skinData, yosysNetlist);
    const kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
    if (prelayout) {
        done(null, JSON.stringify(kgraph, null, 2));
        return;
    }
    const layoutProps = Skin_1.default.getProperties();
    const promise = elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
    promise.then((graph) => {
        done(null, JSON.stringify(graph, null, 2));
    }).catch((reason) => {
        throw Error(reason);
    });
}
function render(skinData, yosysNetlist, done, elkData) {
    const flatModule = createFlatModule(skinData, yosysNetlist);
    const kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
    const layoutProps = Skin_1.default.getProperties();
    let promise;
    // if we already have a layout then use it
    if (elkData) {
        promise = new Promise((resolve) => {
            (0, drawModule_1.default)(elkData, flatModule);
            resolve();
        });
    }
    else {
        // otherwise use ELK to generate the layout
        promise = elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine })
            .then((g) => (0, drawModule_1.default)(g, flatModule))
            // tslint:disable-next-line:no-console
            .catch((e) => { console.error(e); });
    }
    // support legacy callback style
    if (typeof done === 'function') {
        promise.then((output) => {
            done(null, output);
            return output;
        }).catch((reason) => {
            throw Error(reason);
        });
    }
    return promise;
}
//# sourceMappingURL=index.js.map