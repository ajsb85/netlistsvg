"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlatModule = void 0;
exports.arrayToBitstring = arrayToBitstring;
exports.arrayContains = arrayContains;
exports.indexOfContains = indexOfContains;
exports.addToDefaultDict = addToDefaultDict;
exports.getIndicesString = getIndicesString;
exports.gather = gather;
const Skin_1 = __importDefault(require("./Skin"));
const Cell_1 = __importDefault(require("./Cell"));
// Helper functions (outside the class) -  These are now *exported*
function arrayToBitstring(bitArray) {
    return `,${bitArray.join(',')},`;
}
function arrayContains(needle, haystack) {
    return haystack.includes(needle);
}
function indexOfContains(needle, haystack) {
    return haystack.findIndex(hay => hay.includes(needle));
}
function addToDefaultDict(dict, key, value) {
    var _a;
    ((_a = dict[key]) !== null && _a !== void 0 ? _a : (dict[key] = [])).push(value);
}
function getIndicesString(bitstring, query, start) {
    const splitStart = Math.max(bitstring.indexOf(query), start);
    const startIndex = bitstring.substring(0, splitStart).split(',').length - 1;
    const endIndex = startIndex + query.split(',').length - 3;
    return startIndex === endIndex ? String(startIndex) : `${startIndex}:${endIndex}`;
}
function gather(inputs, outputs, toSolve, start, end, splits, joins) {
    const outputIndex = outputs.indexOf(toSolve);
    if (outputIndex !== -1) {
        outputs.splice(outputIndex, 1);
    }
    if (start >= toSolve.length || end - start < 2) {
        return;
    }
    const query = toSolve.slice(start, end);
    if (arrayContains(query, inputs)) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        gather(inputs, outputs, toSolve, end - 1, toSolve.length, splits, joins);
        return;
    }
    const index = indexOfContains(query, inputs);
    if (index !== -1) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        addToDefaultDict(splits, inputs[index], getIndicesString(inputs[index], query, 0));
        inputs.push(query); // We can now match to this split portion
        gather(inputs, outputs, toSolve, end - 1, toSolve.length, splits, joins);
        return;
    }
    if (indexOfContains(query, outputs) !== -1) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        gather(inputs, [], query, 0, query.length, splits, joins); // Gather without outputs
        inputs.push(query); // Add the matched output as a new input for further matching
        return;
    }
    gather(inputs, outputs, toSolve, start, toSolve.substring(0, end).lastIndexOf(',') + 1, splits, joins);
}
class FlatModule {
    constructor(netlist) {
        this.moduleName = Object.keys(netlist.modules).find(name => { var _a; return ((_a = netlist.modules[name].attributes) === null || _a === void 0 ? void 0 : _a.top) === 1; }) || Object.keys(netlist.modules)[0]; // Find top module or default
        const top = netlist.modules[this.moduleName];
        this.nodes = [
            ...Object.entries(top.ports).map(([key, portData]) => Cell_1.default.fromPort(portData, key)),
            ...Object.entries(top.cells).map(([key, cellData]) => Cell_1.default.fromYosysCell(cellData, key)),
        ];
        this.wires = []; // Populated by createWires
    }
    addConstants() {
        let maxNum = this.nodes.reduce((acc, v) => v.maxOutVal(acc), -1);
        const signalsByConstantName = {};
        const newCells = [];
        this.nodes.forEach(node => {
            maxNum = node.findConstants(signalsByConstantName, maxNum, newCells);
        });
        this.nodes.push(...newCells);
    }
    addSplitsJoins() {
        const allInputs = this.nodes.flatMap(node => node.inputPortVals());
        const allOutputs = this.nodes.flatMap(node => node.outputPortVals());
        const splits = {};
        const joins = {};
        const allInputsCopy = allInputs.slice();
        for (const input of allInputs) {
            gather(allOutputs, allInputsCopy, input, 0, input.length, splits, joins);
        }
        const joinCells = Object.entries(joins).map(([joinInputs, [joinOutput]]) => Cell_1.default.fromJoinInfo(joinInputs, joinOutput));
        const splitCells = Object.entries(splits).map(([splitInput, splitOutputs]) => Cell_1.default.fromSplitInfo(splitInput, splitOutputs));
        this.nodes.push(...joinCells, ...splitCells);
    }
    createWires() {
        const layoutProps = Skin_1.default.getProperties();
        const ridersByNet = {};
        const driversByNet = {};
        const lateralsByNet = {};
        this.nodes.forEach(node => node.collectPortsByDirection(// Corrected call
        ridersByNet, driversByNet, lateralsByNet, layoutProps.genericsLaterals));
        const allKeys = [...Object.keys(ridersByNet), ...Object.keys(driversByNet), ...Object.keys(lateralsByNet)];
        const nets = [...new Set(allKeys)]; // Use Set for unique nets
        this.wires = nets.map(net => {
            const drivers = driversByNet[net] || [];
            const riders = ridersByNet[net] || [];
            const laterals = lateralsByNet[net] || [];
            const wire = { netName: net, drivers, riders, laterals };
            [...drivers, ...riders, ...laterals].forEach(port => port.wire = wire);
            return wire;
        });
    }
}
exports.FlatModule = FlatModule;
//# sourceMappingURL=FlatModule.js.map