"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlatModule = void 0;
exports.arrayToBitstring = arrayToBitstring;
exports.contains = contains;
exports.findIndexContaining = findIndexContaining;
exports.addToCollection = addToCollection;
exports.getIndicesString = getIndicesString;
exports.processSplitsAndJoins = processSplitsAndJoins;
const Skin_1 = __importDefault(require("./Skin"));
const Cell_1 = __importDefault(require("./Cell"));
// Utility functions
function arrayToBitstring(bitArray) {
    return `,${bitArray.join(',')},`;
}
function contains(needle, haystack) {
    return haystack.includes(needle);
}
function findIndexContaining(needle, haystack) {
    return haystack.findIndex(item => item.includes(needle));
}
function addToCollection(collection, key, value) {
    var _a;
    // Initialize array if it doesn't exist, then add the value
    ((_a = collection[key]) !== null && _a !== void 0 ? _a : (collection[key] = [])).push(value);
}
function getIndicesString(bitstring, query, start) {
    const splitStart = Math.max(bitstring.indexOf(query), start);
    const startIndex = bitstring.substring(0, splitStart).split(',').length - 1;
    const endIndex = startIndex + query.split(',').length - 3;
    return startIndex === endIndex ? String(startIndex) : `${startIndex}:${endIndex}`;
}
/**
 * Process signal connections to identify splits and joins in the circuit
 * @param inputs Available input signals
 * @param outputs Available output signals
 * @param targetSignal Signal to analyze
 * @param start Starting position for analysis
 * @param end Ending position for analysis
 * @param splits Collection of split operations
 * @param joins Collection of join operations
 */
function processSplitsAndJoins(inputs, outputs, targetSignal, start, end, splits, joins) {
    // Remove target from outputs if present
    const outputIndex = outputs.indexOf(targetSignal);
    if (outputIndex !== -1) {
        outputs.splice(outputIndex, 1);
    }
    // Base case: signal is too short or we've reached the end
    if (start >= targetSignal.length || end - start < 2) {
        return;
    }
    const signalSegment = targetSignal.slice(start, end);
    // Case 1: segment is fully contained in inputs
    if (contains(signalSegment, inputs)) {
        if (signalSegment !== targetSignal) {
            addToCollection(joins, targetSignal, getIndicesString(targetSignal, signalSegment, start));
        }
        processSplitsAndJoins(inputs, outputs, targetSignal, end - 1, targetSignal.length, splits, joins);
        return;
    }
    // Case 2: segment is partially contained in inputs
    const partialMatchIndex = findIndexContaining(signalSegment, inputs);
    if (partialMatchIndex !== -1) {
        if (signalSegment !== targetSignal) {
            addToCollection(joins, targetSignal, getIndicesString(targetSignal, signalSegment, start));
        }
        addToCollection(splits, inputs[partialMatchIndex], getIndicesString(inputs[partialMatchIndex], signalSegment, 0));
        inputs.push(signalSegment); // Add the segment to inputs for future matching
        processSplitsAndJoins(inputs, outputs, targetSignal, end - 1, targetSignal.length, splits, joins);
        return;
    }
    // Case 3: segment is in outputs
    if (findIndexContaining(signalSegment, outputs) !== -1) {
        if (signalSegment !== targetSignal) {
            addToCollection(joins, targetSignal, getIndicesString(targetSignal, signalSegment, start));
        }
        processSplitsAndJoins(inputs, [], signalSegment, 0, signalSegment.length, splits, joins);
        inputs.push(signalSegment);
        return;
    }
    // Continue searching with a shorter segment
    const newEnd = targetSignal.substring(0, end).lastIndexOf(',') + 1;
    processSplitsAndJoins(inputs, outputs, targetSignal, start, newEnd, splits, joins);
}
/**
 * Represents a flattened module from a Yosys netlist
 */
class FlatModule {
    /**
     * Create a new FlatModule from a Yosys netlist
     */
    constructor(netlist) {
        // Find the top module or use the first one
        this.moduleName = Object.keys(netlist.modules).find(name => { var _a; return ((_a = netlist.modules[name].attributes) === null || _a === void 0 ? void 0 : _a.top) === 1; }) || Object.keys(netlist.modules)[0];
        const topModule = netlist.modules[this.moduleName];
        // Create nodes from ports and cells
        this.nodes = [
            ...Object.entries(topModule.ports).map(([key, portData]) => Cell_1.default.fromPort(portData, key)),
            ...Object.entries(topModule.cells).map(([key, cellData]) => Cell_1.default.fromYosysCell(cellData, key))
        ];
        this.wires = []; // Will be populated by createWires
    }
    /**
     * Add constant value nodes to the module
     */
    addConstants() {
        let maxNum = this.nodes.reduce((acc, node) => node.maxOutVal(acc), -1);
        const signalsByConstantName = {};
        const newCells = [];
        // Find and create constants
        this.nodes.forEach(node => {
            maxNum = node.findConstants(signalsByConstantName, maxNum, newCells);
        });
        // Add new constant cells
        this.nodes.push(...newCells);
    }
    /**
     * Add split and join nodes to the module
     */
    addSplitsJoins() {
        const allInputs = this.nodes.flatMap(node => node.inputPortVals());
        const allOutputs = this.nodes.flatMap(node => node.outputPortVals());
        const inputsCopy = allInputs.slice();
        const splits = {};
        const joins = {};
        // Process all inputs to find splits and joins
        for (const input of allInputs) {
            processSplitsAndJoins(allOutputs, inputsCopy, input, 0, input.length, splits, joins);
        }
        // Create new cells for joins and splits
        const joinCells = Object.entries(joins).map(([joinInput, [joinOutput]]) => Cell_1.default.fromJoinInfo(joinInput, joinOutput));
        const splitCells = Object.entries(splits).map(([splitInput, splitOutputs]) => Cell_1.default.fromSplitInfo(splitInput, splitOutputs));
        // Add new cells to the module
        this.nodes.push(...joinCells, ...splitCells);
    }
    /**
     * Create wire connections between nodes
     */
    createWires() {
        const layoutProps = Skin_1.default.getProperties();
        const ridersByNet = {};
        const driversByNet = {};
        const lateralsByNet = {};
        // Collect ports by direction
        this.nodes.forEach(node => node.collectPortsByDirection(ridersByNet, driversByNet, lateralsByNet, layoutProps.genericsLaterals));
        // Create unique list of nets
        const allNetNames = [
            ...Object.keys(ridersByNet),
            ...Object.keys(driversByNet),
            ...Object.keys(lateralsByNet)
        ];
        const uniqueNets = [...new Set(allNetNames)];
        // Create wire objects
        this.wires = uniqueNets.map(netName => {
            const drivers = driversByNet[netName] || [];
            const riders = ridersByNet[netName] || [];
            const laterals = lateralsByNet[netName] || [];
            const wire = { netName, drivers, riders, laterals };
            // Connect ports to their wire
            [...drivers, ...riders, ...laterals].forEach(port => {
                port.wire = wire;
            });
            return wire;
        });
    }
}
exports.FlatModule = FlatModule;
//# sourceMappingURL=FlatModule.js.map