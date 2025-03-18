(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.netlistsvg = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const FlatModule_1 = require("./FlatModule");
const YosysModel_1 = __importDefault(require("./YosysModel"));
const Skin_1 = __importDefault(require("./Skin"));
const Port_1 = require("./Port");
const clone = require("clone");
const onml = require("onml");
class Cell {
    /**
     * creates a Cell from a Yosys Port
     * @param yPort the Yosys Port with our port data
     * @param name the name of the port
     */
    static fromPort(yPort, name) {
        const isInput = yPort.direction === YosysModel_1.default.Direction.Input;
        if (isInput) {
            return new Cell(name, '$_inputExt_', [], [new Port_1.Port('Y', yPort.bits)], {});
        }
        return new Cell(name, '$_outputExt_', [new Port_1.Port('A', yPort.bits)], [], {});
    }
    static fromYosysCell(yCell, name) {
        this.setAlternateCellType(yCell);
        const template = Skin_1.default.findSkinType(yCell.type);
        const templateInputPids = Skin_1.default.getInputPids(template);
        const templateOutputPids = Skin_1.default.getOutputPids(template);
        const ports = Object.entries(yCell.connections).map(([portName, conn]) => new Port_1.Port(portName, conn));
        let inputPorts = ports.filter((port) => port.keyIn(templateInputPids));
        let outputPorts = ports.filter((port) => port.keyIn(templateOutputPids));
        if (inputPorts.length + outputPorts.length !== ports.length) {
            const inputPids = YosysModel_1.default.getInputPortPids(yCell);
            const outputPids = YosysModel_1.default.getOutputPortPids(yCell);
            inputPorts = ports.filter((port) => port.keyIn(inputPids));
            outputPorts = ports.filter((port) => port.keyIn(outputPids));
        }
        return new Cell(name, yCell.type, inputPorts, outputPorts, yCell.attributes || {});
    }
    static fromConstantInfo(name, constants) {
        return new Cell(name, '$_constant_', [], [new Port_1.Port('Y', constants)], {});
    }
    /**
     * creates a join cell
     * @param target string name of net (starts and ends with and delimited by commas)
     * @param sources list of index strings (one number, or two numbers separated by a colon)
     */
    static fromJoinInfo(target, sources) {
        const signalStrs = target.slice(1, -1).split(',');
        const signals = signalStrs.map((ss) => Number(ss));
        const joinOutPorts = [new Port_1.Port('Y', signals)];
        const inPorts = sources.map((name) => {
            return new Port_1.Port(name, getBits(signals, name));
        });
        return new Cell('$join$' + target, '$_join_', inPorts, joinOutPorts, {});
    }
    /**
     * creates a split cell
     * @param source string name of net (starts and ends with and delimited by commas)
     * @param targets list of index strings (one number, or two numbers separated by a colon)
     */
    static fromSplitInfo(source, targets) {
        // turn string into array of signal names
        const sigStrs = source.slice(1, -1).split(',');
        // convert the signals into actual numbers
        // after running constant pass, all signals should be numbers
        const signals = sigStrs.map((s) => Number(s));
        const inPorts = [new Port_1.Port('A', signals)];
        const splitOutPorts = targets.map((name) => {
            const sigs = getBits(signals, name);
            return new Port_1.Port(name, sigs);
        });
        return new Cell('$split$' + source, '$_split_', inPorts, splitOutPorts, {});
    }
    // Set cells to alternate types/tags based on their parameters
    static setAlternateCellType(yCell) {
        if ('parameters' in yCell) {
            // if it has a WIDTH parameter greater than one
            // and doesn't have an address parameter (not a memory cell)
            if (yCell.parameters && 'WIDTH' in yCell.parameters &&
                yCell.parameters.WIDTH > 1 &&
                !('ADDR' in yCell.parameters)) {
                // turn into a bus version
                yCell.type = yCell.type + '-bus';
            }
        }
    }
    constructor(key, type, inputPorts, outputPorts, attributes) {
        this.key = key;
        this.type = type;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;
        this.attributes = attributes || {};
        inputPorts.forEach((ip) => {
            ip.parentNode = this;
        });
        outputPorts.forEach((op) => {
            op.parentNode = this;
        });
    }
    get Type() {
        return this.type;
    }
    get Key() {
        return this.key;
    }
    get InputPorts() {
        return this.inputPorts;
    }
    get OutputPorts() {
        return this.outputPorts;
    }
    maxOutVal(atLeast) {
        const maxVal = Math.max(...this.outputPorts.map((op) => op.maxVal()), 0);
        return Math.max(maxVal, atLeast);
    }
    findConstants(sigsByConstantName, maxNum, constantCollector) {
        this.inputPorts.forEach((ip) => {
            maxNum = ip.findConstants(sigsByConstantName, maxNum, constantCollector);
        });
        return maxNum;
    }
    inputPortVals() {
        return this.inputPorts.map((port) => port.valString());
    }
    outputPortVals() {
        return this.outputPorts.map((port) => port.valString());
    }
    collectPortsByDirection(ridersByNet, driversByNet, lateralsByNet, genericsLaterals) {
        const template = Skin_1.default.findSkinType(this.type);
        const lateralPids = Skin_1.default.getLateralPortPids(template);
        // find all ports connected to the same net
        this.inputPorts.forEach((port) => {
            const isLateral = port.keyIn(lateralPids);
            if (isLateral || (template[1]['s:type'] === 'generic' && genericsLaterals)) {
                (0, FlatModule_1.addToDefaultDict)(lateralsByNet, port.valString(), port);
            }
            else {
                (0, FlatModule_1.addToDefaultDict)(ridersByNet, port.valString(), port);
            }
        });
        this.outputPorts.forEach((port) => {
            const isLateral = port.keyIn(lateralPids);
            if (isLateral || (template[1]['s:type'] === 'generic' && genericsLaterals)) {
                (0, FlatModule_1.addToDefaultDict)(lateralsByNet, port.valString(), port);
            }
            else {
                (0, FlatModule_1.addToDefaultDict)(driversByNet, port.valString(), port);
            }
        });
    }
    getValueAttribute() {
        if (this.attributes && this.attributes.value) {
            return this.attributes.value;
        }
        return '';
    }
    getTemplate() {
        return Skin_1.default.findSkinType(this.type);
    }
    buildElkChild() {
        const template = this.getTemplate();
        const type = template[1]['s:type'];
        const layoutAttrs = { 'org.eclipse.elk.portConstraints': 'FIXED_POS' };
        let fixedPosX = null;
        let fixedPosY = null;
        for (const attr in this.attributes) {
            if (attr.startsWith('org.eclipse.elk')) {
                if (attr === 'org.eclipse.elk.x') {
                    fixedPosX = this.attributes[attr];
                    continue;
                }
                if (attr === 'org.eclipse.elk.y') {
                    fixedPosY = this.attributes[attr];
                    continue;
                }
                layoutAttrs[attr] = this.attributes[attr];
            }
        }
        if (type === 'join' ||
            type === 'split' ||
            type === 'generic') {
            const inTemplates = Skin_1.default.getPortsWithPrefix(template, 'in');
            const outTemplates = Skin_1.default.getPortsWithPrefix(template, 'out');
            const inPorts = this.inputPorts.map((ip, i) => ip.getGenericElkPort(i, inTemplates, 'in'));
            const outPorts = this.outputPorts.map((op, i) => op.getGenericElkPort(i, outTemplates, 'out'));
            const cell = {
                id: this.key,
                width: Number(template[1]['s:width']),
                height: Number(this.getGenericHeight()),
                ports: inPorts.concat(outPorts),
                layoutOptions: layoutAttrs,
                labels: [],
            };
            if (fixedPosX) {
                cell.x = fixedPosX;
            }
            if (fixedPosY) {
                cell.y = fixedPosY;
            }
            this.addLabels(template, cell);
            return cell;
        }
        const ports = Skin_1.default.getPortsWithPrefix(template, '').map((tp) => {
            return {
                id: this.key + '.' + tp[1]['s:pid'],
                width: 0,
                height: 0,
                x: Number(tp[1]['s:x']),
                y: Number(tp[1]['s:y']),
            };
        });
        const nodeWidth = Number(template[1]['s:width']);
        const ret = {
            id: this.key,
            width: nodeWidth,
            height: Number(template[1]['s:height']),
            ports,
            layoutOptions: layoutAttrs,
            labels: [],
        };
        if (fixedPosX) {
            ret.x = fixedPosX;
        }
        if (fixedPosY) {
            ret.y = fixedPosY;
        }
        this.addLabels(template, ret);
        return ret;
    }
    render(cell) {
        const template = this.getTemplate();
        const tempclone = clone(template);
        for (const label of cell.labels) {
            const labelIDSplit = label.id.split('.');
            const attrName = labelIDSplit[labelIDSplit.length - 1];
            setTextAttribute(tempclone, attrName, label.text);
        }
        for (let i = 2; i < tempclone.length; i++) {
            const node = tempclone[i];
            if (node[0] === 'text' && node[1]['s:attribute']) {
                const attrib = node[1]['s:attribute'];
                if (!(attrib in this.attributes)) {
                    node[2] = '';
                }
            }
        }
        tempclone[1].id = 'cell_' + this.key;
        tempclone[1].transform = 'translate(' + cell.x + ',' + cell.y + ')';
        if (this.type === '$_split_') {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            const outPorts = Skin_1.default.getPortsWithPrefix(template, 'out');
            const gap = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
            const startY = Number(outPorts[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            this.outputPorts.forEach((op, i) => {
                const portClone = clone(outPorts[0]);
                portClone[portClone.length - 1][2] = op.Key;
                portClone[1].transform = 'translate(' + outPorts[1][1]['s:x'] + ','
                    + (startY + i * gap) + ')';
                tempclone.push(portClone);
            });
        }
        else if (this.type === '$_join_') {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            const inPorts = Skin_1.default.getPortsWithPrefix(template, 'in');
            const gap = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
            const startY = Number(inPorts[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            this.inputPorts.forEach((port, i) => {
                const portClone = clone(inPorts[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + inPorts[1][1]['s:x'] + ','
                    + (startY + i * gap) + ')';
                tempclone.push(portClone);
            });
        }
        else if (template[1]['s:type'] === 'generic') {
            setGenericSize(tempclone, Number(this.getGenericHeight()));
            const inPorts = Skin_1.default.getPortsWithPrefix(template, 'in');
            const ingap = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
            const instartY = Number(inPorts[0][1]['s:y']);
            const outPorts = Skin_1.default.getPortsWithPrefix(template, 'out');
            const outgap = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
            const outstartY = Number(outPorts[0][1]['s:y']);
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            tempclone.pop();
            this.inputPorts.forEach((port, i) => {
                const portClone = clone(inPorts[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + inPorts[1][1]['s:x'] + ','
                    + (instartY + i * ingap) + ')';
                portClone[1].id = 'port_' + port.parentNode.Key + '~' + port.Key;
                tempclone.push(portClone);
            });
            this.outputPorts.forEach((port, i) => {
                const portClone = clone(outPorts[0]);
                portClone[portClone.length - 1][2] = port.Key;
                portClone[1].transform = 'translate(' + outPorts[1][1]['s:x'] + ','
                    + (outstartY + i * outgap) + ')';
                portClone[1].id = 'port_' + port.parentNode.Key + '~' + port.Key;
                tempclone.push(portClone);
            });
            // first child of generic must be a text node.
            tempclone[2][2] = this.type;
        }
        setClass(tempclone, '$cell_id', 'cell_' + this.key);
        return tempclone;
    }
    addLabels(template, cell) {
        onml.traverse(template, {
            enter: (node) => {
                if (node.name === 'text' && node.attr['s:attribute']) {
                    const attrName = node.attr['s:attribute'];
                    let newString;
                    if (attrName === 'ref' || attrName === 'id') {
                        if (this.type === '$_constant_' && this.key.length > 3) {
                            const num = parseInt(this.key, 2);
                            newString = '0x' + num.toString(16);
                        }
                        else {
                            newString = this.key;
                        }
                        this.attributes[attrName] = this.key;
                    }
                    else if (attrName in this.attributes) {
                        newString = this.attributes[attrName];
                    }
                    else {
                        return;
                    }
                    cell.labels.push({
                        id: this.key + '.label.' + attrName,
                        text: newString,
                        x: node.attr.x,
                        y: node.attr.y - 6,
                        height: 11,
                        width: (6 * newString.length),
                    });
                }
            },
        });
    }
    getGenericHeight() {
        const template = this.getTemplate();
        const inPorts = Skin_1.default.getPortsWithPrefix(template, 'in');
        const outPorts = Skin_1.default.getPortsWithPrefix(template, 'out');
        if (this.inputPorts.length > this.outputPorts.length) {
            const gap = Number(inPorts[1][1]['s:y']) - Number(inPorts[0][1]['s:y']);
            return Number(template[1]['s:height']) + gap * (this.inputPorts.length - 2);
        }
        if (outPorts.length > 1) {
            const gap = Number(outPorts[1][1]['s:y']) - Number(outPorts[0][1]['s:y']);
            return Number(template[1]['s:height']) + gap * (this.outputPorts.length - 2);
        }
        return Number(template[1]['s:height']);
    }
}
exports.default = Cell;
function setGenericSize(tempclone, height) {
    onml.traverse(tempclone, {
        enter: (node) => {
            if (node.name === 'rect' && node.attr['s:generic'] === 'body') {
                node.attr.height = height;
            }
        },
    });
}
function setTextAttribute(tempclone, attribute, value) {
    onml.traverse(tempclone, {
        enter: (node) => {
            if (node.name === 'text' && node.attr['s:attribute'] === attribute) {
                node.full[2] = value;
            }
        },
    });
}
function setClass(tempclone, searchKey, className) {
    onml.traverse(tempclone, {
        enter: (node) => {
            const currentClass = node.attr.class;
            if (currentClass && currentClass.includes(searchKey)) {
                node.attr.class = currentClass.replace(searchKey, className);
            }
        },
    });
}
function getBits(signals, indicesString) {
    const index = indicesString.indexOf(':');
    // is it the whole thing?
    if (index === -1) {
        return [signals[Number(indicesString)]];
    }
    else {
        const start = indicesString.slice(0, index);
        const end = indicesString.slice(index + 1);
        const slice = signals.slice(Number(start), Number(end) + 1);
        return slice;
    }
}

},{"./FlatModule":2,"./Port":3,"./Skin":4,"./YosysModel":5,"clone":77,"onml":89}],2:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlatModule = void 0;
exports.arrayToBitstring = arrayToBitstring;
exports.addToDefaultDict = addToDefaultDict;
exports.removeDups = removeDups;
const Skin_1 = __importDefault(require("./Skin"));
const Cell_1 = __importDefault(require("./Cell"));
class FlatModule {
    constructor(netlist) {
        this.moduleName = null;
        // Find top module
        for (const name in netlist.modules) {
            const mod = netlist.modules[name];
            if (mod.attributes && Number(mod.attributes.top) === 1) {
                this.moduleName = name;
                break; // Exit loop once top module is found
            }
        }
        // Default to the first module if no top module is marked
        if (this.moduleName == null) {
            this.moduleName = Object.keys(netlist.modules)[0];
        }
        const top = netlist.modules[this.moduleName];
        const ports = Object.entries(top.ports).map(([key, portData]) => Cell_1.default.fromPort(portData, key));
        const cells = Object.entries(top.cells).map(([key, cellData]) => Cell_1.default.fromYosysCell(cellData, key));
        this.nodes = cells.concat(ports);
        // populated by createWires
        this.wires = [];
    }
    // converts input ports with constant assignments to constant nodes
    addConstants() {
        // find the maximum signal number
        let maxNum = this.nodes.reduce(((acc, v) => v.maxOutVal(acc)), -1);
        // add constants to nodes
        const signalsByConstantName = {};
        const cells = [];
        this.nodes.forEach((n) => {
            maxNum = n.findConstants(signalsByConstantName, maxNum, cells);
        });
        this.nodes = this.nodes.concat(cells);
    }
    // solves for minimal bus splits and joins and adds them to module
    addSplitsJoins() {
        const allInputs = this.nodes.flatMap((n) => n.inputPortVals());
        const allOutputs = this.nodes.flatMap((n) => n.outputPortVals());
        const allInputsCopy = allInputs.slice();
        const splits = {};
        const joins = {};
        allInputs.forEach((input) => {
            gather(allOutputs, allInputsCopy, input, 0, input.length, splits, joins);
        });
        const joinCells = Object.entries(joins).map(([joinInputs, joinOutput]) => {
            return Cell_1.default.fromJoinInfo(joinInputs, joinOutput[0]); // joinOutput is an array
        });
        const splitCells = Object.entries(splits).map(([splitInput, splitOutputs]) => {
            return Cell_1.default.fromSplitInfo(splitInput, splitOutputs);
        });
        this.nodes = this.nodes.concat(joinCells, splitCells);
    }
    // search through all the ports to find all of the wires
    createWires() {
        const layoutProps = Skin_1.default.getProperties();
        const ridersByNet = {};
        const driversByNet = {};
        const lateralsByNet = {};
        this.nodes.forEach((n) => {
            n.collectPortsByDirection(ridersByNet, driversByNet, lateralsByNet, layoutProps.genericsLaterals);
        });
        // list of unique nets
        const allKeys = Object.keys(ridersByNet).concat(Object.keys(driversByNet)).concat(Object.keys(lateralsByNet));
        const nets = removeDups(allKeys);
        const wires = nets.map((net) => {
            const drivers = driversByNet[net] || [];
            const riders = ridersByNet[net] || [];
            const laterals = lateralsByNet[net] || [];
            const wire = { netName: net, drivers, riders, laterals };
            drivers.concat(riders).concat(laterals).forEach((port) => {
                port.wire = wire;
            });
            return wire;
        });
        this.wires = wires;
    }
}
exports.FlatModule = FlatModule;
// returns a string that represents the values of the array of integers
// [1, 2, 3] -> ',1,2,3,'
function arrayToBitstring(bitArray) {
    return ',' + bitArray.join(',') + ',';
}
// returns whether needle is a substring of haystack
function arrayContains(needle, haystack) {
    return (haystack.indexOf(needle) > -1);
}
// returns the index of the string that contains a substring
// given arrhaystack, an array of strings
function indexOfContains(needle, arrhaystack) {
    return arrhaystack.findIndex((haystack) => {
        return arrayContains(needle, haystack);
    });
}
function addToDefaultDict(dict, key, value) {
    if (dict[key] === undefined) {
        dict[key] = [value];
    }
    else {
        dict[key].push(value);
    }
}
// string (for labels), that represents an index
// or range of indices.
function getIndicesString(bitstring, query, start) {
    const splitStart = Math.max(bitstring.indexOf(query), start);
    const startIndex = bitstring.substring(0, splitStart).split(',').length - 1;
    const endIndex = startIndex + query.split(',').length - 3;
    if (startIndex === endIndex) {
        return String(startIndex);
    }
    else {
        return String(startIndex) + ':' + String(endIndex);
    }
}
// gather splits and joins
function gather(inputs, // all inputs
outputs, // all outputs
toSolve, // an input array we are trying to solve
start, // index of toSolve to start from
end, // index of toSolve to end at
splits, // container collecting the splits
joins) {
    // remove myself from outputs list if present
    const outputIndex = outputs.indexOf(toSolve);
    if (outputIndex !== -1) {
        outputs.splice(outputIndex, 1);
    }
    // This toSolve is compconste
    if (start >= toSolve.length || end - start < 2) {
        return;
    }
    const query = toSolve.slice(start, end);
    // are there are perfect matches?
    if (arrayContains(query, inputs)) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        gather(inputs, outputs, toSolve, end - 1, toSolve.length, splits, joins);
        return;
    }
    const index = indexOfContains(query, inputs);
    // are there any partial matches?
    if (index !== -1) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        // found a split
        addToDefaultDict(splits, inputs[index], getIndicesString(inputs[index], query, 0));
        // we can match to this now
        inputs.push(query);
        gather(inputs, outputs, toSolve, end - 1, toSolve.length, splits, joins);
        return;
    }
    // are there any output matches?
    if (indexOfContains(query, outputs) !== -1) {
        if (query !== toSolve) {
            // add to join
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        // gather without outputs
        gather(inputs, [], query, 0, query.length, splits, joins);
        inputs.push(query);
        return;
    }
    gather(inputs, outputs, toSolve, start, start + query.slice(0, -1).lastIndexOf(',') + 1, splits, joins);
}
function removeDups(inStrs) {
    const map = {};
    inStrs.forEach((str) => {
        map[str] = true;
    });
    return Object.keys(map);
}

},{"./Cell":1,"./Skin":4}],3:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Port = void 0;
const Cell_1 = __importDefault(require("./Cell"));
class Port {
    constructor(key, value) {
        this.key = key;
        this.value = value;
    }
    get Key() {
        return this.key;
    }
    keyIn(pids) {
        return pids.includes(this.key);
    }
    maxVal() {
        return Math.max(...this.value.map(v => Number(v)));
    }
    valString() {
        return ',' + this.value.join() + ',';
    }
    findConstants(sigsByConstantName, maxNum, constantCollector) {
        let constNameCollector = '';
        let constNumCollector = [];
        const portSigs = this.value;
        portSigs.forEach((portSig, portSigIndex) => {
            if (portSig === '0' || portSig === '1') {
                maxNum += 1;
                constNameCollector += portSig;
                portSigs[portSigIndex] = maxNum;
                constNumCollector.push(maxNum);
            }
            else if (constNumCollector.length > 0) {
                this.assignConstant(constNameCollector, constNumCollector, portSigIndex, sigsByConstantName, constantCollector);
                constNameCollector = '';
                constNumCollector = [];
            }
        });
        if (constNumCollector.length > 0) {
            this.assignConstant(constNameCollector, constNumCollector, portSigs.length, sigsByConstantName, constantCollector);
        }
        return maxNum;
    }
    getGenericElkPort(index, templatePorts, dir) {
        const nkey = this.parentNode.Key;
        const type = this.parentNode.getTemplate()[1]['s:type'];
        if (index === 0) {
            const ret = {
                id: `${nkey}.${this.key}`,
                width: 1,
                height: 1,
                x: Number(templatePorts[0][1]['s:x']),
                y: Number(templatePorts[0][1]['s:y']),
            };
            if ((type === 'generic' || type === 'join') && dir === 'in' ||
                (type === 'generic' || type === 'split') && dir === 'out') {
                ret.labels = [{
                        id: `${nkey}.${this.key}.label`,
                        text: this.key,
                        x: Number(templatePorts[0][2][1].x) - 10,
                        y: Number(templatePorts[0][2][1].y) - 6,
                        width: 6 * this.key.length,
                        height: 11,
                    }];
            }
            return ret;
        }
        else {
            const gap = Number(templatePorts[1][1]['s:y']) - Number(templatePorts[0][1]['s:y']);
            const ret = {
                id: `${nkey}.${this.key}`,
                width: 1,
                height: 1,
                x: Number(templatePorts[0][1]['s:x']),
                y: index * gap + Number(templatePorts[0][1]['s:y']),
            };
            if (type === 'generic') {
                ret.labels = [{
                        id: `${nkey}.${this.key}.label`,
                        text: this.key,
                        x: Number(templatePorts[0][2][1].x) - 10,
                        y: Number(templatePorts[0][2][1].y) - 6,
                        width: 6 * this.key.length,
                        height: 11,
                    }];
            }
            return ret;
        }
    }
    assignConstant(nameCollector, constants, currIndex, signalsByConstantName, constantCollector) {
        const constName = nameCollector.split('').reverse().join('');
        if (signalsByConstantName.hasOwnProperty(constName)) {
            const constSigs = signalsByConstantName[constName];
            const constLength = constSigs.length;
            constSigs.forEach((constSig, constIndex) => {
                const i = currIndex - constLength + constIndex;
                this.value[i] = constSig;
            });
        }
        else {
            constantCollector.push(Cell_1.default.fromConstantInfo(constName, constants));
            signalsByConstantName[constName] = constants;
        }
    }
}
exports.Port = Port;

},{"./Cell":1}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Skin = void 0;
const onml = require("onml");
var Skin;
(function (Skin) {
    Skin.skin = null;
    function getPortsWithPrefix(template, prefix) {
        const ports = template.filter((e) => {
            try {
                // Check if 'e' is an array and its first element is 'g'
                return Array.isArray(e) && e[0] === 'g' && e[1] &&
                    typeof e[1]['s:pid'] === 'string' && e[1]['s:pid'].startsWith(prefix);
            }
            catch (exception) {
                // Do nothing if the SVG group doesn't have a pin id.
                return false; // Ensure a boolean is returned in the catch block
            }
        });
        return ports;
    }
    Skin.getPortsWithPrefix = getPortsWithPrefix;
    function filterPortPids(template, filter) {
        const ports = template.filter((element) => {
            if (Array.isArray(element) && element[0] === 'g') {
                const attrs = element[1];
                return filter(attrs);
            }
            return false;
        });
        return ports.map((port) => {
            return port[1]['s:pid'];
        });
    }
    // Simplified getInputPids, getOutputPids, getLateralPortPids
    function getInputPids(template) {
        return filterPortPids(template, (attrs) => attrs['s:dir'] === 'in' || attrs['s:position'] === 'top');
    }
    Skin.getInputPids = getInputPids;
    function getOutputPids(template) {
        return filterPortPids(template, (attrs) => attrs['s:dir'] === 'out' || attrs['s:position'] === 'bottom');
    }
    Skin.getOutputPids = getOutputPids;
    function getLateralPortPids(template) {
        return filterPortPids(template, (attrs) => {
            if (attrs['s:dir']) {
                return attrs['s:dir'] === 'lateral';
            }
            // Placeholder: Keep position check IF s:dir is missing.
            if (attrs['s:position']) {
                return attrs['s:position'] === 'left' || attrs['s:position'] === 'right';
            }
            return false;
        });
    }
    Skin.getLateralPortPids = getLateralPortPids;
    function findSkinType(type) {
        let ret = null;
        onml.traverse(Skin.skin, {
            enter: (node, parent) => {
                if (node.name === 's:alias' && node.attr.val === type) {
                    ret = parent;
                }
            },
        });
        if (ret == null) {
            onml.traverse(Skin.skin, {
                enter: (node) => {
                    if (node.attr['s:type'] === 'generic') {
                        ret = node;
                    }
                },
            });
        }
        return ret ? ret.full : null; // Handle case where ret is null
    }
    Skin.findSkinType = findSkinType;
    function getLowPriorityAliases() {
        const ret = []; // Explicitly type ret as string[]
        onml.t(Skin.skin, {
            enter: (node) => {
                if (node.name === 's:low_priority_alias' && typeof node.attr.value === 'string') {
                    ret.push(node.attr.value);
                }
            },
        });
        return ret;
    }
    Skin.getLowPriorityAliases = getLowPriorityAliases;
    function getProperties() {
        let vals = {}; // Initialize vals
        onml.t(Skin.skin, {
            enter: (node) => {
                if (node.name === 's:properties') {
                    // Use Object.entries and reduce for a more functional approach
                    vals = Object.entries(node.attr).reduce((acc, [key, val]) => {
                        const strVal = String(val); // Ensure val is a string
                        if (!isNaN(Number(strVal))) {
                            acc[key] = Number(strVal);
                        }
                        else if (strVal === 'true') {
                            acc[key] = true;
                        }
                        else if (strVal === 'false') {
                            acc[key] = false;
                        }
                        else {
                            acc[key] = strVal;
                        }
                        return acc;
                    }, {});
                }
                else if (node.name === 's:layoutEngine') {
                    vals.layoutEngine = node.attr;
                }
            },
        });
        if (!vals.layoutEngine) {
            vals.layoutEngine = {};
        }
        return vals;
    }
    Skin.getProperties = getProperties;
})(Skin || (exports.Skin = Skin = {}));
exports.default = Skin;

},{"onml":89}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Yosys;
(function (Yosys) {
    let ConstantVal;
    (function (ConstantVal) {
        ConstantVal["Zero"] = "0";
        ConstantVal["One"] = "1";
        ConstantVal["X"] = "x";
    })(ConstantVal || (ConstantVal = {}));
    let Direction;
    (function (Direction) {
        Direction["Input"] = "input";
        Direction["Output"] = "output";
    })(Direction = Yosys.Direction || (Yosys.Direction = {}));
    function getInputPortPids(cell) {
        if (cell.port_directions) {
            return Object.keys(cell.port_directions).filter((k) => {
                return cell.port_directions[k] === Direction.Input;
            });
        }
        return [];
    }
    Yosys.getInputPortPids = getInputPortPids;
    function getOutputPortPids(cell) {
        if (cell.port_directions) {
            return Object.keys(cell.port_directions).filter((k) => {
                return cell.port_directions[k] === Direction.Output;
            });
        }
        return [];
    }
    Yosys.getOutputPortPids = getOutputPortPids;
    let HideName;
    (function (HideName) {
        HideName[HideName["Hide"] = 0] = "Hide";
        HideName[HideName["NoHide"] = 1] = "NoHide";
    })(HideName || (HideName = {}));
})(Yosys || (Yosys = {}));
exports.default = Yosys;

},{}],6:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = drawModule;
exports.removeDummyEdges = removeDummyEdges;
const elkGraph_1 = require("./elkGraph");
const Skin_1 = __importDefault(require("./Skin"));
const onml = require("onml");
var WireDirection;
(function (WireDirection) {
    WireDirection[WireDirection["Up"] = 0] = "Up";
    WireDirection[WireDirection["Down"] = 1] = "Down";
    WireDirection[WireDirection["Left"] = 2] = "Left";
    WireDirection[WireDirection["Right"] = 3] = "Right";
})(WireDirection || (WireDirection = {}));
function drawModule(g, module) {
    var _a, _b;
    const nodes = module.nodes.map((n) => {
        const kchild = g.children.find((c) => c.id === n.Key);
        return n.render(kchild);
    });
    removeDummyEdges(g);
    let lines = [];
    g.edges.forEach((e) => {
        const netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
        const numWires = netId.split(',').length - 2;
        const lineStyle = 'stroke-width: ' + (numWires > 1 ? 2 : 1);
        const netName = 'net_' + netId.slice(1, netId.length - 1) + ' width_' + numWires;
        e.sections.forEach((s) => {
            let startPoint = s.startPoint;
            s.bendPoints = s.bendPoints || [];
            let bends = s.bendPoints.map((b) => {
                const l = ['line', {
                        x1: startPoint.x,
                        x2: b.x,
                        y1: startPoint.y,
                        y2: b.y,
                        class: netName,
                        style: lineStyle,
                    }];
                startPoint = b;
                return l;
            });
            if (e.junctionPoints) {
                const circles = e.junctionPoints.map((j) => ['circle', {
                        cx: j.x,
                        cy: j.y,
                        r: (numWires > 1 ? 3 : 2),
                        style: 'fill:#000',
                        class: netName,
                    }]);
                bends = bends.concat(circles);
            }
            const line = [['line', {
                        x1: startPoint.x,
                        x2: s.endPoint.x,
                        y1: startPoint.y,
                        y2: s.endPoint.y,
                        class: netName,
                        style: lineStyle,
                    }]];
            bends.push(...line); // Use push(...line) instead of concat
            lines.push(...bends);
        });
    });
    let labels = [];
    for (const index in g.edges) {
        if (g.edges.hasOwnProperty(index)) {
            const e = g.edges[index];
            const netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
            const numWires = netId.split(',').length - 2;
            const netName = 'net_' + netId.slice(1, netId.length - 1) +
                ' width_' + numWires +
                ' busLabel_' + numWires;
            if (((_b = (_a = e.labels) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text) !== undefined) { // Use optional chaining
                const label = [
                    ['rect',
                        {
                            x: e.labels[0].x + 1,
                            y: e.labels[0].y - 1,
                            width: (e.labels[0].text.length + 2) * 6 - 2,
                            height: 9,
                            class: netName,
                            style: 'fill: white; stroke: none',
                        },
                    ], ['text',
                        {
                            x: e.labels[0].x,
                            y: e.labels[0].y + 7,
                            class: netName,
                        },
                        '/' + e.labels[0].text + '/',
                    ],
                ];
                labels.push(...label); // Use push(...label)
            }
        }
    }
    if (labels !== undefined && labels.length > 0) {
        lines.push(...labels); // Use push(...labels)
    }
    const svgAttrs = Skin_1.default.skin[1];
    svgAttrs.width = g.width.toString();
    svgAttrs.height = g.height.toString();
    const styles = ['style', {}, ''];
    onml.t(Skin_1.default.skin, {
        enter: (node) => {
            if (node.name === 'style') {
                styles[2] += node.full[2];
            }
        },
    });
    const elements = [styles, ...nodes, ...lines];
    const ret = ['svg', svgAttrs];
    elements.forEach(element => {
        ret.push(element);
    });
    return onml.s(ret);
}
function which_dir(start, end) {
    if (end.x === start.x && end.y === start.y) {
        throw new Error('start and end are the same');
    }
    if (end.x !== start.x && end.y !== start.y) {
        throw new Error('start and end arent orthogonal');
    }
    if (end.x > start.x) {
        return WireDirection.Right;
    }
    if (end.x < start.x) {
        return WireDirection.Left;
    }
    if (end.y > start.y) {
        return WireDirection.Down;
    }
    if (end.y < start.y) {
        return WireDirection.Up;
    }
    throw new Error('unexpected direction');
}
function findBendNearDummy(net, dummyIsSource, dummyLoc) {
    const candidates = net.map((edge) => {
        const bends = edge.sections[0].bendPoints || []; // Default to empty array
        if (dummyIsSource) {
            return bends[0]; // Safe access, first element
        }
        else {
            return bends[bends.length - 1]; // Safe access, last element
        }
    }).filter((p) => p !== null && p !== undefined); // Filter out null and undefined
    if (candidates.length === 0) {
        return undefined; // No valid candidates
    }
    // Find the closest bend point using Euclidean distance
    let closestBend = candidates[0];
    let minDistance = Number.MAX_VALUE;
    for (const pt of candidates) {
        const distance = Math.sqrt((dummyLoc.x - pt.x) ** 2 + (dummyLoc.y - pt.y) ** 2); // Euclidean
        if (distance < minDistance) {
            minDistance = distance;
            closestBend = pt;
        }
    }
    return closestBend;
}
function removeDummyEdges(g) {
    let dummyNum = 0;
    while (dummyNum < 10000) {
        const dummyId = '$d_' + String(dummyNum);
        const edgeGroup = g.edges.filter((e) => {
            return e.source === dummyId || e.target === dummyId;
        });
        if (edgeGroup.length === 0) {
            break;
        }
        let dummyIsSource;
        let dummyLoc;
        const firstEdge = edgeGroup[0];
        if (firstEdge.source === dummyId) {
            dummyIsSource = true;
            dummyLoc = firstEdge.sections[0].startPoint;
        }
        else {
            dummyIsSource = false;
            dummyLoc = firstEdge.sections[0].endPoint;
        }
        const newEnd = findBendNearDummy(edgeGroup, dummyIsSource, dummyLoc);
        if (newEnd === undefined) { // Handle potential undefined return
            dummyNum++;
            continue; // Skip to the next dummy if no bend point is found
        }
        for (const edge of edgeGroup) {
            const section = edge.sections[0];
            if (dummyIsSource) {
                section.startPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.shift();
                }
            }
            else {
                section.endPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.pop();
                }
            }
        }
        const directions = new Set(edgeGroup.flatMap((edge) => {
            const section = edge.sections[0];
            let point; // Extract the point to a variable
            if (dummyIsSource) {
                if (section.bendPoints && section.bendPoints.length > 0) {
                    point = section.bendPoints[0];
                }
                else {
                    point = section.endPoint;
                }
            }
            else {
                if (section.bendPoints && section.bendPoints.length > 0) {
                    point = section.bendPoints[section.bendPoints.length - 1];
                }
                else {
                    point = section.startPoint;
                }
            }
            // Use the extracted point for direction calculation
            if (point.x > newEnd.x) {
                return WireDirection.Right;
            }
            if (point.x < newEnd.x) {
                return WireDirection.Left;
            }
            if (point.y > newEnd.y) {
                return WireDirection.Down;
            }
            return WireDirection.Up;
        }));
        if (directions.size < 3) {
            edgeGroup.forEach((edge) => {
                if (edge.junctionPoints) {
                    edge.junctionPoints = edge.junctionPoints.filter((junct) => {
                        return junct.x !== newEnd.x || junct.y !== newEnd.y; // Correct comparison
                    });
                }
            });
        }
        dummyNum += 1;
    }
}

},{"./Skin":4,"./elkGraph":7,"onml":89}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElkModel = void 0;
exports.buildElkGraph = buildElkGraph;
var ElkModel;
(function (ElkModel) {
    ElkModel.wireNameLookup = {};
    ElkModel.dummyNum = 0;
    ElkModel.edgeIndex = 0;
})(ElkModel || (exports.ElkModel = ElkModel = {}));
function buildElkGraph(module) {
    const children = module.nodes.map((n) => {
        return n.buildElkChild();
    });
    ElkModel.edgeIndex = 0;
    ElkModel.dummyNum = 0;
    const edges = [];
    module.wires.forEach((w) => {
        const numWires = w.netName.split(',').length - 2;
        if (w.drivers.length > 0 && w.riders.length > 0 && w.laterals.length === 0) {
            route(w.drivers, w.riders, edges, numWires);
        }
        else if (w.drivers.concat(w.riders).length > 0 && w.laterals.length > 0) {
            route(w.drivers, w.laterals, edges, numWires);
            route(w.laterals, w.riders, edges, numWires);
        }
        else if (w.riders.length === 0 && w.drivers.length > 1) {
            const dummyId = addDummy(children);
            ElkModel.dummyNum += 1;
            const dummyEdges = w.drivers.map((driver) => {
                const sourceParentKey = driver.parentNode.Key;
                const id = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const d = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + driver.key,
                    target: dummyId,
                    targetPort: dummyId + '.p',
                };
                ElkModel.wireNameLookup[id] = driver.wire.netName;
                return d;
            });
            edges.push(...dummyEdges); // Append dummyEdges
        }
        else if (w.riders.length > 1 && w.drivers.length === 0) {
            const dummyId = addDummy(children);
            ElkModel.dummyNum += 1;
            const dummyEdges = w.riders.map((rider) => {
                const sourceParentKey = rider.parentNode.Key;
                const id = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const edge = {
                    id,
                    source: dummyId,
                    sourcePort: dummyId + '.p',
                    target: sourceParentKey,
                    targetPort: sourceParentKey + '.' + rider.key,
                };
                ElkModel.wireNameLookup[id] = rider.wire.netName;
                return edge;
            });
            edges.push(...dummyEdges); //Append dummyEdges
        }
        else if (w.laterals.length > 1) {
            const source = w.laterals[0];
            const sourceParentKey = source.parentNode.Key;
            const lateralEdges = w.laterals.slice(1).map((lateral) => {
                const lateralParentKey = lateral.parentNode.Key;
                const id = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const edge = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + source.key,
                    target: lateralParentKey,
                    targetPort: lateralParentKey + '.' + lateral.key,
                };
                ElkModel.wireNameLookup[id] = lateral.wire.netName;
                return edge;
            });
            edges.push(...lateralEdges); // Append lateralEdges
        }
        // No need to return anything for forEach
    });
    return {
        id: module.moduleName,
        children,
        edges,
    };
}
function addDummy(children) {
    const dummyId = '$d_' + String(ElkModel.dummyNum);
    const child = {
        id: dummyId,
        width: 0,
        height: 0,
        ports: [{
                id: dummyId + '.p',
                width: 0,
                height: 0,
            }],
        layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE' },
    };
    children.push(child);
    return dummyId;
}
function route(sourcePorts, targetPorts, edges, numWires) {
    sourcePorts.forEach((sourcePort) => {
        const sourceParentKey = sourcePort.parentNode.key;
        const sourceKey = sourceParentKey + '.' + sourcePort.key;
        let edgeLabel; // Allow undefined
        if (numWires > 1) {
            edgeLabel = [{
                    id: '',
                    text: String(numWires),
                    width: 4,
                    height: 6,
                    x: 0,
                    y: 0,
                    layoutOptions: {
                        'org.eclipse.elk.edgeLabels.inline': true,
                    },
                }];
        }
        targetPorts.forEach((targetPort) => {
            const targetParentKey = targetPort.parentNode.key;
            const targetKey = targetParentKey + '.' + targetPort.key;
            const id = 'e' + ElkModel.edgeIndex;
            const edge = {
                id,
                labels: edgeLabel, // Use the potentially undefined edgeLabel
                sources: [sourceKey],
                targets: [targetKey],
            };
            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
            if (sourcePort.parentNode.type !== '$dff') {
                edge.layoutOptions = {
                    'org.eclipse.elk.layered.priority.direction': 10,
                    'org.eclipse.elk.edge.thickness': (numWires > 1 ? 2 : 1)
                };
            }
            else {
                edge.layoutOptions = { 'org.eclipse.elk.edge.thickness': (numWires > 1 ? 2 : 1) };
            }
            ElkModel.edgeIndex += 1;
            edges.push(edge); // Push the new edge
        });
    });
}

},{}],8:[function(require,module,exports){
(function (global){(function (){
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dumpLayout = dumpLayout;
exports.render = render;
const ELK = (typeof window !== "undefined" ? window['ELK'] : typeof global !== "undefined" ? global['ELK'] : null);
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

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./FlatModule":2,"./Skin":4,"./drawModule":6,"./elkGraph":7,"onml":89}],9:[function(require,module,exports){
(function (Buffer){(function (){
const lib = require('../built');

const json5 = require('json5');
const Ajv = require('ajv');
var ajv = new Ajv({allErrors: true});
require('ajv-errors')(ajv);

const digital = "<svg  xmlns=\"http://www.w3.org/2000/svg\"\n  xmlns:xlink=\"http://www.w3.org/1999/xlink\"\n  xmlns:s=\"https://github.com/nturley/netlistsvg\"\n  width=\"800\" height=\"500\">\n  <s:properties>\n    <s:layoutEngine\n      org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers=\"35\"\n      org.eclipse.elk.spacing.nodeNode= \"35\"\n      org.eclipse.elk.layered.layering.strategy= \"LONGEST_PATH\"\n    />\n    <s:low_priority_alias val=\"$dff\" />\n  </s:properties>\n<style>\nsvg {\n  stroke:#000;\n  fill:none;\n}\ntext {\n  fill:#000;\n  stroke:none;\n  font-size:10px;\n  font-weight: bold;\n  font-family: \"Courier New\", monospace;\n}\nline {\n    stroke-linecap: round;\n}\n.nodelabel {\n  text-anchor: middle;\n}\n.inputPortLabel {\n  text-anchor: end;\n}\n.splitjoinBody {\n  fill:#000;\n}\n</style>\n\n  <g s:type=\"mux\" transform=\"translate(50, 50)\" s:width=\"20\" s:height=\"40\">\n    <s:alias val=\"$pmux\"/>\n    <s:alias val=\"$mux\"/>\n    <s:alias val=\"$_MUX_\"/>\n\n    <path d=\"M0,0 L20,10 L20,30 L0,40 Z\" class=\"$cell_id\"/>\n\n    <text x=\"5\" y=\"32\" class=\"nodelabel $cell_id\" s:attribute=\"\">1</text>\n    <text x=\"5\" y=\"13\" class=\"nodelabel $cell_id\" s:attribute=\"\">0</text>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"A\"/>\n    <g s:x=\"0\" s:y=\"30\" s:pid=\"B\"/>\n    <g s:x=\"10\" s:y=\"35\" s:pid=\"S\"/>\n    <g s:x=\"20\" s:y=\"20\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"mux-bus\" transform=\"translate(100, 50)\" s:width=\"24\" s:height=\"40\">\n    <s:alias val=\"$pmux-bus\"/>\n    <s:alias val=\"$mux-bus\"/>\n    <s:alias val=\"$_MUX_-bus\"/>\n\n    <path d=\"M0,0 L20,10 L20,30 L0,40 Z\" class=\"$cell_id\"/>\n    <path d=\"M4,2 L4,0 L22,9 L22,31 L4,40 L4,38\" class=\"$cell_id\"/>\n    <path d=\"M8,2 L8,0 L24,8 L24,32 L8,40 L8,38\" class=\"$cell_id\"/>\n\n    <text x=\"5\" y=\"32\" class=\"nodelabel $cell_id\" s:attribute=\"\">1</text>\n    <text x=\"5\" y=\"13\" class=\"nodelabel $cell_id\" s:attribute=\"\">0</text>\n    <g s:x=\"-1\" s:y=\"10\" s:pid=\"A\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"B\"/>\n    <g s:x=\"12\" s:y=\"38\" s:pid=\"S\"/>\n    <g s:x=\"24.5\" s:y=\"20\" s:pid=\"Y\"/>\n  </g>\n\n  <!-- and -->\n  <g s:type=\"and\" transform=\"translate(150,50)\" s:width=\"30\" s:height=\"25\">\n    <s:alias val=\"$and\"/>\n    <s:alias val=\"$logic_and\"/>\n    <s:alias val=\"$_AND_\"/>\n    <s:alias val=\"$reduce_and\"/>\n\n    <path d=\"M0,0 L0,25 L15,25 A15 12.5 0 0 0 15,0 Z\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"0\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"30\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n  <g s:type=\"nand\" transform=\"translate(150,100)\" s:width=\"30\" s:height=\"25\">\n    <s:alias val=\"$nand\"/>\n    <s:alias val=\"$logic_nand\"/>\n    <s:alias val=\"$_NAND_\"/>\n\n    <path d=\"M0,0 L0,25 L15,25 A15 12.5 0 0 0 15,0 Z\" class=\"$cell_id\"/>\n    <circle cx=\"34\" cy=\"12.5\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"0\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"36\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n  <g s:type=\"andnot\" transform=\"translate(200,50)\" s:width=\"30\" s:height=\"25\">\n    <s:alias val=\"$_ANDNOT_\"/>\n\n    <path d=\"M0,0 L0,25 L15,25 A15 12.5 0 0 0 15,0 Z\" class=\"$cell_id\"/>\n    <circle cx=\"-3\" cy=\"20\" r=\"3\"/>\n\n    <g s:x=\"0\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"-6\" s:y=\"20\" s:pid=\"B\"/>\n    <!-- <path d=\"M -10,20 L -6,20\"/> -->\n    <g s:x=\"30\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <!-- or -->\n  <g s:type=\"or\" transform=\"translate(250,50)\" s:width=\"30\" s:height=\"25\">\n    <s:alias val=\"$or\"/>\n    <s:alias val=\"$logic_or\"/>\n    <s:alias val=\"$_OR_\"/>\n    <s:alias val=\"$reduce_or\"/>\n    <s:alias val=\"$reduce_bool\"/>\n\n    <path d=\"M0,0 A30 25 0 0 1 0,25 A30 25 0 0 0 30,12.5 A30 25 0 0 0 0,0\" class=\"$cell_id\"/>\n \n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"30\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n  <g s:type=\"reduce_nor\" transform=\"translate(250, 100)\" s:width=\"33\" s:height=\"25\">\n    <s:alias val=\"$nor\"/>\n    <s:alias val=\"$reduce_nor\"/>\n    <s:alias val=\"$_NOR_\"/>\n    <s:alias val=\"$_ORNOT_\"/>\n\n    <path d=\"M0,0 A30 25 0 0 1 0,25 A30 25 0 0 0 30,12.5 A30 25 0 0 0 0,0\" class=\"$cell_id\"/>\n    <circle cx=\"33\" cy=\"12.5\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"36\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n  <g s:type=\"ornot\" transform=\"translate(300,50)\" s:width=\"30\" s:height=\"25\">\n    <s:alias val=\"$_ORNOT_\"/>\n\n    <path d=\"M0,0 A30 25 0 0 1 0,25 A30 25 0 0 0 30,12.5 A30 25 0 0 0 0,0\" class=\"$cell_id\"/>\n    <circle cx=\"-1\" cy=\"20\" r=\"3\"/>\n \n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"-4\" s:y=\"20\" s:pid=\"B\"/>\n    <!-- <path d=\"M -8,20 L -4,20\"/> -->\n    <g s:x=\"30\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <!--xor -->\n  <g s:type=\"reduce_xor\" transform=\"translate(350, 50)\" s:width=\"33\" s:height=\"25\">\n    <s:alias val=\"$xor\"/>\n    <s:alias val=\"$reduce_xor\"/>\n    <s:alias val=\"$_XOR_\"/>\n\n    <path d=\"M3,0 A30 25 0 0 1 3,25 A30 25 0 0 0 33,12.5 A30 25 0 0 0 3,0\" class=\"$cell_id\"/>\n    <path d=\"M0,0 A30 25 0 0 1 0,25\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"33\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"reduce_nxor\" transform=\"translate(350, 100)\" s:width=\"33\" s:height=\"25\">\n    <s:alias val=\"$xnor\"/>\n    <s:alias val=\"$reduce_xnor\"/>\n    <s:alias val=\"$_XNOR_\"/>\n\n    <path d=\"M3,0 A30 25 0 0 1 3,25 A30 25 0 0 0 33,12.5 A30 25 0 0 0 3,0\" class=\"$cell_id\"/>\n    <path d=\"M0,0 A30 25 0 0 1 0,25\" class=\"$cell_id\"/>\n    <circle cx=\"36\" cy=\"12.5\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"38\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"tribuf\" transform=\"translate(550, 50)\" s:width=\"15\" s:height=\"30\">\n    <s:alias val=\"$tribuf\"/>\n    <s:alias val=\"$_TRIBUF_\"/>\n\n    <s:alias val=\"tribuf-bus\"/>\n    <s:alias val=\"$tribuf-bus\"/>\n    <s:alias val=\"$_TRIBUF_-bus\"/>\n\n    <path d=\"M0,0 L25,15 L0,30 Z\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"15\" s:pid=\"A\"/>\n    <g s:x=\"11\" s:y=\"6\" s:pid=\"EN\"/>\n    <g s:x=\"25\" s:y=\"15\" s:pid=\"Y\"/>\n    <!-- <path d=\"M -5,15 L 0,15\" /> -->\n    <!-- <path d=\"M 11,0 L 11,6\" /> -->\n    <!-- <path d=\"M 30,15 L 25,15\" /> -->\n  </g>\n\n  <!--buffer -->\n  <g s:type=\"not\" transform=\"translate(450,100)\" s:width=\"30\" s:height=\"20\">\n    <s:alias val=\"$_NOT_\"/>\n    <s:alias val=\"$not\"/>\n    <s:alias val=\"$logic_not\"/>\n\n    <path d=\"M0,0 L0,20 L20,10 Z\" class=\"$cell_id\"/>\n    <circle cx=\"24\" cy=\"10\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"-1\" s:y=\"10\" s:pid=\"A\"/>\n    <g s:x=\"27\" s:y=\"10\" s:pid=\"Y\"/>\n  </g>\n  <g s:type=\"buf\" transform=\"translate(450,50)\" s:width=\"30\" s:height=\"20\">\n    <s:alias val=\"$_BUF_\"/>\n\n    <path d=\"M0,0 L0,20 L20,10 Z\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"A\"/>\n    <g s:x=\"20\" s:y=\"10\" s:pid=\"Y\"/>\n    <!-- <path d=\"M -5,10 L 0,10\"/> -->\n    <!-- <path d=\"M 25,10 L 20,10\"/> -->\n  </g>\n\n  <g s:type=\"add\" transform=\"translate(50, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$add\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"12.5\" y2=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"12.5\" x2=\"12.5\" y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"pos\" transform=\"translate(100, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$pos\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"12.5\" y2=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"12.5\" x2=\"12.5\" y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"-1\" s:y=\"12.5\" s:pid=\"A\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"sub\" transform=\"translate(150,150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$sub\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"12.5\" y2=\"12.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"neg\" transform=\"translate(200,150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$neg\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"12.5\" y2=\"12.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"12.5\" s:pid=\"A\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"eq\" transform=\"translate(250,150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$eq\"/>\n    <s:alias val=\"$eqx\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"10\" y2=\"10\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"15\" y2=\"15\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"mul\" transform=\"translate(300, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$mul\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\"  x2=\"17.5\" y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n    <line x1=\"17.5\" x2=\"7.5\"  y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"div\" transform=\"translate(350, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$div\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"15\" x2=\"10\"  y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"mod\" transform=\"translate(400, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$mod\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"15\" x2=\"10\"  y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n    <circle r=\"2\" cx=\"8\" cy=\"9\" class=\"$cell_id\"/>\n    <circle r=\"2\" cx=\"17\" cy=\"16\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"pow\" transform=\"translate(450, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$pow\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"10\" x2=\"12.5\"  y1=\"12\" y2=\"6\" class=\"$cell_id\"/>\n    <line x1=\"15\" x2=\"12.5\"  y1=\"12\" y2=\"6\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"ne\" transform=\"translate(500,150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$ne\"/>\n    <s:alias val=\"$nex\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"10\" y2=\"10\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"15\" y2=\"15\" class=\"$cell_id\"/>\n    <line x1=\"9\" x2=\"16\" y1=\"18\" y2=\"7\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"lt\" transform=\"translate(50,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$lt\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"17\" y1=\"12\"  y2=\"7\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"17\" y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"le\" transform=\"translate(100,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$le\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"17\" y1=\"11\"  y2=\"6\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"17\" y1=\"11\" y2=\"16\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"17\" y1=\"14\" y2=\"19\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"ge\" transform=\"translate(150,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$ge\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"19\"  y1=\"6\" y2=\"11\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"19\" y1=\"16\" y2=\"11\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"19\" y1=\"19\" y2=\"14\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"gt\" transform=\"translate(200,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$gt\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"19\"  y1=\"7\" y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"19\" y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"shr\" transform=\"translate(250,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$shr\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"13\"  y1=\"7\"  y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"13\"  y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"14\" x2=\"19\" y1=\"7\"  y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"14\" x2=\"19\" y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"shl\" transform=\"translate(300,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$shl\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"11\"  y1=\"12\" y2=\"7\"  class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"11\"  y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n    <line x1=\"12\" x2=\"17\" y1=\"12\" y2=\"7\"  class=\"$cell_id\"/>\n    <line x1=\"12\" x2=\"17\" y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"sshr\" transform=\"translate(350,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$sshr\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"5\"  x2=\"10\" y1=\"7\"  y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"5\"  x2=\"10\" y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"11\" x2=\"16\" y1=\"7\"  y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"11\" x2=\"16\" y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"17\" x2=\"22\" y1=\"7\"  y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"17\" x2=\"22\" y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"sshl\" transform=\"translate(400,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$sshl\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"3\"  x2=\"8\"   y1=\"12\" y2=\"7\"  class=\"$cell_id\"/>\n    <line x1=\"3\"  x2=\"8\"   y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n    <line x1=\"9\"  x2=\"14\" y1=\"12\" y2=\"7\"  class=\"$cell_id\"/>\n    <line x1=\"9\"  x2=\"14\" y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n    <line x1=\"15\" x2=\"20\" y1=\"12\" y2=\"7\"  class=\"$cell_id\"/>\n    <line x1=\"15\" x2=\"20\" y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"inputExt\" transform=\"translate(50,250)\" s:width=\"30\" s:height=\"20\">\n    <text x=\"15\" y=\"-4\" class=\"nodelabel $cell_id\" s:attribute=\"ref\">input</text>\n    <s:alias val=\"$_inputExt_\"/>\n    <path d=\"M0,0 L0,20 L15,20 L30,10 L15,0 Z\" class=\"$cell_id\"/>\n    <g s:x=\"30\" s:y=\"10\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"constant\" transform=\"translate(150,250)\" s:width=\"30\" s:height=\"20\">\n    <text x=\"15\" y=\"-4\" class=\"nodelabel $cell_id\" s:attribute=\"ref\">constant</text>\n\n    <s:alias val=\"$_constant_\"/>\n    <rect width=\"30\" height=\"20\" class=\"$cell_id\"/>\n\n    <g s:x=\"31\" s:y=\"10\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"outputExt\" transform=\"translate(250,250)\" s:width=\"30\" s:height=\"20\">\n    <text x=\"15\" y=\"-4\" class=\"nodelabel $cell_id\" s:attribute=\"ref\">output</text>\n    <s:alias val=\"$_outputExt_\"/>\n    <path d=\"M30,0 L30,20 L15,20 L0,10 L15,0 Z\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"A\"/>\n  </g>\n\n  <g s:type=\"split\" transform=\"translate(350,250)\" s:width=\"5\" s:height=\"40\">\n    <rect width=\"5\" height=\"40\" class=\"splitjoinBody\" s:generic=\"body\"/>\n    <s:alias val=\"$_split_\"/>\n\n    <g s:x=\"0\" s:y=\"20\" s:pid=\"in\"/>\n    <g transform=\"translate(5, 10)\" s:x=\"4\" s:y=\"10\" s:pid=\"out0\">\n      <text x=\"5\" y=\"-4\">hi:lo</text>\n    </g>\n    <g transform=\"translate(5, 30)\" s:x=\"4\" s:y=\"30\" s:pid=\"out1\">\n      <text x=\"5\" y=\"-4\">hi:lo</text>\n    </g>\n  </g>\n\n  <g s:type=\"join\" transform=\"translate(450,250)\" s:width=\"4\" s:height=\"40\">\n    <rect width=\"5\" height=\"40\" class=\"splitjoinBody\" s:generic=\"body\"/>\n    <s:alias val=\"$_join_\"/>\n    <g s:x=\"5\" s:y=\"20\"  s:pid=\"out\"/>\n    <g transform=\"translate(0, 10)\" s:x=\"0\" s:y=\"10\" s:pid=\"in0\">\n      <text x=\"-3\" y=\"-4\" class=\"inputPortLabel\">hi:lo</text>\n    </g>\n    <g transform=\"translate(0, 30)\" s:x=\"0\" s:y=\"30\" s:pid=\"in1\">\n      <text x=\"-3\" y=\"-4\" class=\"inputPortLabel\">hi:lo</text>\n    </g>\n  </g>\n\n  <g s:type=\"dff\" transform=\"translate(50,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dff\"/>\n    <s:alias val=\"$_DFF_\"/>\n    <s:alias val=\"$_DFF_P_\"/>\n\n    <s:alias val=\"$adff\"/>\n    <s:alias val=\"$_DFF_\"/>\n    <s:alias val=\"$_DFF_P_\"/>\n\n    <s:alias val=\"$sdff\"/>\n    <s:alias val=\"$_DFF_\"/>\n    <s:alias val=\"$_DFF_P_\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n    <path d=\"M0,35 L5,30 L0,25\" class=\"$cell_id\"/>\n\n    <g s:x=\"31\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"CLK\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"C\"/>\n    <g s:x=\"-1\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"15\" s:y=\"40\" s:pid=\"ARST\"/>\n    <g s:x=\"15\" s:y=\"40\" s:pid=\"SRST\"/>\n  </g>\n\n  <g s:type=\"dff-bus\" transform=\"translate(100,300)\" s:width=\"34\" s:height=\"44\">\n    <s:alias val=\"$dff-bus\"/>\n    <s:alias val=\"$_DFF_-bus\"/>\n    <s:alias val=\"$_DFF_P_-bus\"/>\n\n    <s:alias val=\"adff-bus\"/>\n    <s:alias val=\"$adff-bus\"/>\n    <s:alias val=\"$_DFF_-bus\"/>\n    <s:alias val=\"$_DFF_P_-bus\"/>\n\n    <s:alias val=\"sdff-bus\"/>\n    <s:alias val=\"$sdff-bus\"/>\n    <s:alias val=\"$_DFF_-bus\"/>\n    <s:alias val=\"$_DFF_P_-bus\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n    <path d=\"M0,35 L5,30 L0,25\" class=\"$cell_id\"/>\n    <path d=\"M30,2 L32,2 L32,42 L2,42 L2,40\" class=\"$cell_id\"/>\n    <path d=\"M32,4 L34,4 L34,44 L4,44 L4,42\" class=\"$cell_id\"/>\n\n    <g s:x=\"35\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"CLK\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"C\"/>\n    <g s:x=\"-1\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"17\" s:y=\"44\" s:pid=\"ARST\"/>\n    <g s:x=\"17\" s:y=\"44\" s:pid=\"SRST\"/>\n  </g>\n\n  <g s:type=\"dffn\" transform=\"translate(150,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dffn\"/>\n    <s:alias val=\"$_DFF_N_\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n    <path d=\"M0,35 L5,30 L0,25\" class=\"$cell_id\"/>\n    <circle cx=\"-3\" cy=\"30\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"30\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"-6\" s:y=\"30\" s:pid=\"CLK\"/>\n    <g s:x=\"-6\" s:y=\"30\" s:pid=\"C\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n  </g>\n\n  <g s:type=\"dffn-bus\" transform=\"translate(200,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dffn-bus\"/>\n    <s:alias val=\"$_DFF_N_-bus\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n    <path d=\"M0,35 L5,30 L0,25\" class=\"$cell_id\"/>\n    <circle cx=\"-3\" cy=\"30\" r=\"3\" class=\"$cell_id\"/>\n    <path d=\"M30,2 L32,2 L32,42 L2,42 L2,40\" class=\"$cell_id\"/>\n    <path d=\"M32,4 L34,4 L34,44 L4,44 L4,42\" class=\"$cell_id\"/>\n\n    <g s:x=\"35\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"-6\" s:y=\"30\" s:pid=\"CLK\"/>\n    <g s:x=\"-6\" s:y=\"30\" s:pid=\"C\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n  </g>\n\n  <g s:type=\"dlatch\" transform=\"translate(250,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dlatch\"/>\n    <s:alias val=\"$_DLATCH_\"/>\n    <s:alias val=\"adlatch\"/>\n    <s:alias val=\"$adlatch\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n\n    <path d=\"M 1,35 H 4 V 25 h 5 v 10 h 3\" class=\"$cell_id\"/>\n\n    <g s:x=\"30\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"EN\"/>\n    <g s:x=\"15\" s:y=\"40\" s:pid=\"ARST\"/>\n  </g>\n\n  <g s:type=\"dlatch-bus\" transform=\"translate(300,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dlatch-bus\"/>\n    <s:alias val=\"$_DLATCH_-bus\"/>\n    <s:alias val=\"adlatch-bus\"/>\n    <s:alias val=\"$adlatch-bus\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n\n    <path d=\"M 1,35 H 4 V 25 h 5 v 10 h 3\" class=\"$cell_id\"/>\n    <path d=\"M30,2 L32,2 L32,42 L2,42 L2,40\" class=\"$cell_id\"/>\n    <path d=\"M32,4 L34,4 L34,44 L4,44 L4,42\" class=\"$cell_id\"/>\n\n    <g s:x=\"35\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"EN\"/>\n    <g s:x=\"17\" s:y=\"44\" s:pid=\"ARST\"/>\n  </g>\n\n  <g s:type=\"dlatchn\" transform=\"translate(350,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dlatchn\"/>\n    <s:alias val=\"$_DLATCH_N_\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n\n    <path d=\"M 1,25 H 4 V 35 H 9 V 25 h 3\" class=\"$cell_id\"/>\n\n    <g s:x=\"30\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"EN\"/>\n  </g>\n\n  <g s:type=\"dlatchn-bus\" transform=\"translate(400,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dlatchn-bus\"/>\n    <s:alias val=\"$_DLATCH_N_-bus\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n\n    <path d=\"M 1,25 H 4 V 35 H 9 V 25 h 3\" class=\"$cell_id\"/>\n    <path d=\"M30,2 L32,2 L32,42 L2,42 L2,40\" class=\"$cell_id\"/>\n    <path d=\"M32,4 L34,4 L34,44 L4,44 L4,42\" class=\"$cell_id\"/>\n\n    <g s:x=\"35\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"EN\"/>\n  </g>\n\n  <g s:type=\"_AOI3_\" transform=\"translate(50, 400)\" s:width=\"66\" s:height=\"40\">\n    <s:alias val=\"$_AOI3_\"/>\n\n    <path d=\"M0,0 L0,25 L15,25 A15 12.5 0 0 0 15,0 Z\" class=\"$cell_id\"/>\n    <path d=\"M30,13 A30 25 0 0 1 30,38 A30 25 0 0 0 60,25.5 A30 25 0 0 0 30,13\" class=\"$cell_id\"/>\n    <circle cx=\"63\" cy=\"25.5\" r=\"3\" class=\"$cell_id\"/>\n    <path d=\"M0,32 L33,32\" />\n    <g s:x=\"0\" s:y=\"5\"  s:pid=\"A\"/>\n    <g s:x=\"0\" s:y=\"20\"  s:pid=\"B\"/>\n    <g s:x=\"0\" s:y=\"32\"  s:pid=\"C\"/>\n    <g s:x=\"66\" s:y=\"25.5\" s:pid=\"Y\"/>\n    <!-- <path d=\"M-5,5 L0,5\"/> -->\n    <!-- <path d=\"M-5,20 L0,20\"/> -->\n    <!-- <path d=\"M-5,32 L0,32\"/> -->\n    <!-- <path d=\"M 70,25.5 L 66,25.5\"/> -->\n  </g>\n\n  <g s:type=\"_OAI3_\" transform=\"translate(150, 400)\" s:width=\"66\" s:height=\"40\">\n    <s:alias val=\"$_OAI3_\"/>\n\n    <path d=\"M30,13 L30,38 L45,38 A15 12.5 0 0 0 45,13 Z\" class=\"$cell_id\"/>\n    <path d=\"M0,0 A30 25 0 0 1 0,25 A30 25 0 0 0 30,12.5 A30 25 0 0 0 0,0\" class=\"$cell_id\"/>\n    <circle cx=\"63\" cy=\"25.5\" r=\"3\" class=\"$cell_id\"/>\n    <path d=\"M0,32 L30,32\" />\n\n    <g s:x=\"2\" s:y=\"5\"  s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\"  s:pid=\"B\"/>\n    <g s:x=\"0\" s:y=\"32\"  s:pid=\"C\"/>\n    <g s:x=\"66\" s:y=\"25.5\" s:pid=\"Y\"/>\n    <!-- <path d=\"M-5,5 L2,5\"/> -->\n    <!-- <path d=\"M-5,20 L2,20\"/> -->\n    <!-- <path d=\"M-5,32 L0,32\"/> -->\n    <!-- <path d=\"M 70,25.5 L 66,25.5\"/> -->\n  </g>\n\n  <!-- AOI4 -->\n\n  <g s:type=\"_AOI4_\" transform=\"translate(250, 400)\" s:width=\"66\" s:height=\"40\">\n    <s:alias val=\"$_AOI4_\"/>\n\n    <path d=\"M0,0 L0,25 L15,25 A15 12.5 0 0 0 15,0 Z\" class=\"$cell_id\"/>\n    <path d=\"M0,25 L0,50 L15,50 A15 12.5 0 0 0 15,25 Z\" class=\"$cell_id\"/>\n    <path d=\"M30,12.5 A30 25 0 0 1 30,37.5 A30 25 0 0 0 60,25.5 A30 25 0 0 0 30,12.5\" class=\"$cell_id\"/>\n    <circle cx=\"63\" cy=\"25.5\" r=\"3\" class=\"$cell_id\"/>\n    <g s:x=\"0\" s:y=\"5\"  s:pid=\"A\"/>\n    <g s:x=\"0\" s:y=\"20\"  s:pid=\"B\"/>\n    <g s:x=\"0\" s:y=\"30\"  s:pid=\"C\"/>\n    <g s:x=\"0\" s:y=\"45\"  s:pid=\"D\"/>\n    <g s:x=\"66\" s:y=\"25.5\" s:pid=\"Y\"/>\n    <!-- <path d=\"M-5,5 L0,5\"/> -->\n    <!-- <path d=\"M-5,20 L0,20\"/> -->\n    <!-- <path d=\"M-5,30 L0,30\"/> -->\n    <!-- <path d=\"M-5,45 L0,45\"/> -->\n    <!-- <path d=\"M 70,25.5 L 66,25.5\"/> -->\n  </g>\n\n  <!-- OAI4 -->\n\n  <g s:type=\"_OAI4_\" transform=\"translate(350, 400)\" s:width=\"66\" s:height=\"40\">\n    <s:alias val=\"$_OAI4_\"/>\n\n    <path d=\"M30,13 L30,38 L45,38 A15 12.5 0 0 0 45,13 Z\" class=\"$cell_id\"/>\n    <path d=\"M0,0 A30 25 0 0 1 0,25 A30 25 0 0 0 30,12.5 A30 25 0 0 0 0,0\" class=\"$cell_id\"/>\n    <path d=\"M0,25 A30 25 0 0 1 0,50 A30 25 0 0 0 30,37.5 A30 25 0 0 0 0,25\" class=\"$cell_id\"/>\n    <circle cx=\"63\" cy=\"25.5\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\"  s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\"  s:pid=\"B\"/>\n    <g s:x=\"2\" s:y=\"30\"  s:pid=\"C\"/>\n    <g s:x=\"2\" s:y=\"45\"  s:pid=\"D\"/>\n    <g s:x=\"66\" s:y=\"25.5\" s:pid=\"Y\"/>\n    <!-- <path d=\"M-5,5 L2,5\"/> -->\n    <!-- <path d=\"M-5,20 L2,20\"/> -->\n    <!-- <path d=\"M-5,30 L2,30\"/> -->\n    <!-- <path d=\"M-5,45 L2,45\"/> -->\n    <!-- <path d=\"M 70,25.5 L 66,25.5\"/> -->\n  </g>\n\n  <g s:type=\"generic\" transform=\"translate(550,250)\" s:width=\"30\" s:height=\"40\">\n\n    <text x=\"15\" y=\"-4\" class=\"nodelabel $cell_id\" s:attribute=\"ref\">generic</text>\n    <rect width=\"30\" height=\"40\" s:generic=\"body\" class=\"$cell_id\"/>\n\n    <g transform=\"translate(30, 10)\" s:x=\"30\" s:y=\"10\" s:pid=\"out0\">\n      <text x=\"5\" y=\"-4\" style=\"fill:#000; stroke:none\" class=\"$cell_id\">out0</text>\n    </g>\n    <g transform=\"translate(30, 30)\" s:x=\"30\" s:y=\"30\" s:pid=\"out1\">\n      <text x=\"5\" y=\"-4\" style=\"fill:#000;stroke:none\" class=\"$cell_id\">out1</text>\n    </g>\n    <g transform=\"translate(0, 10)\" s:x=\"0\" s:y=\"10\" s:pid=\"in0\">\n      <text x=\"-3\" y=\"-4\" class=\"inputPortLabel $cell_id\">in0</text>\n    </g>\n    <g transform=\"translate(0, 30)\" s:x=\"0\" s:y=\"30\" s:pid=\"in1\">\n      <text x=\"-3\" y=\"-4\" class=\"inputPortLabel $cell_id\">in1</text>\n    </g>\n  </g>\n\n</svg>\n";
const analog = "<svg  xmlns=\"http://www.w3.org/2000/svg\"\n  xmlns:xlink=\"http://www.w3.org/1999/xlink\"\n  xmlns:s=\"https://github.com/nturley/netlistsvg\"\n  width=\"800\" height=\"500\">\n  <s:properties>\n    <s:layoutEngine\n      org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers=\"35\"\n      org.eclipse.elk.spacing.nodeNode= \"35\"\n      org.eclipse.elk.layered.layering.strategy= \"LONGEST_PATH\"\n    />\n    <s:low_priority_alias val=\"$dff\" />\n  </s:properties>\n<style>\nsvg {\n  stroke:#000;\n  fill:none;\n}\ntext {\n  fill:#000;\n  stroke:none;\n  font-size:10px;\n  font-weight: bold;\n  font-family: \"Courier New\", monospace;\n}\nline {\n    stroke-linecap: round;\n}\n.nodelabel {\n  text-anchor: middle;\n}\n.inputPortLabel {\n  text-anchor: end;\n}\n.splitjoinBody {\n  fill:#000;\n}\n</style>\n\n  <g s:type=\"mux\" transform=\"translate(50, 50)\" s:width=\"20\" s:height=\"40\">\n    <s:alias val=\"$pmux\"/>\n    <s:alias val=\"$mux\"/>\n    <s:alias val=\"$_MUX_\"/>\n\n    <path d=\"M0,0 L20,10 L20,30 L0,40 Z\" class=\"$cell_id\"/>\n\n    <text x=\"5\" y=\"32\" class=\"nodelabel $cell_id\" s:attribute=\"\">1</text>\n    <text x=\"5\" y=\"13\" class=\"nodelabel $cell_id\" s:attribute=\"\">0</text>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"A\"/>\n    <g s:x=\"0\" s:y=\"30\" s:pid=\"B\"/>\n    <g s:x=\"10\" s:y=\"35\" s:pid=\"S\"/>\n    <g s:x=\"20\" s:y=\"20\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"mux-bus\" transform=\"translate(100, 50)\" s:width=\"24\" s:height=\"40\">\n    <s:alias val=\"$pmux-bus\"/>\n    <s:alias val=\"$mux-bus\"/>\n    <s:alias val=\"$_MUX_-bus\"/>\n\n    <path d=\"M0,0 L20,10 L20,30 L0,40 Z\" class=\"$cell_id\"/>\n    <path d=\"M4,2 L4,0 L22,9 L22,31 L4,40 L4,38\" class=\"$cell_id\"/>\n    <path d=\"M8,2 L8,0 L24,8 L24,32 L8,40 L8,38\" class=\"$cell_id\"/>\n\n    <text x=\"5\" y=\"32\" class=\"nodelabel $cell_id\" s:attribute=\"\">1</text>\n    <text x=\"5\" y=\"13\" class=\"nodelabel $cell_id\" s:attribute=\"\">0</text>\n    <g s:x=\"-1\" s:y=\"10\" s:pid=\"A\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"B\"/>\n    <g s:x=\"12\" s:y=\"38\" s:pid=\"S\"/>\n    <g s:x=\"24.5\" s:y=\"20\" s:pid=\"Y\"/>\n  </g>\n\n  <!-- and -->\n  <g s:type=\"and\" transform=\"translate(150,50)\" s:width=\"30\" s:height=\"25\">\n    <s:alias val=\"$and\"/>\n    <s:alias val=\"$logic_and\"/>\n    <s:alias val=\"$_AND_\"/>\n    <s:alias val=\"$reduce_and\"/>\n\n    <path d=\"M0,0 L0,25 L15,25 A15 12.5 0 0 0 15,0 Z\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"0\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"30\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n  <g s:type=\"nand\" transform=\"translate(150,100)\" s:width=\"30\" s:height=\"25\">\n    <s:alias val=\"$nand\"/>\n    <s:alias val=\"$logic_nand\"/>\n    <s:alias val=\"$_NAND_\"/>\n\n    <path d=\"M0,0 L0,25 L15,25 A15 12.5 0 0 0 15,0 Z\" class=\"$cell_id\"/>\n    <circle cx=\"34\" cy=\"12.5\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"0\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"36\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n  <g s:type=\"andnot\" transform=\"translate(200,50)\" s:width=\"30\" s:height=\"25\">\n    <s:alias val=\"$_ANDNOT_\"/>\n\n    <path d=\"M0,0 L0,25 L15,25 A15 12.5 0 0 0 15,0 Z\" class=\"$cell_id\"/>\n    <circle cx=\"-3\" cy=\"20\" r=\"3\"/>\n\n    <g s:x=\"0\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"-6\" s:y=\"20\" s:pid=\"B\"/>\n    <!-- <path d=\"M -10,20 L -6,20\"/> -->\n    <g s:x=\"30\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <!-- or -->\n  <g s:type=\"or\" transform=\"translate(250,50)\" s:width=\"30\" s:height=\"25\">\n    <s:alias val=\"$or\"/>\n    <s:alias val=\"$logic_or\"/>\n    <s:alias val=\"$_OR_\"/>\n    <s:alias val=\"$reduce_or\"/>\n    <s:alias val=\"$reduce_bool\"/>\n\n    <path d=\"M0,0 A30 25 0 0 1 0,25 A30 25 0 0 0 30,12.5 A30 25 0 0 0 0,0\" class=\"$cell_id\"/>\n \n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"30\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n  <g s:type=\"reduce_nor\" transform=\"translate(250, 100)\" s:width=\"33\" s:height=\"25\">\n    <s:alias val=\"$nor\"/>\n    <s:alias val=\"$reduce_nor\"/>\n    <s:alias val=\"$_NOR_\"/>\n    <s:alias val=\"$_ORNOT_\"/>\n\n    <path d=\"M0,0 A30 25 0 0 1 0,25 A30 25 0 0 0 30,12.5 A30 25 0 0 0 0,0\" class=\"$cell_id\"/>\n    <circle cx=\"33\" cy=\"12.5\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"36\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n  <g s:type=\"ornot\" transform=\"translate(300,50)\" s:width=\"30\" s:height=\"25\">\n    <s:alias val=\"$_ORNOT_\"/>\n\n    <path d=\"M0,0 A30 25 0 0 1 0,25 A30 25 0 0 0 30,12.5 A30 25 0 0 0 0,0\" class=\"$cell_id\"/>\n    <circle cx=\"-1\" cy=\"20\" r=\"3\"/>\n \n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"-4\" s:y=\"20\" s:pid=\"B\"/>\n    <!-- <path d=\"M -8,20 L -4,20\"/> -->\n    <g s:x=\"30\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <!--xor -->\n  <g s:type=\"reduce_xor\" transform=\"translate(350, 50)\" s:width=\"33\" s:height=\"25\">\n    <s:alias val=\"$xor\"/>\n    <s:alias val=\"$reduce_xor\"/>\n    <s:alias val=\"$_XOR_\"/>\n\n    <path d=\"M3,0 A30 25 0 0 1 3,25 A30 25 0 0 0 33,12.5 A30 25 0 0 0 3,0\" class=\"$cell_id\"/>\n    <path d=\"M0,0 A30 25 0 0 1 0,25\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"33\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"reduce_nxor\" transform=\"translate(350, 100)\" s:width=\"33\" s:height=\"25\">\n    <s:alias val=\"$xnor\"/>\n    <s:alias val=\"$reduce_xnor\"/>\n    <s:alias val=\"$_XNOR_\"/>\n\n    <path d=\"M3,0 A30 25 0 0 1 3,25 A30 25 0 0 0 33,12.5 A30 25 0 0 0 3,0\" class=\"$cell_id\"/>\n    <path d=\"M0,0 A30 25 0 0 1 0,25\" class=\"$cell_id\"/>\n    <circle cx=\"36\" cy=\"12.5\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"38\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"tribuf\" transform=\"translate(550, 50)\" s:width=\"15\" s:height=\"30\">\n    <s:alias val=\"$tribuf\"/>\n    <s:alias val=\"$_TRIBUF_\"/>\n\n    <s:alias val=\"tribuf-bus\"/>\n    <s:alias val=\"$tribuf-bus\"/>\n    <s:alias val=\"$_TRIBUF_-bus\"/>\n\n    <path d=\"M0,0 L25,15 L0,30 Z\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"15\" s:pid=\"A\"/>\n    <g s:x=\"11\" s:y=\"6\" s:pid=\"EN\"/>\n    <g s:x=\"25\" s:y=\"15\" s:pid=\"Y\"/>\n    <!-- <path d=\"M -5,15 L 0,15\" /> -->\n    <!-- <path d=\"M 11,0 L 11,6\" /> -->\n    <!-- <path d=\"M 30,15 L 25,15\" /> -->\n  </g>\n\n  <!--buffer -->\n  <g s:type=\"not\" transform=\"translate(450,100)\" s:width=\"30\" s:height=\"20\">\n    <s:alias val=\"$_NOT_\"/>\n    <s:alias val=\"$not\"/>\n    <s:alias val=\"$logic_not\"/>\n\n    <path d=\"M0,0 L0,20 L20,10 Z\" class=\"$cell_id\"/>\n    <circle cx=\"24\" cy=\"10\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"-1\" s:y=\"10\" s:pid=\"A\"/>\n    <g s:x=\"27\" s:y=\"10\" s:pid=\"Y\"/>\n  </g>\n  <g s:type=\"buf\" transform=\"translate(450,50)\" s:width=\"30\" s:height=\"20\">\n    <s:alias val=\"$_BUF_\"/>\n\n    <path d=\"M0,0 L0,20 L20,10 Z\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"A\"/>\n    <g s:x=\"20\" s:y=\"10\" s:pid=\"Y\"/>\n    <!-- <path d=\"M -5,10 L 0,10\"/> -->\n    <!-- <path d=\"M 25,10 L 20,10\"/> -->\n  </g>\n\n  <g s:type=\"add\" transform=\"translate(50, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$add\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"12.5\" y2=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"12.5\" x2=\"12.5\" y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"pos\" transform=\"translate(100, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$pos\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"12.5\" y2=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"12.5\" x2=\"12.5\" y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"-1\" s:y=\"12.5\" s:pid=\"A\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"sub\" transform=\"translate(150,150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$sub\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"12.5\" y2=\"12.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"neg\" transform=\"translate(200,150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$neg\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"12.5\" y2=\"12.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"12.5\" s:pid=\"A\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"eq\" transform=\"translate(250,150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$eq\"/>\n    <s:alias val=\"$eqx\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"10\" y2=\"10\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"15\" y2=\"15\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"mul\" transform=\"translate(300, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$mul\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\"  x2=\"17.5\" y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n    <line x1=\"17.5\" x2=\"7.5\"  y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"div\" transform=\"translate(350, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$div\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"15\" x2=\"10\"  y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"mod\" transform=\"translate(400, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$mod\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"15\" x2=\"10\"  y1=\"7.5\" y2=\"17.5\" class=\"$cell_id\"/>\n    <circle r=\"2\" cx=\"8\" cy=\"9\" class=\"$cell_id\"/>\n    <circle r=\"2\" cx=\"17\" cy=\"16\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"pow\" transform=\"translate(450, 150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$pow\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"10\" x2=\"12.5\"  y1=\"12\" y2=\"6\" class=\"$cell_id\"/>\n    <line x1=\"15\" x2=\"12.5\"  y1=\"12\" y2=\"6\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"26\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"ne\" transform=\"translate(500,150)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$ne\"/>\n    <s:alias val=\"$nex\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"10\" y2=\"10\" class=\"$cell_id\"/>\n    <line x1=\"7.5\" x2=\"17.5\" y1=\"15\" y2=\"15\" class=\"$cell_id\"/>\n    <line x1=\"9\" x2=\"16\" y1=\"18\" y2=\"7\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"lt\" transform=\"translate(50,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$lt\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"17\" y1=\"12\"  y2=\"7\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"17\" y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"le\" transform=\"translate(100,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$le\"/>\n\n    <circle r=\"12.5\" cx=\"12.5\" cy=\"12.5\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"17\" y1=\"11\"  y2=\"6\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"17\" y1=\"11\" y2=\"16\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"17\" y1=\"14\" y2=\"19\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"ge\" transform=\"translate(150,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$ge\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"19\"  y1=\"6\" y2=\"11\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"19\" y1=\"16\" y2=\"11\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"19\" y1=\"19\" y2=\"14\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"gt\" transform=\"translate(200,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$gt\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"19\"  y1=\"7\" y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"19\" y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"shr\" transform=\"translate(250,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$shr\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"13\"  y1=\"7\"  y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"8\" x2=\"13\"  y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"14\" x2=\"19\" y1=\"7\"  y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"14\" x2=\"19\" y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"shl\" transform=\"translate(300,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$shl\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"11\"  y1=\"12\" y2=\"7\"  class=\"$cell_id\"/>\n    <line x1=\"6\" x2=\"11\"  y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n    <line x1=\"12\" x2=\"17\" y1=\"12\" y2=\"7\"  class=\"$cell_id\"/>\n    <line x1=\"12\" x2=\"17\" y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"sshr\" transform=\"translate(350,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$sshr\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"5\"  x2=\"10\" y1=\"7\"  y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"5\"  x2=\"10\" y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"11\" x2=\"16\" y1=\"7\"  y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"11\" x2=\"16\" y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"17\" x2=\"22\" y1=\"7\"  y2=\"12\" class=\"$cell_id\"/>\n    <line x1=\"17\" x2=\"22\" y1=\"17\" y2=\"12\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"sshl\" transform=\"translate(400,200)\" s:width=\"25\" s:height=\"25\">\n    <s:alias val=\"$sshl\"/>\n\n    <circle r=\"12\" cx=\"12\" cy=\"12\" class=\"$cell_id\"/>\n    <line x1=\"3\"  x2=\"8\"   y1=\"12\" y2=\"7\"  class=\"$cell_id\"/>\n    <line x1=\"3\"  x2=\"8\"   y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n    <line x1=\"9\"  x2=\"14\" y1=\"12\" y2=\"7\"  class=\"$cell_id\"/>\n    <line x1=\"9\"  x2=\"14\" y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n    <line x1=\"15\" x2=\"20\" y1=\"12\" y2=\"7\"  class=\"$cell_id\"/>\n    <line x1=\"15\" x2=\"20\" y1=\"12\" y2=\"17\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\" s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\" s:pid=\"B\"/>\n    <g s:x=\"25\" s:y=\"12.5\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"inputExt\" transform=\"translate(50,250)\" s:width=\"30\" s:height=\"20\">\n    <text x=\"15\" y=\"-4\" class=\"nodelabel $cell_id\" s:attribute=\"ref\">input</text>\n    <s:alias val=\"$_inputExt_\"/>\n    <path d=\"M0,0 L0,20 L15,20 L30,10 L15,0 Z\" class=\"$cell_id\"/>\n    <g s:x=\"30\" s:y=\"10\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"constant\" transform=\"translate(150,250)\" s:width=\"30\" s:height=\"20\">\n    <text x=\"15\" y=\"-4\" class=\"nodelabel $cell_id\" s:attribute=\"ref\">constant</text>\n\n    <s:alias val=\"$_constant_\"/>\n    <rect width=\"30\" height=\"20\" class=\"$cell_id\"/>\n\n    <g s:x=\"31\" s:y=\"10\" s:pid=\"Y\"/>\n  </g>\n\n  <g s:type=\"outputExt\" transform=\"translate(250,250)\" s:width=\"30\" s:height=\"20\">\n    <text x=\"15\" y=\"-4\" class=\"nodelabel $cell_id\" s:attribute=\"ref\">output</text>\n    <s:alias val=\"$_outputExt_\"/>\n    <path d=\"M30,0 L30,20 L15,20 L0,10 L15,0 Z\" class=\"$cell_id\"/>\n\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"A\"/>\n  </g>\n\n  <g s:type=\"split\" transform=\"translate(350,250)\" s:width=\"5\" s:height=\"40\">\n    <rect width=\"5\" height=\"40\" class=\"splitjoinBody\" s:generic=\"body\"/>\n    <s:alias val=\"$_split_\"/>\n\n    <g s:x=\"0\" s:y=\"20\" s:pid=\"in\"/>\n    <g transform=\"translate(5, 10)\" s:x=\"4\" s:y=\"10\" s:pid=\"out0\">\n      <text x=\"5\" y=\"-4\">hi:lo</text>\n    </g>\n    <g transform=\"translate(5, 30)\" s:x=\"4\" s:y=\"30\" s:pid=\"out1\">\n      <text x=\"5\" y=\"-4\">hi:lo</text>\n    </g>\n  </g>\n\n  <g s:type=\"join\" transform=\"translate(450,250)\" s:width=\"4\" s:height=\"40\">\n    <rect width=\"5\" height=\"40\" class=\"splitjoinBody\" s:generic=\"body\"/>\n    <s:alias val=\"$_join_\"/>\n    <g s:x=\"5\" s:y=\"20\"  s:pid=\"out\"/>\n    <g transform=\"translate(0, 10)\" s:x=\"0\" s:y=\"10\" s:pid=\"in0\">\n      <text x=\"-3\" y=\"-4\" class=\"inputPortLabel\">hi:lo</text>\n    </g>\n    <g transform=\"translate(0, 30)\" s:x=\"0\" s:y=\"30\" s:pid=\"in1\">\n      <text x=\"-3\" y=\"-4\" class=\"inputPortLabel\">hi:lo</text>\n    </g>\n  </g>\n\n  <g s:type=\"dff\" transform=\"translate(50,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dff\"/>\n    <s:alias val=\"$_DFF_\"/>\n    <s:alias val=\"$_DFF_P_\"/>\n\n    <s:alias val=\"$adff\"/>\n    <s:alias val=\"$_DFF_\"/>\n    <s:alias val=\"$_DFF_P_\"/>\n\n    <s:alias val=\"$sdff\"/>\n    <s:alias val=\"$_DFF_\"/>\n    <s:alias val=\"$_DFF_P_\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n    <path d=\"M0,35 L5,30 L0,25\" class=\"$cell_id\"/>\n\n    <g s:x=\"31\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"CLK\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"C\"/>\n    <g s:x=\"-1\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"15\" s:y=\"40\" s:pid=\"ARST\"/>\n    <g s:x=\"15\" s:y=\"40\" s:pid=\"SRST\"/>\n  </g>\n\n  <g s:type=\"dff-bus\" transform=\"translate(100,300)\" s:width=\"34\" s:height=\"44\">\n    <s:alias val=\"$dff-bus\"/>\n    <s:alias val=\"$_DFF_-bus\"/>\n    <s:alias val=\"$_DFF_P_-bus\"/>\n\n    <s:alias val=\"adff-bus\"/>\n    <s:alias val=\"$adff-bus\"/>\n    <s:alias val=\"$_DFF_-bus\"/>\n    <s:alias val=\"$_DFF_P_-bus\"/>\n\n    <s:alias val=\"sdff-bus\"/>\n    <s:alias val=\"$sdff-bus\"/>\n    <s:alias val=\"$_DFF_-bus\"/>\n    <s:alias val=\"$_DFF_P_-bus\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n    <path d=\"M0,35 L5,30 L0,25\" class=\"$cell_id\"/>\n    <path d=\"M30,2 L32,2 L32,42 L2,42 L2,40\" class=\"$cell_id\"/>\n    <path d=\"M32,4 L34,4 L34,44 L4,44 L4,42\" class=\"$cell_id\"/>\n\n    <g s:x=\"35\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"CLK\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"C\"/>\n    <g s:x=\"-1\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"17\" s:y=\"44\" s:pid=\"ARST\"/>\n    <g s:x=\"17\" s:y=\"44\" s:pid=\"SRST\"/>\n  </g>\n\n  <g s:type=\"dffn\" transform=\"translate(150,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dffn\"/>\n    <s:alias val=\"$_DFF_N_\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n    <path d=\"M0,35 L5,30 L0,25\" class=\"$cell_id\"/>\n    <circle cx=\"-3\" cy=\"30\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"30\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"-6\" s:y=\"30\" s:pid=\"CLK\"/>\n    <g s:x=\"-6\" s:y=\"30\" s:pid=\"C\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n  </g>\n\n  <g s:type=\"dffn-bus\" transform=\"translate(200,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dffn-bus\"/>\n    <s:alias val=\"$_DFF_N_-bus\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n    <path d=\"M0,35 L5,30 L0,25\" class=\"$cell_id\"/>\n    <circle cx=\"-3\" cy=\"30\" r=\"3\" class=\"$cell_id\"/>\n    <path d=\"M30,2 L32,2 L32,42 L2,42 L2,40\" class=\"$cell_id\"/>\n    <path d=\"M32,4 L34,4 L34,44 L4,44 L4,42\" class=\"$cell_id\"/>\n\n    <g s:x=\"35\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"-6\" s:y=\"30\" s:pid=\"CLK\"/>\n    <g s:x=\"-6\" s:y=\"30\" s:pid=\"C\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n  </g>\n\n  <g s:type=\"dlatch\" transform=\"translate(250,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dlatch\"/>\n    <s:alias val=\"$_DLATCH_\"/>\n    <s:alias val=\"adlatch\"/>\n    <s:alias val=\"$adlatch\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n\n    <path d=\"M 1,35 H 4 V 25 h 5 v 10 h 3\" class=\"$cell_id\"/>\n\n    <g s:x=\"30\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"EN\"/>\n    <g s:x=\"15\" s:y=\"40\" s:pid=\"ARST\"/>\n  </g>\n\n  <g s:type=\"dlatch-bus\" transform=\"translate(300,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dlatch-bus\"/>\n    <s:alias val=\"$_DLATCH_-bus\"/>\n    <s:alias val=\"adlatch-bus\"/>\n    <s:alias val=\"$adlatch-bus\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n\n    <path d=\"M 1,35 H 4 V 25 h 5 v 10 h 3\" class=\"$cell_id\"/>\n    <path d=\"M30,2 L32,2 L32,42 L2,42 L2,40\" class=\"$cell_id\"/>\n    <path d=\"M32,4 L34,4 L34,44 L4,44 L4,42\" class=\"$cell_id\"/>\n\n    <g s:x=\"35\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"EN\"/>\n    <g s:x=\"17\" s:y=\"44\" s:pid=\"ARST\"/>\n  </g>\n\n  <g s:type=\"dlatchn\" transform=\"translate(350,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dlatchn\"/>\n    <s:alias val=\"$_DLATCH_N_\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n\n    <path d=\"M 1,25 H 4 V 35 H 9 V 25 h 3\" class=\"$cell_id\"/>\n\n    <g s:x=\"30\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"EN\"/>\n  </g>\n\n  <g s:type=\"dlatchn-bus\" transform=\"translate(400,300)\" s:width=\"30\" s:height=\"40\">\n    <s:alias val=\"$dlatchn-bus\"/>\n    <s:alias val=\"$_DLATCH_N_-bus\"/>\n\n    <rect width=\"30\" height=\"40\" x=\"0\" y=\"0\" class=\"$cell_id\"/>\n\n    <path d=\"M 1,25 H 4 V 35 H 9 V 25 h 3\" class=\"$cell_id\"/>\n    <path d=\"M30,2 L32,2 L32,42 L2,42 L2,40\" class=\"$cell_id\"/>\n    <path d=\"M32,4 L34,4 L34,44 L4,44 L4,42\" class=\"$cell_id\"/>\n\n    <g s:x=\"35\" s:y=\"10\" s:pid=\"Q\"/>\n    <g s:x=\"0\" s:y=\"10\" s:pid=\"D\"/>\n    <g s:x=\"-1\" s:y=\"30\" s:pid=\"EN\"/>\n  </g>\n\n  <g s:type=\"_AOI3_\" transform=\"translate(50, 400)\" s:width=\"66\" s:height=\"40\">\n    <s:alias val=\"$_AOI3_\"/>\n\n    <path d=\"M0,0 L0,25 L15,25 A15 12.5 0 0 0 15,0 Z\" class=\"$cell_id\"/>\n    <path d=\"M30,13 A30 25 0 0 1 30,38 A30 25 0 0 0 60,25.5 A30 25 0 0 0 30,13\" class=\"$cell_id\"/>\n    <circle cx=\"63\" cy=\"25.5\" r=\"3\" class=\"$cell_id\"/>\n    <path d=\"M0,32 L33,32\" />\n    <g s:x=\"0\" s:y=\"5\"  s:pid=\"A\"/>\n    <g s:x=\"0\" s:y=\"20\"  s:pid=\"B\"/>\n    <g s:x=\"0\" s:y=\"32\"  s:pid=\"C\"/>\n    <g s:x=\"66\" s:y=\"25.5\" s:pid=\"Y\"/>\n    <!-- <path d=\"M-5,5 L0,5\"/> -->\n    <!-- <path d=\"M-5,20 L0,20\"/> -->\n    <!-- <path d=\"M-5,32 L0,32\"/> -->\n    <!-- <path d=\"M 70,25.5 L 66,25.5\"/> -->\n  </g>\n\n  <g s:type=\"_OAI3_\" transform=\"translate(150, 400)\" s:width=\"66\" s:height=\"40\">\n    <s:alias val=\"$_OAI3_\"/>\n\n    <path d=\"M30,13 L30,38 L45,38 A15 12.5 0 0 0 45,13 Z\" class=\"$cell_id\"/>\n    <path d=\"M0,0 A30 25 0 0 1 0,25 A30 25 0 0 0 30,12.5 A30 25 0 0 0 0,0\" class=\"$cell_id\"/>\n    <circle cx=\"63\" cy=\"25.5\" r=\"3\" class=\"$cell_id\"/>\n    <path d=\"M0,32 L30,32\" />\n\n    <g s:x=\"2\" s:y=\"5\"  s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\"  s:pid=\"B\"/>\n    <g s:x=\"0\" s:y=\"32\"  s:pid=\"C\"/>\n    <g s:x=\"66\" s:y=\"25.5\" s:pid=\"Y\"/>\n    <!-- <path d=\"M-5,5 L2,5\"/> -->\n    <!-- <path d=\"M-5,20 L2,20\"/> -->\n    <!-- <path d=\"M-5,32 L0,32\"/> -->\n    <!-- <path d=\"M 70,25.5 L 66,25.5\"/> -->\n  </g>\n\n  <!-- AOI4 -->\n\n  <g s:type=\"_AOI4_\" transform=\"translate(250, 400)\" s:width=\"66\" s:height=\"40\">\n    <s:alias val=\"$_AOI4_\"/>\n\n    <path d=\"M0,0 L0,25 L15,25 A15 12.5 0 0 0 15,0 Z\" class=\"$cell_id\"/>\n    <path d=\"M0,25 L0,50 L15,50 A15 12.5 0 0 0 15,25 Z\" class=\"$cell_id\"/>\n    <path d=\"M30,12.5 A30 25 0 0 1 30,37.5 A30 25 0 0 0 60,25.5 A30 25 0 0 0 30,12.5\" class=\"$cell_id\"/>\n    <circle cx=\"63\" cy=\"25.5\" r=\"3\" class=\"$cell_id\"/>\n    <g s:x=\"0\" s:y=\"5\"  s:pid=\"A\"/>\n    <g s:x=\"0\" s:y=\"20\"  s:pid=\"B\"/>\n    <g s:x=\"0\" s:y=\"30\"  s:pid=\"C\"/>\n    <g s:x=\"0\" s:y=\"45\"  s:pid=\"D\"/>\n    <g s:x=\"66\" s:y=\"25.5\" s:pid=\"Y\"/>\n    <!-- <path d=\"M-5,5 L0,5\"/> -->\n    <!-- <path d=\"M-5,20 L0,20\"/> -->\n    <!-- <path d=\"M-5,30 L0,30\"/> -->\n    <!-- <path d=\"M-5,45 L0,45\"/> -->\n    <!-- <path d=\"M 70,25.5 L 66,25.5\"/> -->\n  </g>\n\n  <!-- OAI4 -->\n\n  <g s:type=\"_OAI4_\" transform=\"translate(350, 400)\" s:width=\"66\" s:height=\"40\">\n    <s:alias val=\"$_OAI4_\"/>\n\n    <path d=\"M30,13 L30,38 L45,38 A15 12.5 0 0 0 45,13 Z\" class=\"$cell_id\"/>\n    <path d=\"M0,0 A30 25 0 0 1 0,25 A30 25 0 0 0 30,12.5 A30 25 0 0 0 0,0\" class=\"$cell_id\"/>\n    <path d=\"M0,25 A30 25 0 0 1 0,50 A30 25 0 0 0 30,37.5 A30 25 0 0 0 0,25\" class=\"$cell_id\"/>\n    <circle cx=\"63\" cy=\"25.5\" r=\"3\" class=\"$cell_id\"/>\n\n    <g s:x=\"2\" s:y=\"5\"  s:pid=\"A\"/>\n    <g s:x=\"2\" s:y=\"20\"  s:pid=\"B\"/>\n    <g s:x=\"2\" s:y=\"30\"  s:pid=\"C\"/>\n    <g s:x=\"2\" s:y=\"45\"  s:pid=\"D\"/>\n    <g s:x=\"66\" s:y=\"25.5\" s:pid=\"Y\"/>\n    <!-- <path d=\"M-5,5 L2,5\"/> -->\n    <!-- <path d=\"M-5,20 L2,20\"/> -->\n    <!-- <path d=\"M-5,30 L2,30\"/> -->\n    <!-- <path d=\"M-5,45 L2,45\"/> -->\n    <!-- <path d=\"M 70,25.5 L 66,25.5\"/> -->\n  </g>\n\n  <g s:type=\"generic\" transform=\"translate(550,250)\" s:width=\"30\" s:height=\"40\">\n\n    <text x=\"15\" y=\"-4\" class=\"nodelabel $cell_id\" s:attribute=\"ref\">generic</text>\n    <rect width=\"30\" height=\"40\" s:generic=\"body\" class=\"$cell_id\"/>\n\n    <g transform=\"translate(30, 10)\" s:x=\"30\" s:y=\"10\" s:pid=\"out0\">\n      <text x=\"5\" y=\"-4\" style=\"fill:#000; stroke:none\" class=\"$cell_id\">out0</text>\n    </g>\n    <g transform=\"translate(30, 30)\" s:x=\"30\" s:y=\"30\" s:pid=\"out1\">\n      <text x=\"5\" y=\"-4\" style=\"fill:#000;stroke:none\" class=\"$cell_id\">out1</text>\n    </g>\n    <g transform=\"translate(0, 10)\" s:x=\"0\" s:y=\"10\" s:pid=\"in0\">\n      <text x=\"-3\" y=\"-4\" class=\"inputPortLabel $cell_id\">in0</text>\n    </g>\n    <g transform=\"translate(0, 30)\" s:x=\"0\" s:y=\"30\" s:pid=\"in1\">\n      <text x=\"-3\" y=\"-4\" class=\"inputPortLabel $cell_id\">in1</text>\n    </g>\n  </g>\n\n</svg>\n";
const exampleDigital = Buffer("ewogICJjcmVhdG9yIjogIllvc3lzIDAuNSsyMjAgKGdpdCBzaGExIDk0ZmJhZmYsIGVtY2MgIC1PcykiLAogICJtb2R1bGVzIjogewogICAgInVwM2Rvd241IjogewogICAgICAicG9ydHMiOiB7CiAgICAgICAgImNsb2NrIjogewogICAgICAgICAgImRpcmVjdGlvbiI6ICJpbnB1dCIsCiAgICAgICAgICAiYml0cyI6IFsgMiBdCiAgICAgICAgfSwKICAgICAgICAiZGF0YV9pbiI6IHsKICAgICAgICAgICJkaXJlY3Rpb24iOiAiaW5wdXQiLAogICAgICAgICAgImJpdHMiOiBbIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwLCAxMSBdCiAgICAgICAgfSwKICAgICAgICAidXAiOiB7CiAgICAgICAgICAiZGlyZWN0aW9uIjogImlucHV0IiwKICAgICAgICAgICJiaXRzIjogWyAxMiBdCiAgICAgICAgfSwKICAgICAgICAiZG93biI6IHsKICAgICAgICAgICJkaXJlY3Rpb24iOiAiaW5wdXQiLAogICAgICAgICAgImJpdHMiOiBbIDEzIF0KICAgICAgICB9LAogICAgICAgICJjYXJyeV9vdXQiOiB7CiAgICAgICAgICAiZGlyZWN0aW9uIjogIm91dHB1dCIsCiAgICAgICAgICAiYml0cyI6IFsgMTQgXQogICAgICAgIH0sCiAgICAgICAgImJvcnJvd19vdXQiOiB7CiAgICAgICAgICAiZGlyZWN0aW9uIjogIm91dHB1dCIsCiAgICAgICAgICAiYml0cyI6IFsgMTUgXQogICAgICAgIH0sCiAgICAgICAgImNvdW50X291dCI6IHsKICAgICAgICAgICJkaXJlY3Rpb24iOiAib3V0cHV0IiwKICAgICAgICAgICJiaXRzIjogWyAxNiwgMTcsIDE4LCAxOSwgMjAsIDIxLCAyMiwgMjMsIDI0IF0KICAgICAgICB9LAogICAgICAgICJwYXJpdHlfb3V0IjogewogICAgICAgICAgImRpcmVjdGlvbiI6ICJvdXRwdXQiLAogICAgICAgICAgImJpdHMiOiBbIDI1IF0KICAgICAgICB9CiAgICAgIH0sCiAgICAgICJjZWxscyI6IHsKICAgICAgICAiJGFkZCRpbnB1dC52OjE3JDMiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMSwKICAgICAgICAgICJ0eXBlIjogIiRhZGQiLAogICAgICAgICAgInBhcmFtZXRlcnMiOiB7CiAgICAgICAgICAgICJBX1NJR05FRCI6IDAsCiAgICAgICAgICAgICJBX1dJRFRIIjogOSwKICAgICAgICAgICAgIkJfU0lHTkVEIjogMCwKICAgICAgICAgICAgIkJfV0lEVEgiOiAyLAogICAgICAgICAgICAiWV9XSURUSCI6IDEwCiAgICAgICAgICB9LAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJzcmMiOiAiaW5wdXQudjoxNyIKICAgICAgICAgIH0sCiAgICAgICAgICAicG9ydF9kaXJlY3Rpb25zIjogewogICAgICAgICAgICAiQSI6ICJpbnB1dCIsCiAgICAgICAgICAgICJCIjogImlucHV0IiwKICAgICAgICAgICAgIlkiOiAib3V0cHV0IgogICAgICAgICAgfSwKICAgICAgICAgICJjb25uZWN0aW9ucyI6IHsKICAgICAgICAgICAgIkEiOiBbIDE2LCAxNywgMTgsIDE5LCAyMCwgMjEsIDIyLCAyMywgMjQgXSwKICAgICAgICAgICAgIkIiOiBbICIxIiwgIjEiIF0sCiAgICAgICAgICAgICJZIjogWyAyNiwgMjcsIDI4LCAyOSwgMzAsIDMxLCAzMiwgMzMsIDM0LCAzNSBdCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiJGFuZCRpbnB1dC52OjI4JDUiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMSwKICAgICAgICAgICJ0eXBlIjogIiRhbmQiLAogICAgICAgICAgInBhcmFtZXRlcnMiOiB7CiAgICAgICAgICAgICJBX1NJR05FRCI6IDAsCiAgICAgICAgICAgICJBX1dJRFRIIjogMSwKICAgICAgICAgICAgIkJfU0lHTkVEIjogMCwKICAgICAgICAgICAgIkJfV0lEVEgiOiAxLAogICAgICAgICAgICAiWV9XSURUSCI6IDEKICAgICAgICAgIH0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjI4IgogICAgICAgICAgfSwKICAgICAgICAgICJwb3J0X2RpcmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogImlucHV0IiwKICAgICAgICAgICAgIkIiOiAiaW5wdXQiLAogICAgICAgICAgICAiWSI6ICJvdXRwdXQiCiAgICAgICAgICB9LAogICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAiQSI6IFsgMTIgXSwKICAgICAgICAgICAgIkIiOiBbIDM1IF0sCiAgICAgICAgICAgICJZIjogWyAzNiBdCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiJGFuZCRpbnB1dC52OjI5JDYiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMSwKICAgICAgICAgICJ0eXBlIjogIiRhbmQiLAogICAgICAgICAgInBhcmFtZXRlcnMiOiB7CiAgICAgICAgICAgICJBX1NJR05FRCI6IDAsCiAgICAgICAgICAgICJBX1dJRFRIIjogMSwKICAgICAgICAgICAgIkJfU0lHTkVEIjogMCwKICAgICAgICAgICAgIkJfV0lEVEgiOiAxLAogICAgICAgICAgICAiWV9XSURUSCI6IDEKICAgICAgICAgIH0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjI5IgogICAgICAgICAgfSwKICAgICAgICAgICJwb3J0X2RpcmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogImlucHV0IiwKICAgICAgICAgICAgIkIiOiAiaW5wdXQiLAogICAgICAgICAgICAiWSI6ICJvdXRwdXQiCiAgICAgICAgICB9LAogICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAiQSI6IFsgMTMgXSwKICAgICAgICAgICAgIkIiOiBbIDM3IF0sCiAgICAgICAgICAgICJZIjogWyAzOCBdCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiJHByb2NkZmYkNDAiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMSwKICAgICAgICAgICJ0eXBlIjogIiRkZmYiLAogICAgICAgICAgInBhcmFtZXRlcnMiOiB7CiAgICAgICAgICAgICJDTEtfUE9MQVJJVFkiOiAxLAogICAgICAgICAgICAiV0lEVEgiOiA5CiAgICAgICAgICB9LAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJzcmMiOiAiaW5wdXQudjoxNCIKICAgICAgICAgIH0sCiAgICAgICAgICAicG9ydF9kaXJlY3Rpb25zIjogewogICAgICAgICAgICAiQ0xLIjogImlucHV0IiwKICAgICAgICAgICAgIkQiOiAiaW5wdXQiLAogICAgICAgICAgICAiUSI6ICJvdXRwdXQiCiAgICAgICAgICB9LAogICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAiQ0xLIjogWyAyIF0sCiAgICAgICAgICAgICJEIjogWyAzOSwgNDAsIDQxLCA0MiwgNDMsIDQ0LCA0NSwgNDYsIDQ3IF0sCiAgICAgICAgICAgICJRIjogWyAxNiwgMTcsIDE4LCAxOSwgMjAsIDIxLCAyMiwgMjMsIDI0IF0KICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgICIkcHJvY2RmZiQ0MSI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAxLAogICAgICAgICAgInR5cGUiOiAiJGRmZiIsCiAgICAgICAgICAicGFyYW1ldGVycyI6IHsKICAgICAgICAgICAgIkNMS19QT0xBUklUWSI6IDEsCiAgICAgICAgICAgICJXSURUSCI6IDEKICAgICAgICAgIH0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjE0IgogICAgICAgICAgfSwKICAgICAgICAgICJwb3J0X2RpcmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJDTEsiOiAiaW5wdXQiLAogICAgICAgICAgICAiRCI6ICJpbnB1dCIsCiAgICAgICAgICAgICJRIjogIm91dHB1dCIKICAgICAgICAgIH0sCiAgICAgICAgICAiY29ubmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJDTEsiOiBbIDIgXSwKICAgICAgICAgICAgIkQiOiBbIDM2IF0sCiAgICAgICAgICAgICJRIjogWyAxNCBdCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiJHByb2NkZmYkNDIiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMSwKICAgICAgICAgICJ0eXBlIjogIiRkZmYiLAogICAgICAgICAgInBhcmFtZXRlcnMiOiB7CiAgICAgICAgICAgICJDTEtfUE9MQVJJVFkiOiAxLAogICAgICAgICAgICAiV0lEVEgiOiAxCiAgICAgICAgICB9LAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJzcmMiOiAiaW5wdXQudjoxNCIKICAgICAgICAgIH0sCiAgICAgICAgICAicG9ydF9kaXJlY3Rpb25zIjogewogICAgICAgICAgICAiQ0xLIjogImlucHV0IiwKICAgICAgICAgICAgIkQiOiAiaW5wdXQiLAogICAgICAgICAgICAiUSI6ICJvdXRwdXQiCiAgICAgICAgICB9LAogICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAiQ0xLIjogWyAyIF0sCiAgICAgICAgICAgICJEIjogWyAzOCBdLAogICAgICAgICAgICAiUSI6IFsgMTUgXQogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIiRwcm9jZGZmJDQzIjogewogICAgICAgICAgImhpZGVfbmFtZSI6IDEsCiAgICAgICAgICAidHlwZSI6ICIkZGZmIiwKICAgICAgICAgICJwYXJhbWV0ZXJzIjogewogICAgICAgICAgICAiQ0xLX1BPTEFSSVRZIjogMSwKICAgICAgICAgICAgIldJRFRIIjogMQogICAgICAgICAgfSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgICAic3JjIjogImlucHV0LnY6MTQiCiAgICAgICAgICB9LAogICAgICAgICAgInBvcnRfZGlyZWN0aW9ucyI6IHsKICAgICAgICAgICAgIkNMSyI6ICJpbnB1dCIsCiAgICAgICAgICAgICJEIjogImlucHV0IiwKICAgICAgICAgICAgIlEiOiAib3V0cHV0IgogICAgICAgICAgfSwKICAgICAgICAgICJjb25uZWN0aW9ucyI6IHsKICAgICAgICAgICAgIkNMSyI6IFsgMiBdLAogICAgICAgICAgICAiRCI6IFsgNDggXSwKICAgICAgICAgICAgIlEiOiBbIDI1IF0KICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgICIkcHJvY211eCQzNiI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAxLAogICAgICAgICAgInR5cGUiOiAiJHBtdXgiLAogICAgICAgICAgInBhcmFtZXRlcnMiOiB7CiAgICAgICAgICAgICJTX1dJRFRIIjogMywKICAgICAgICAgICAgIldJRFRIIjogOQogICAgICAgICAgfSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgfSwKICAgICAgICAgICJwb3J0X2RpcmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogImlucHV0IiwKICAgICAgICAgICAgIkIiOiAiaW5wdXQiLAogICAgICAgICAgICAiUyI6ICJpbnB1dCIsCiAgICAgICAgICAgICJZIjogIm91dHB1dCIKICAgICAgICAgIH0sCiAgICAgICAgICAiY29ubmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogWyAxNiwgMTcsIDE4LCAxOSwgMjAsIDIxLCAyMiwgMjMsIDI0IF0sCiAgICAgICAgICAgICJCIjogWyAyNiwgMjcsIDI4LCAyOSwgMzAsIDMxLCAzMiwgMzMsIDM0LCA0OSwgNTAsIDUxLCA1MiwgNTMsIDU0LCA1NSwgNTYsIDU3LCAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMCwgMTEgXSwKICAgICAgICAgICAgIlMiOiBbIDU4LCA1OSwgNjAgXSwKICAgICAgICAgICAgIlkiOiBbIDM5LCA0MCwgNDEsIDQyLCA0MywgNDQsIDQ1LCA0NiwgNDcgXQogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIiRwcm9jbXV4JDM3X0NNUDAiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMSwKICAgICAgICAgICJ0eXBlIjogIiRlcSIsCiAgICAgICAgICAicGFyYW1ldGVycyI6IHsKICAgICAgICAgICAgIkFfU0lHTkVEIjogMCwKICAgICAgICAgICAgIkFfV0lEVEgiOiAyLAogICAgICAgICAgICAiQl9TSUdORUQiOiAwLAogICAgICAgICAgICAiQl9XSURUSCI6IDIsCiAgICAgICAgICAgICJZX1dJRFRIIjogMQogICAgICAgICAgfSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgfSwKICAgICAgICAgICJwb3J0X2RpcmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogImlucHV0IiwKICAgICAgICAgICAgIkIiOiAiaW5wdXQiLAogICAgICAgICAgICAiWSI6ICJvdXRwdXQiCiAgICAgICAgICB9LAogICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAiQSI6IFsgMTMsIDEyIF0sCiAgICAgICAgICAgICJCIjogWyAiMCIsICIxIiBdLAogICAgICAgICAgICAiWSI6IFsgNTggXQogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIiRwcm9jbXV4JDM4X0NNUDAiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMSwKICAgICAgICAgICJ0eXBlIjogIiRlcSIsCiAgICAgICAgICAicGFyYW1ldGVycyI6IHsKICAgICAgICAgICAgIkFfU0lHTkVEIjogMCwKICAgICAgICAgICAgIkFfV0lEVEgiOiAyLAogICAgICAgICAgICAiQl9TSUdORUQiOiAwLAogICAgICAgICAgICAiQl9XSURUSCI6IDIsCiAgICAgICAgICAgICJZX1dJRFRIIjogMQogICAgICAgICAgfSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgfSwKICAgICAgICAgICJwb3J0X2RpcmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogImlucHV0IiwKICAgICAgICAgICAgIkIiOiAiaW5wdXQiLAogICAgICAgICAgICAiWSI6ICJvdXRwdXQiCiAgICAgICAgICB9LAogICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAiQSI6IFsgMTMsIDEyIF0sCiAgICAgICAgICAgICJCIjogWyAiMSIsICIwIiBdLAogICAgICAgICAgICAiWSI6IFsgNTkgXQogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIiRwcm9jbXV4JDM5X0NNUDAiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMSwKICAgICAgICAgICJ0eXBlIjogIiRlcSIsCiAgICAgICAgICAicGFyYW1ldGVycyI6IHsKICAgICAgICAgICAgIkFfU0lHTkVEIjogMCwKICAgICAgICAgICAgIkFfV0lEVEgiOiAyLAogICAgICAgICAgICAiQl9TSUdORUQiOiAwLAogICAgICAgICAgICAiQl9XSURUSCI6IDIsCiAgICAgICAgICAgICJZX1dJRFRIIjogMQogICAgICAgICAgfSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgfSwKICAgICAgICAgICJwb3J0X2RpcmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogImlucHV0IiwKICAgICAgICAgICAgIkIiOiAiaW5wdXQiLAogICAgICAgICAgICAiWSI6ICJvdXRwdXQiCiAgICAgICAgICB9LAogICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAiQSI6IFsgMTMsIDEyIF0sCiAgICAgICAgICAgICJCIjogWyAiMCIsICIwIiBdLAogICAgICAgICAgICAiWSI6IFsgNjAgXQogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIiRyZWR1Y2VfeG9yJGlucHV0LnY6MjckNCI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAxLAogICAgICAgICAgInR5cGUiOiAiJHJlZHVjZV94b3IiLAogICAgICAgICAgInBhcmFtZXRlcnMiOiB7CiAgICAgICAgICAgICJBX1NJR05FRCI6IDAsCiAgICAgICAgICAgICJBX1dJRFRIIjogOSwKICAgICAgICAgICAgIllfV0lEVEgiOiAxCiAgICAgICAgICB9LAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJzcmMiOiAiaW5wdXQudjoyNyIKICAgICAgICAgIH0sCiAgICAgICAgICAicG9ydF9kaXJlY3Rpb25zIjogewogICAgICAgICAgICAiQSI6ICJpbnB1dCIsCiAgICAgICAgICAgICJZIjogIm91dHB1dCIKICAgICAgICAgIH0sCiAgICAgICAgICAiY29ubmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogWyAzOSwgNDAsIDQxLCA0MiwgNDMsIDQ0LCA0NSwgNDYsIDQ3IF0sCiAgICAgICAgICAgICJZIjogWyA0OCBdCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiJHN1YiRpbnB1dC52OjE2JDIiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMSwKICAgICAgICAgICJ0eXBlIjogIiRzdWIiLAogICAgICAgICAgInBhcmFtZXRlcnMiOiB7CiAgICAgICAgICAgICJBX1NJR05FRCI6IDAsCiAgICAgICAgICAgICJBX1dJRFRIIjogOSwKICAgICAgICAgICAgIkJfU0lHTkVEIjogMCwKICAgICAgICAgICAgIkJfV0lEVEgiOiAzLAogICAgICAgICAgICAiWV9XSURUSCI6IDEwCiAgICAgICAgICB9LAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJzcmMiOiAiaW5wdXQudjoxNiIKICAgICAgICAgIH0sCiAgICAgICAgICAicG9ydF9kaXJlY3Rpb25zIjogewogICAgICAgICAgICAiQSI6ICJpbnB1dCIsCiAgICAgICAgICAgICJCIjogImlucHV0IiwKICAgICAgICAgICAgIlkiOiAib3V0cHV0IgogICAgICAgICAgfSwKICAgICAgICAgICJjb25uZWN0aW9ucyI6IHsKICAgICAgICAgICAgIkEiOiBbIDE2LCAxNywgMTgsIDE5LCAyMCwgMjEsIDIyLCAyMywgMjQgXSwKICAgICAgICAgICAgIkIiOiBbICIxIiwgIjAiLCAiMSIgXSwKICAgICAgICAgICAgIlkiOiBbIDQ5LCA1MCwgNTEsIDUyLCA1MywgNTQsIDU1LCA1NiwgNTcsIDM3IF0KICAgICAgICAgIH0KICAgICAgICB9CiAgICAgIH0sCiAgICAgICJuZXRuYW1lcyI6IHsKICAgICAgICAiJDBcXGJvcnJvd19vdXRbMDowXSI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAxLAogICAgICAgICAgImJpdHMiOiBbIDM4IF0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjE0IgogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIiQwXFxjYXJyeV9vdXRbMDowXSI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAxLAogICAgICAgICAgImJpdHMiOiBbIDM2IF0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjE0IgogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIiQwXFxjbnRfZG5bOTowXSI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAxLAogICAgICAgICAgImJpdHMiOiBbIDQ5LCA1MCwgNTEsIDUyLCA1MywgNTQsIDU1LCA1NiwgNTcsIDM3IF0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjE0IgogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIiQwXFxjbnRfdXBbOTowXSI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAxLAogICAgICAgICAgImJpdHMiOiBbIDI2LCAyNywgMjgsIDI5LCAzMCwgMzEsIDMyLCAzMywgMzQsIDM1IF0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjE0IgogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIiQwXFxjb3VudF9vdXRbODowXSI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAxLAogICAgICAgICAgImJpdHMiOiBbIDM5LCA0MCwgNDEsIDQyLCA0MywgNDQsIDQ1LCA0NiwgNDcgXSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgICAic3JjIjogImlucHV0LnY6MTQiCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiJDBcXHBhcml0eV9vdXRbMDowXSI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAxLAogICAgICAgICAgImJpdHMiOiBbIDQ4IF0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjE0IgogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIiRwcm9jbXV4JDM3X0NNUCI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAxLAogICAgICAgICAgImJpdHMiOiBbIDU4IF0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgICIkcHJvY211eCQzOF9DTVAiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMSwKICAgICAgICAgICJiaXRzIjogWyA1OSBdLAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiJHByb2NtdXgkMzlfQ01QIjogewogICAgICAgICAgImhpZGVfbmFtZSI6IDEsCiAgICAgICAgICAiYml0cyI6IFsgNjAgXSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgImJvcnJvd19vdXQiOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMCwKICAgICAgICAgICJiaXRzIjogWyAxNSBdLAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJzcmMiOiAiaW5wdXQudjo5IgogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgImNhcnJ5X291dCI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAwLAogICAgICAgICAgImJpdHMiOiBbIDE0IF0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjkiCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiY2xvY2siOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMCwKICAgICAgICAgICJiaXRzIjogWyAyIF0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjYiCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiY291bnRfb3V0IjogewogICAgICAgICAgImhpZGVfbmFtZSI6IDAsCiAgICAgICAgICAiYml0cyI6IFsgMTYsIDE3LCAxOCwgMTksIDIwLCAyMSwgMjIsIDIzLCAyNCBdLAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJzcmMiOiAiaW5wdXQudjo4IgogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgImRhdGFfaW4iOiB7CiAgICAgICAgICAiaGlkZV9uYW1lIjogMCwKICAgICAgICAgICJiaXRzIjogWyAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMCwgMTEgXSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgICAic3JjIjogImlucHV0LnY6NSIKICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgICJkb3duIjogewogICAgICAgICAgImhpZGVfbmFtZSI6IDAsCiAgICAgICAgICAiYml0cyI6IFsgMTMgXSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgICAic3JjIjogImlucHV0LnY6NiIKICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgICJwYXJpdHlfb3V0IjogewogICAgICAgICAgImhpZGVfbmFtZSI6IDAsCiAgICAgICAgICAiYml0cyI6IFsgMjUgXSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgICAic3JjIjogImlucHV0LnY6OSIKICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgICJ1cCI6IHsKICAgICAgICAgICJoaWRlX25hbWUiOiAwLAogICAgICAgICAgImJpdHMiOiBbIDEyIF0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInNyYyI6ICJpbnB1dC52OjYiCiAgICAgICAgICB9CiAgICAgICAgfQogICAgICB9CiAgICB9CiAgfQp9","base64");
const exampleAnalog = Buffer("ewogICJtb2R1bGVzIjogewogICAgInJlc2lzdG9yX2RpdmlkZXIiOiB7CiAgICAgICJwb3J0cyI6IHsKICAgICAgICAiQSI6IHsKICAgICAgICAgICJkaXJlY3Rpb24iOiAiaW5wdXQiLAogICAgICAgICAgImJpdHMiOiBbMl0KICAgICAgICB9LAogICAgICAgICJCIjogewogICAgICAgICAgImRpcmVjdGlvbiI6ICJpbnB1dCIsCiAgICAgICAgICAiYml0cyI6IFszXQogICAgICAgIH0sCiAgICAgICAgIkEgQU5EIEIiOiB7CiAgICAgICAgICAiZGlyZWN0aW9uIjogIm91dHB1dCIsCiAgICAgICAgICAiYml0cyI6IFs0XQogICAgICAgIH0KICAgICAgfSwKICAgICAgImNlbGxzIjogewogICAgICAgICJSMSI6IHsKICAgICAgICAgICJ0eXBlIjogInJfdiIsCiAgICAgICAgICAiY29ubmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogWzJdLAogICAgICAgICAgICAiQiI6IFs1XQogICAgICAgICAgfSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgICAidmFsdWUiOiIxMGsiCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiUjIiOiB7CiAgICAgICAgICAidHlwZSI6ICJyX3YiLAogICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAiQSI6IFszXSwKICAgICAgICAgICAgIkIiOiBbNV0KICAgICAgICAgIH0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInZhbHVlIjoiMTBrIgogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIlExIjogewogICAgICAgICAgInR5cGUiOiAicV9wbnAiLAogICAgICAgICAgInBvcnRfZGlyZWN0aW9ucyI6IHsKICAgICAgICAgICAgIkMiOiAiaW5wdXQiLAogICAgICAgICAgICAiQiI6ICJpbnB1dCIsCiAgICAgICAgICAgICJFIjogIm91dHB1dCIKICAgICAgICAgIH0sCiAgICAgICAgICAiY29ubmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJDIjogWzZdLAogICAgICAgICAgICAiQiI6IFs1XSwKICAgICAgICAgICAgIkUiOiBbN10KICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgICJSMyI6IHsKICAgICAgICAgICJ0eXBlIjogInJfdiIsCiAgICAgICAgICAiY29ubmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogWzddLAogICAgICAgICAgICAiQiI6IFs4XQogICAgICAgICAgfSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgICAidmFsdWUiOiIxMGsiCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiUjQiOiB7CiAgICAgICAgICAidHlwZSI6ICJyX3YiLAogICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAiQSI6IFs3XSwKICAgICAgICAgICAgIkIiOiBbOV0KICAgICAgICAgIH0sCiAgICAgICAgICAiYXR0cmlidXRlcyI6IHsKICAgICAgICAgICAgInZhbHVlIjoiMTBrIgogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgIlI1IjogewogICAgICAgICAgInR5cGUiOiAicl92IiwKICAgICAgICAgICJjb25uZWN0aW9ucyI6IHsKICAgICAgICAgICAgIkEiOiBbNF0sCiAgICAgICAgICAgICJCIjogWzEyXQogICAgICAgICAgfSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgICAidmFsdWUiOiIxMGsiCiAgICAgICAgICB9CiAgICAgICAgfSwKICAgICAgICAiUTIiOiB7CiAgICAgICAgICAidHlwZSI6ICJxX3BucCIsCiAgICAgICAgICAicG9ydF9kaXJlY3Rpb25zIjogewogICAgICAgICAgICAiQyI6ICJpbnB1dCIsCiAgICAgICAgICAgICJCIjogImlucHV0IiwKICAgICAgICAgICAgIkUiOiAib3V0cHV0IgogICAgICAgICAgfSwKICAgICAgICAgICJjb25uZWN0aW9ucyI6IHsKICAgICAgICAgICAgIkMiOiBbMTBdLAogICAgICAgICAgICAiQiI6IFs5XSwKICAgICAgICAgICAgIkUiOiBbNF0KICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgICJ2Y2MiOiB7CiAgICAgICAgICAidHlwZSI6ICJ2Y2MiLAogICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAiQSI6IFs2XQogICAgICAgICAgfSwKICAgICAgICAgICJhdHRyaWJ1dGVzIjogewogICAgICAgICAgICAibmFtZSI6IlZDQyIKICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgICJ2Y2MyIjogewogICAgICAgICAgInR5cGUiOiAidmNjIiwKICAgICAgICAgICJjb25uZWN0aW9ucyI6IHsKICAgICAgICAgICAgIkEiOiBbMTBdCiAgICAgICAgICB9LAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJuYW1lIjoiVkNDIgogICAgICAgICAgfQogICAgICAgIH0sCiAgICAgICAgImduZCI6IHsKICAgICAgICAgICJ0eXBlIjogImduZCIsCiAgICAgICAgICAicG9ydF9kaXJlY3Rpb25zIjogewogICAgICAgICAgICAiQSI6ICJpbnB1dCIKICAgICAgICAgIH0sCiAgICAgICAgICAiY29ubmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogWzhdCiAgICAgICAgICB9LAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJuYW1lIjoiREdORCIKICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgICJnbmQyIjogewogICAgICAgICAgInR5cGUiOiAiZ25kIiwKICAgICAgICAgICJwb3J0X2RpcmVjdGlvbnMiOiB7CiAgICAgICAgICAgICJBIjogImlucHV0IgogICAgICAgICAgfSwKICAgICAgICAgICJjb25uZWN0aW9ucyI6IHsKICAgICAgICAgICAgIkEiOiBbMTJdCiAgICAgICAgICB9LAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJuYW1lIjoiREdORCIKICAgICAgICAgIH0KICAgICAgICB9CiAgICAgIH0KICAgIH0KICB9Cn0K","base64");
const schema = Buffer("ewogICJkZXNjcmlwdGlvbiI6ICJKU09OIFNjaGVtYSBZb3N5cyBuZXRsaXN0cyBKU09OIGZvcm1hdCIsCiAgInR5cGUiOiAib2JqZWN0IiwKICAvLyBhbiBlbXB0eSBvYmplY3QgaXMgaW52YWxpZAogICJyZXF1aXJlZCI6IFsibW9kdWxlcyJdLAogICJlcnJvck1lc3NhZ2UiOiB7CiAgICAidHlwZSI6ICJuZXRsaXN0IG11c3QgYmUgYSBKU09OIG9iamVjdCIsCiAgICAicmVxdWlyZWQiOiAibmV0bGlzdCBtdXN0IGhhdmUgYSBtb2R1bGVzIHByb3BlcnR5IiwKICB9LAogICJwcm9wZXJ0aWVzIjogewogICAgIm1vZHVsZXMiOiB7CiAgICAgICJ0eXBlIjogIm9iamVjdCIsCiAgICAgIC8vIHRoZXJlIG11c3QgYmUgYXQgbGVhc3Qgb25lIG1vZHVsZQogICAgICAibWluUHJvcGVydGllcyI6IDEsCiAgICAgICAgImVycm9yTWVzc2FnZSI6IHsKICAgICAgICAgICJ0eXBlIjogIm5ldGxpc3QgbW9kdWxlcyBtdXN0IGJlIG9iamVjdHMiLAogICAgICAgICAgIm1pblByb3BlcnRpZXMiOiAibmV0bGlzdCBtdXN0IGhhdmUgYXQgbGVhc3Qgb25lIG1vZHVsZSIsCiAgICAgICAgfSwKICAgICAgImFkZGl0aW9uYWxQcm9wZXJ0aWVzIjogewogICAgICAgICJ0eXBlIjogIm9iamVjdCIsCiAgICAgICAgInByb3BlcnRpZXMiOiB7CiAgICAgICAgICAicG9ydHMiOiB7CiAgICAgICAgICAgICJ0eXBlIjogIm9iamVjdCIsCiAgICAgICAgICAgICJhZGRpdGlvbmFsUHJvcGVydGllcyI6IHsKICAgICAgICAgICAgICAidHlwZSI6ICJvYmplY3QiLAogICAgICAgICAgICAgIC8vIGFsbCBwb3J0cyBtdXN0IGhhdmUgYml0cyBhbmQgYSBkaXJlY3Rpb24KICAgICAgICAgICAgICAicmVxdWlyZWQiOiBbImRpcmVjdGlvbiIsICJiaXRzIl0sCiAgICAgICAgICAgICAgInByb3BlcnRpZXMiOiB7CiAgICAgICAgICAgICAgICAiZGlyZWN0aW9uIjogewogICAgICAgICAgICAgICAgICAiZW51bSI6IFsiaW5wdXQiLCAib3V0cHV0IiwgImlub3V0Il0KICAgICAgICAgICAgICAgIH0sCiAgICAgICAgICAgICAgICAiYml0cyI6IHsKICAgICAgICAgICAgICAgICAgInR5cGUiOiAiYXJyYXkiLAogICAgICAgICAgICAgICAgICAvLyBiaXRzIGNhbiBiZSB0aGUgc3RyaW5nICIwIiwgIjEiLCAieCIsICJ6Iiwgb3IgYSBudW1iZXIuCiAgICAgICAgICAgICAgICAgICJpdGVtcyI6IHsKICAgICAgICAgICAgICAgICAgICAib25lT2YiOlt7InR5cGUiOiJudW1iZXIifSwgeyJlbnVtIjpbIjAiLCIxIiwieCIsInoiXX1dCiAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICB9CiAgICAgICAgICAgIH0KICAgICAgICAgIH0sCiAgICAgICAgICAiY2VsbHMiOiB7CiAgICAgICAgICAgICJ0eXBlIjogIm9iamVjdCIsCiAgICAgICAgICAgICJhZGRpdGlvbmFsUHJvcGVydGllcyI6IHsKICAgICAgICAgICAgICAidHlwZSI6ICJvYmplY3QiLAogICAgICAgICAgICAgIC8vIGFsbCBjZWxscyBtdXN0IGhhdmUgYSB0eXBlIGFuZCBjb25uZWN0aW9ucwogICAgICAgICAgICAgICJyZXF1aXJlZCI6IFsKICAgICAgICAgICAgICAgICJ0eXBlIiwKICAgICAgICAgICAgICAgICJjb25uZWN0aW9ucyIKICAgICAgICAgICAgICBdLAogICAgICAgICAgICAgICJwcm9wZXJ0aWVzIjogewogICAgICAgICAgICAgICAgInR5cGUiOnsidHlwZSI6InN0cmluZyJ9LAogICAgICAgICAgICAgICAgImNvbm5lY3Rpb25zIjogewogICAgICAgICAgICAgICAgICAidHlwZSI6ICJvYmplY3QiLAogICAgICAgICAgICAgICAgICAiYWRkaXRpb25hbFByb3BlcnRpZXMiOiB7CiAgICAgICAgICAgICAgICAgICAgInR5cGUiOiJhcnJheSIsCiAgICAgICAgICAgICAgICAgICAgIml0ZW1zIjogewogICAgICAgICAgICAgICAgICAgICAgIm9uZU9mIjpbeyJ0eXBlIjoibnVtYmVyIn0sIHsiZW51bSI6WyIwIiwiMSIsIngiLCJ6Il19XQogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgfQogICAgICAgICAgICAgICAgfSwKICAgICAgICAgICAgICAgIC8vIHBvcnQgZGlyZWN0aW9ucyBhcmUgb3B0aW9uYWwKICAgICAgICAgICAgICAgICJwb3J0X2RpcmVjdGlvbnMiOnsKICAgICAgICAgICAgICAgICAgInR5cGUiOiAib2JqZWN0IiwKICAgICAgICAgICAgICAgICAgImFkZGl0aW9uYWxQcm9wZXJ0aWVzIjogewogICAgICAgICAgICAgICAgICAgICJlbnVtIjogWyJpbnB1dCIsICJvdXRwdXQiLCAiaW5vdXQiXQogICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICB9LAogICAgICAgICAgICAgICAgLy8gbmV0bGlzdHN2ZyBkb2Vzbid0IHVzZSB0aGVzZSB5ZXQKICAgICAgICAgICAgICAgICJoaWRlX25hbWUiOiB7ImVudW0iOlswLCAxXX0sCiAgICAgICAgICAgICAgICAicGFyYW1ldGVycyI6IHsidHlwZSI6ICJvYmplY3QifSwKICAgICAgICAgICAgICAgICJhdHRyaWJ1dGVzIjogeyJ0eXBlIjogIm9iamVjdCJ9CiAgICAgICAgICAgICAgfQogICAgICAgICAgICB9CiAgICAgICAgICB9LAogICAgICAgICAgLy8gbm90IHlldCB1c2VkIGJ5IG5ldGxpc3RzdmcKICAgICAgICAgICJuZXRuYW1lcyI6IHsKICAgICAgICAgICAgInR5cGUiOiAib2JqZWN0IiwKICAgICAgICAgICAgImFkZGl0aW9uYWxQcm9wZXJ0aWVzIjogewogICAgICAgICAgICAgICJ0eXBlIjogIm9iamVjdCIsCiAgICAgICAgICAgICAgInByb3BlcnRpZXMiOiB7CiAgICAgICAgICAgICAgICAiYml0cyI6IHsKICAgICAgICAgICAgICAgICAgInR5cGUiOiAiYXJyYXkiLAogICAgICAgICAgICAgICAgICAvLyBiaXRzIGNhbiBiZSB0aGUgc3RyaW5nICIwIiwgIjEiLCAieCIsICJ6Iiwgb3IgYSBudW1iZXIuCiAgICAgICAgICAgICAgICAgICJpdGVtcyI6IHsKICAgICAgICAgICAgICAgICAgICAib25lT2YiOiBbeyJ0eXBlIjogIm51bWJlciJ9LCB7ImVudW0iOiBbIjAiLCAiMSIsICJ4IiwgInoiXX1dCiAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIH0sCiAgICAgICAgICAgICAgICAiaGlkZV9uYW1lIjogeyJlbnVtIjogWzAsIDFdfSwKICAgICAgICAgICAgICAgICJhdHRyaWJ1dGVzIjogeyJ0eXBlIjogIm9iamVjdCJ9CiAgICAgICAgICAgICAgfQogICAgICAgICAgICB9CiAgICAgICAgICB9LAogICAgICAgICAgImF0dHJpYnV0ZXMiOiB7CiAgICAgICAgICAgICJ0eXBlIjogIm9iamVjdCIsCiAgICAgICAgICAgICJwcm9wZXJ0aWVzIjogewogICAgICAgICAgICAgICJ0b3AiOiB7ImVudW0iOiBbMCwgMSwgIjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwIiwgIjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxIl19CiAgICAgICAgICAgIH0KICAgICAgICAgIH0KICAgICAgICB9LAogICAgICAgIC8vIHRoZXJlIG11c3QgZWl0aGVyIGJlIHBvcnRzIG9yIGNlbGxzIGF0dHJpYnV0ZQogICAgICAgICJhbnlPZiI6IFt7InJlcXVpcmVkIjogWyJwb3J0cyJdfSx7InJlcXVpcmVkIjogWyJjZWxscyJdfV0KICAgICAgfQogICAgfQogIH0KfQo=","base64");
const exampleDigitalJson = json5.parse(exampleDigital);
const exampleAnalogJson = json5.parse(exampleAnalog);

function render(skinData, netlistData, cb) {
    var valid = ajv.validate(json5.parse(schema), netlistData);
    if (!valid) {
        throw Error(JSON.stringify(ajv.errors, null, 2));
    }
    return lib.render(skinData, netlistData, cb);
}

module.exports = {
    render: render,
    digitalSkin: digital,
    analogSkin: analog,
    exampleDigital: exampleDigitalJson,
    exampleAnalog: exampleAnalogJson
};

}).call(this)}).call(this,require("buffer").Buffer)
},{"../built":8,"ajv":11,"ajv-errors":10,"buffer":76,"json5":87}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ajv_1 = require("ajv");
const codegen_1 = require("ajv/dist/compile/codegen");
const code_1 = require("ajv/dist/compile/codegen/code");
const validate_1 = require("ajv/dist/compile/validate");
const errors_1 = require("ajv/dist/compile/errors");
const names_1 = require("ajv/dist/compile/names");
const keyword = "errorMessage";
const used = new ajv_1.Name("emUsed");
const KEYWORD_PROPERTY_PARAMS = {
    required: "missingProperty",
    dependencies: "property",
    dependentRequired: "property",
};
const INTERPOLATION = /\$\{[^}]+\}/;
const INTERPOLATION_REPLACE = /\$\{([^}]+)\}/g;
const EMPTY_STR = /^""\s*\+\s*|\s*\+\s*""$/g;
function errorMessage(options) {
    return {
        keyword,
        schemaType: ["string", "object"],
        post: true,
        code(cxt) {
            const { gen, data, schema, schemaValue, it } = cxt;
            if (it.createErrors === false)
                return;
            const sch = schema;
            const instancePath = codegen_1.strConcat(names_1.default.instancePath, it.errorPath);
            gen.if(ajv_1._ `${names_1.default.errors} > 0`, () => {
                if (typeof sch == "object") {
                    const [kwdPropErrors, kwdErrors] = keywordErrorsConfig(sch);
                    if (kwdErrors)
                        processKeywordErrors(kwdErrors);
                    if (kwdPropErrors)
                        processKeywordPropErrors(kwdPropErrors);
                    processChildErrors(childErrorsConfig(sch));
                }
                const schMessage = typeof sch == "string" ? sch : sch._;
                if (schMessage)
                    processAllErrors(schMessage);
                if (!options.keepErrors)
                    removeUsedErrors();
            });
            function childErrorsConfig({ properties, items }) {
                const errors = {};
                if (properties) {
                    errors.props = {};
                    for (const p in properties)
                        errors.props[p] = [];
                }
                if (items) {
                    errors.items = {};
                    for (let i = 0; i < items.length; i++)
                        errors.items[i] = [];
                }
                return errors;
            }
            function keywordErrorsConfig(emSchema) {
                let propErrors;
                let errors;
                for (const k in emSchema) {
                    if (k === "properties" || k === "items")
                        continue;
                    const kwdSch = emSchema[k];
                    if (typeof kwdSch == "object") {
                        propErrors || (propErrors = {});
                        const errMap = (propErrors[k] = {});
                        for (const p in kwdSch)
                            errMap[p] = [];
                    }
                    else {
                        errors || (errors = {});
                        errors[k] = [];
                    }
                }
                return [propErrors, errors];
            }
            function processKeywordErrors(kwdErrors) {
                const kwdErrs = gen.const("emErrors", ajv_1.stringify(kwdErrors));
                const templates = gen.const("templates", getTemplatesCode(kwdErrors, schema));
                gen.forOf("err", names_1.default.vErrors, (err) => gen.if(matchKeywordError(err, kwdErrs), () => gen.code(ajv_1._ `${kwdErrs}[${err}.keyword].push(${err})`).assign(ajv_1._ `${err}.${used}`, true)));
                const { singleError } = options;
                if (singleError) {
                    const message = gen.let("message", ajv_1._ `""`);
                    const paramsErrors = gen.let("paramsErrors", ajv_1._ `[]`);
                    loopErrors((key) => {
                        gen.if(message, () => gen.code(ajv_1._ `${message} += ${typeof singleError == "string" ? singleError : ";"}`));
                        gen.code(ajv_1._ `${message} += ${errMessage(key)}`);
                        gen.assign(paramsErrors, ajv_1._ `${paramsErrors}.concat(${kwdErrs}[${key}])`);
                    });
                    errors_1.reportError(cxt, { message, params: ajv_1._ `{errors: ${paramsErrors}}` });
                }
                else {
                    loopErrors((key) => errors_1.reportError(cxt, {
                        message: errMessage(key),
                        params: ajv_1._ `{errors: ${kwdErrs}[${key}]}`,
                    }));
                }
                function loopErrors(body) {
                    gen.forIn("key", kwdErrs, (key) => gen.if(ajv_1._ `${kwdErrs}[${key}].length`, () => body(key)));
                }
                function errMessage(key) {
                    return ajv_1._ `${key} in ${templates} ? ${templates}[${key}]() : ${schemaValue}[${key}]`;
                }
            }
            function processKeywordPropErrors(kwdPropErrors) {
                const kwdErrs = gen.const("emErrors", ajv_1.stringify(kwdPropErrors));
                const templatesCode = [];
                for (const k in kwdPropErrors) {
                    templatesCode.push([
                        k,
                        getTemplatesCode(kwdPropErrors[k], schema[k]),
                    ]);
                }
                const templates = gen.const("templates", gen.object(...templatesCode));
                const kwdPropParams = gen.scopeValue("obj", {
                    ref: KEYWORD_PROPERTY_PARAMS,
                    code: ajv_1.stringify(KEYWORD_PROPERTY_PARAMS),
                });
                const propParam = gen.let("emPropParams");
                const paramsErrors = gen.let("emParamsErrors");
                gen.forOf("err", names_1.default.vErrors, (err) => gen.if(matchKeywordError(err, kwdErrs), () => {
                    gen.assign(propParam, ajv_1._ `${kwdPropParams}[${err}.keyword]`);
                    gen.assign(paramsErrors, ajv_1._ `${kwdErrs}[${err}.keyword][${err}.params[${propParam}]]`);
                    gen.if(paramsErrors, () => gen.code(ajv_1._ `${paramsErrors}.push(${err})`).assign(ajv_1._ `${err}.${used}`, true));
                }));
                gen.forIn("key", kwdErrs, (key) => gen.forIn("keyProp", ajv_1._ `${kwdErrs}[${key}]`, (keyProp) => {
                    gen.assign(paramsErrors, ajv_1._ `${kwdErrs}[${key}][${keyProp}]`);
                    gen.if(ajv_1._ `${paramsErrors}.length`, () => {
                        const tmpl = gen.const("tmpl", ajv_1._ `${templates}[${key}] && ${templates}[${key}][${keyProp}]`);
                        errors_1.reportError(cxt, {
                            message: ajv_1._ `${tmpl} ? ${tmpl}() : ${schemaValue}[${key}][${keyProp}]`,
                            params: ajv_1._ `{errors: ${paramsErrors}}`,
                        });
                    });
                }));
            }
            function processChildErrors(childErrors) {
                const { props, items } = childErrors;
                if (!props && !items)
                    return;
                const isObj = ajv_1._ `typeof ${data} == "object"`;
                const isArr = ajv_1._ `Array.isArray(${data})`;
                const childErrs = gen.let("emErrors");
                let childKwd;
                let childProp;
                const templates = gen.let("templates");
                if (props && items) {
                    childKwd = gen.let("emChildKwd");
                    gen.if(isObj);
                    gen.if(isArr, () => {
                        init(items, schema.items);
                        gen.assign(childKwd, ajv_1.str `items`);
                    }, () => {
                        init(props, schema.properties);
                        gen.assign(childKwd, ajv_1.str `properties`);
                    });
                    childProp = ajv_1._ `[${childKwd}]`;
                }
                else if (items) {
                    gen.if(isArr);
                    init(items, schema.items);
                    childProp = ajv_1._ `.items`;
                }
                else if (props) {
                    gen.if(codegen_1.and(isObj, codegen_1.not(isArr)));
                    init(props, schema.properties);
                    childProp = ajv_1._ `.properties`;
                }
                gen.forOf("err", names_1.default.vErrors, (err) => ifMatchesChildError(err, childErrs, (child) => gen.code(ajv_1._ `${childErrs}[${child}].push(${err})`).assign(ajv_1._ `${err}.${used}`, true)));
                gen.forIn("key", childErrs, (key) => gen.if(ajv_1._ `${childErrs}[${key}].length`, () => {
                    errors_1.reportError(cxt, {
                        message: ajv_1._ `${key} in ${templates} ? ${templates}[${key}]() : ${schemaValue}${childProp}[${key}]`,
                        params: ajv_1._ `{errors: ${childErrs}[${key}]}`,
                    });
                    gen.assign(ajv_1._ `${names_1.default.vErrors}[${names_1.default.errors}-1].instancePath`, ajv_1._ `${instancePath} + "/" + ${key}.replace(/~/g, "~0").replace(/\\//g, "~1")`);
                }));
                gen.endIf();
                function init(children, msgs) {
                    gen.assign(childErrs, ajv_1.stringify(children));
                    gen.assign(templates, getTemplatesCode(children, msgs));
                }
            }
            function processAllErrors(schMessage) {
                const errs = gen.const("emErrs", ajv_1._ `[]`);
                gen.forOf("err", names_1.default.vErrors, (err) => gen.if(matchAnyError(err), () => gen.code(ajv_1._ `${errs}.push(${err})`).assign(ajv_1._ `${err}.${used}`, true)));
                gen.if(ajv_1._ `${errs}.length`, () => errors_1.reportError(cxt, {
                    message: templateExpr(schMessage),
                    params: ajv_1._ `{errors: ${errs}}`,
                }));
            }
            function removeUsedErrors() {
                const errs = gen.const("emErrs", ajv_1._ `[]`);
                gen.forOf("err", names_1.default.vErrors, (err) => gen.if(ajv_1._ `!${err}.${used}`, () => gen.code(ajv_1._ `${errs}.push(${err})`)));
                gen.assign(names_1.default.vErrors, errs).assign(names_1.default.errors, ajv_1._ `${errs}.length`);
            }
            function matchKeywordError(err, kwdErrs) {
                return codegen_1.and(ajv_1._ `${err}.keyword !== ${keyword}`, ajv_1._ `!${err}.${used}`, ajv_1._ `${err}.instancePath === ${instancePath}`, ajv_1._ `${err}.keyword in ${kwdErrs}`, 
                // TODO match the end of the string?
                ajv_1._ `${err}.schemaPath.indexOf(${it.errSchemaPath}) === 0`, ajv_1._ `/^\\/[^\\/]*$/.test(${err}.schemaPath.slice(${it.errSchemaPath.length}))`);
            }
            function ifMatchesChildError(err, childErrs, thenBody) {
                gen.if(codegen_1.and(ajv_1._ `${err}.keyword !== ${keyword}`, ajv_1._ `!${err}.${used}`, ajv_1._ `${err}.instancePath.indexOf(${instancePath}) === 0`), () => {
                    const childRegex = gen.scopeValue("pattern", {
                        ref: /^\/([^/]*)(?:\/|$)/,
                        code: ajv_1._ `new RegExp("^\\\/([^/]*)(?:\\\/|$)")`,
                    });
                    const matches = gen.const("emMatches", ajv_1._ `${childRegex}.exec(${err}.instancePath.slice(${instancePath}.length))`);
                    const child = gen.const("emChild", ajv_1._ `${matches} && ${matches}[1].replace(/~1/g, "/").replace(/~0/g, "~")`);
                    gen.if(ajv_1._ `${child} !== undefined && ${child} in ${childErrs}`, () => thenBody(child));
                });
            }
            function matchAnyError(err) {
                return codegen_1.and(ajv_1._ `${err}.keyword !== ${keyword}`, ajv_1._ `!${err}.${used}`, codegen_1.or(ajv_1._ `${err}.instancePath === ${instancePath}`, codegen_1.and(ajv_1._ `${err}.instancePath.indexOf(${instancePath}) === 0`, ajv_1._ `${err}.instancePath[${instancePath}.length] === "/"`)), ajv_1._ `${err}.schemaPath.indexOf(${it.errSchemaPath}) === 0`, ajv_1._ `${err}.schemaPath[${it.errSchemaPath}.length] === "/"`);
            }
            function getTemplatesCode(keys, msgs) {
                const templatesCode = [];
                for (const k in keys) {
                    const msg = msgs[k];
                    if (INTERPOLATION.test(msg))
                        templatesCode.push([k, templateFunc(msg)]);
                }
                return gen.object(...templatesCode);
            }
            function templateExpr(msg) {
                if (!INTERPOLATION.test(msg))
                    return ajv_1.stringify(msg);
                return new code_1._Code(code_1.safeStringify(msg)
                    .replace(INTERPOLATION_REPLACE, (_s, ptr) => `" + JSON.stringify(${validate_1.getData(ptr, it)}) + "`)
                    .replace(EMPTY_STR, ""));
            }
            function templateFunc(msg) {
                return ajv_1._ `function(){return ${templateExpr(msg)}}`;
            }
        },
        metaSchema: {
            anyOf: [
                { type: "string" },
                {
                    type: "object",
                    properties: {
                        properties: { $ref: "#/$defs/stringMap" },
                        items: { $ref: "#/$defs/stringList" },
                        required: { $ref: "#/$defs/stringOrMap" },
                        dependencies: { $ref: "#/$defs/stringOrMap" },
                    },
                    additionalProperties: { type: "string" },
                },
            ],
            $defs: {
                stringMap: {
                    type: "object",
                    additionalProperties: { type: "string" },
                },
                stringOrMap: {
                    anyOf: [{ type: "string" }, { $ref: "#/$defs/stringMap" }],
                },
                stringList: { type: "array", items: { type: "string" } },
            },
        },
    };
}
const ajvErrors = (ajv, options = {}) => {
    if (!ajv.opts.allErrors)
        throw new Error("ajv-errors: Ajv option allErrors must be true");
    if (ajv.opts.jsPropertySyntax) {
        throw new Error("ajv-errors: ajv option jsPropertySyntax is not supported");
    }
    return ajv.addKeyword(errorMessage(options));
};
exports.default = ajvErrors;
module.exports = ajvErrors;
module.exports.default = ajvErrors;

},{"ajv":11,"ajv/dist/compile/codegen":13,"ajv/dist/compile/codegen/code":12,"ajv/dist/compile/errors":15,"ajv/dist/compile/names":17,"ajv/dist/compile/validate":26}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = void 0;
const core_1 = require("./core");
const draft7_1 = require("./vocabularies/draft7");
const discriminator_1 = require("./vocabularies/discriminator");
const draft7MetaSchema = require("./refs/json-schema-draft-07.json");
const META_SUPPORT_DATA = ["/properties"];
const META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
class Ajv extends core_1.default {
    _addVocabularies() {
        super._addVocabularies();
        draft7_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
            this.addKeyword(discriminator_1.default);
    }
    _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        if (!this.opts.meta)
            return;
        const metaSchema = this.opts.$data
            ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA)
            : draft7MetaSchema;
        this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
    }
    defaultMeta() {
        return (this.opts.defaultMeta =
            super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : undefined));
    }
}
exports.Ajv = Ajv;
module.exports = exports = Ajv;
module.exports.Ajv = Ajv;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Ajv;
var validate_1 = require("./compile/validate");
Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function () { return validate_1.KeywordCxt; } });
var codegen_1 = require("./compile/codegen");
Object.defineProperty(exports, "_", { enumerable: true, get: function () { return codegen_1._; } });
Object.defineProperty(exports, "str", { enumerable: true, get: function () { return codegen_1.str; } });
Object.defineProperty(exports, "stringify", { enumerable: true, get: function () { return codegen_1.stringify; } });
Object.defineProperty(exports, "nil", { enumerable: true, get: function () { return codegen_1.nil; } });
Object.defineProperty(exports, "Name", { enumerable: true, get: function () { return codegen_1.Name; } });
Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function () { return codegen_1.CodeGen; } });
var validation_error_1 = require("./runtime/validation_error");
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return validation_error_1.default; } });
var ref_error_1 = require("./compile/ref_error");
Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function () { return ref_error_1.default; } });

},{"./compile/codegen":13,"./compile/ref_error":18,"./compile/validate":26,"./core":29,"./refs/json-schema-draft-07.json":31,"./runtime/validation_error":35,"./vocabularies/discriminator":57,"./vocabularies/draft7":59}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class _CodeOrName {
}
exports._CodeOrName = _CodeOrName;
exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
class Name extends _CodeOrName {
    constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
            throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
    }
    toString() {
        return this.str;
    }
    emptyStr() {
        return false;
    }
    get names() {
        return { [this.str]: 1 };
    }
}
exports.Name = Name;
class _Code extends _CodeOrName {
    constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
    }
    toString() {
        return this.str;
    }
    emptyStr() {
        if (this._items.length > 1)
            return false;
        const item = this._items[0];
        return item === "" || item === '""';
    }
    get str() {
        var _a;
        return ((_a = this._str) !== null && _a !== void 0 ? _a : (this._str = this._items.reduce((s, c) => `${s}${c}`, "")));
    }
    get names() {
        var _a;
        return ((_a = this._names) !== null && _a !== void 0 ? _a : (this._names = this._items.reduce((names, c) => {
            if (c instanceof Name)
                names[c.str] = (names[c.str] || 0) + 1;
            return names;
        }, {})));
    }
}
exports._Code = _Code;
exports.nil = new _Code("");
function _(strs, ...args) {
    const code = [strs[0]];
    let i = 0;
    while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
    }
    return new _Code(code);
}
exports._ = _;
const plus = new _Code("+");
function str(strs, ...args) {
    const expr = [safeStringify(strs[0])];
    let i = 0;
    while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
    }
    optimize(expr);
    return new _Code(expr);
}
exports.str = str;
function addCodeArg(code, arg) {
    if (arg instanceof _Code)
        code.push(...arg._items);
    else if (arg instanceof Name)
        code.push(arg);
    else
        code.push(interpolate(arg));
}
exports.addCodeArg = addCodeArg;
function optimize(expr) {
    let i = 1;
    while (i < expr.length - 1) {
        if (expr[i] === plus) {
            const res = mergeExprItems(expr[i - 1], expr[i + 1]);
            if (res !== undefined) {
                expr.splice(i - 1, 3, res);
                continue;
            }
            expr[i++] = "+";
        }
        i++;
    }
}
function mergeExprItems(a, b) {
    if (b === '""')
        return a;
    if (a === '""')
        return b;
    if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
            return;
        if (typeof b != "string")
            return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
            return a.slice(0, -1) + b.slice(1);
        return;
    }
    if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
    return;
}
function strConcat(c1, c2) {
    return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str `${c1}${c2}`;
}
exports.strConcat = strConcat;
// TODO do not allow arrays here
function interpolate(x) {
    return typeof x == "number" || typeof x == "boolean" || x === null
        ? x
        : safeStringify(Array.isArray(x) ? x.join(",") : x);
}
function stringify(x) {
    return new _Code(safeStringify(x));
}
exports.stringify = stringify;
function safeStringify(x) {
    return JSON.stringify(x)
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}
exports.safeStringify = safeStringify;
function getProperty(key) {
    return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _ `[${key}]`;
}
exports.getProperty = getProperty;
//Does best effort to format the name properly
function getEsmExportName(key) {
    if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
    }
    throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
}
exports.getEsmExportName = getEsmExportName;
function regexpCode(rx) {
    return new _Code(rx.toString());
}
exports.regexpCode = regexpCode;

},{}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
const code_1 = require("./code");
const scope_1 = require("./scope");
var code_2 = require("./code");
Object.defineProperty(exports, "_", { enumerable: true, get: function () { return code_2._; } });
Object.defineProperty(exports, "str", { enumerable: true, get: function () { return code_2.str; } });
Object.defineProperty(exports, "strConcat", { enumerable: true, get: function () { return code_2.strConcat; } });
Object.defineProperty(exports, "nil", { enumerable: true, get: function () { return code_2.nil; } });
Object.defineProperty(exports, "getProperty", { enumerable: true, get: function () { return code_2.getProperty; } });
Object.defineProperty(exports, "stringify", { enumerable: true, get: function () { return code_2.stringify; } });
Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function () { return code_2.regexpCode; } });
Object.defineProperty(exports, "Name", { enumerable: true, get: function () { return code_2.Name; } });
var scope_2 = require("./scope");
Object.defineProperty(exports, "Scope", { enumerable: true, get: function () { return scope_2.Scope; } });
Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function () { return scope_2.ValueScope; } });
Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function () { return scope_2.ValueScopeName; } });
Object.defineProperty(exports, "varKinds", { enumerable: true, get: function () { return scope_2.varKinds; } });
exports.operators = {
    GT: new code_1._Code(">"),
    GTE: new code_1._Code(">="),
    LT: new code_1._Code("<"),
    LTE: new code_1._Code("<="),
    EQ: new code_1._Code("==="),
    NEQ: new code_1._Code("!=="),
    NOT: new code_1._Code("!"),
    OR: new code_1._Code("||"),
    AND: new code_1._Code("&&"),
    ADD: new code_1._Code("+"),
};
class Node {
    optimizeNodes() {
        return this;
    }
    optimizeNames(_names, _constants) {
        return this;
    }
}
class Def extends Node {
    constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
    }
    render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === undefined ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
    }
    optimizeNames(names, constants) {
        if (!names[this.name.str])
            return;
        if (this.rhs)
            this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
    }
    get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
    }
}
class Assign extends Node {
    constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
    }
    render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
    }
    optimizeNames(names, constants) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
            return;
        this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
    }
    get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
    }
}
class AssignOp extends Assign {
    constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
    }
    render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
    }
}
class Label extends Node {
    constructor(label) {
        super();
        this.label = label;
        this.names = {};
    }
    render({ _n }) {
        return `${this.label}:` + _n;
    }
}
class Break extends Node {
    constructor(label) {
        super();
        this.label = label;
        this.names = {};
    }
    render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
    }
}
class Throw extends Node {
    constructor(error) {
        super();
        this.error = error;
    }
    render({ _n }) {
        return `throw ${this.error};` + _n;
    }
    get names() {
        return this.error.names;
    }
}
class AnyCode extends Node {
    constructor(code) {
        super();
        this.code = code;
    }
    render({ _n }) {
        return `${this.code};` + _n;
    }
    optimizeNodes() {
        return `${this.code}` ? this : undefined;
    }
    optimizeNames(names, constants) {
        this.code = optimizeExpr(this.code, names, constants);
        return this;
    }
    get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
    }
}
class ParentNode extends Node {
    constructor(nodes = []) {
        super();
        this.nodes = nodes;
    }
    render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
    }
    optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
            const n = nodes[i].optimizeNodes();
            if (Array.isArray(n))
                nodes.splice(i, 1, ...n);
            else if (n)
                nodes[i] = n;
            else
                nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : undefined;
    }
    optimizeNames(names, constants) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
            // iterating backwards improves 1-pass optimization
            const n = nodes[i];
            if (n.optimizeNames(names, constants))
                continue;
            subtractNames(names, n.names);
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : undefined;
    }
    get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
    }
}
class BlockNode extends ParentNode {
    render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
    }
}
class Root extends ParentNode {
}
class Else extends BlockNode {
}
Else.kind = "else";
class If extends BlockNode {
    constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
    }
    render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
            code += "else " + this.else.render(opts);
        return code;
    }
    optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
            return this.nodes; // else is ignored here
        let e = this.else;
        if (e) {
            const ns = e.optimizeNodes();
            e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
            if (cond === false)
                return e instanceof If ? e : e.nodes;
            if (this.nodes.length)
                return this;
            return new If(not(cond), e instanceof If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
            return undefined;
        return this;
    }
    optimizeNames(names, constants) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        if (!(super.optimizeNames(names, constants) || this.else))
            return;
        this.condition = optimizeExpr(this.condition, names, constants);
        return this;
    }
    get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
            addNames(names, this.else.names);
        return names;
    }
}
If.kind = "if";
class For extends BlockNode {
}
For.kind = "for";
class ForLoop extends For {
    constructor(iteration) {
        super();
        this.iteration = iteration;
    }
    render(opts) {
        return `for(${this.iteration})` + super.render(opts);
    }
    optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
            return;
        this.iteration = optimizeExpr(this.iteration, names, constants);
        return this;
    }
    get names() {
        return addNames(super.names, this.iteration.names);
    }
}
class ForRange extends For {
    constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
    }
    render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
    }
    get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
    }
}
class ForIter extends For {
    constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
    }
    render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
    }
    optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
            return;
        this.iterable = optimizeExpr(this.iterable, names, constants);
        return this;
    }
    get names() {
        return addNames(super.names, this.iterable.names);
    }
}
class Func extends BlockNode {
    constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
    }
    render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
    }
}
Func.kind = "func";
class Return extends ParentNode {
    render(opts) {
        return "return " + super.render(opts);
    }
}
Return.kind = "return";
class Try extends BlockNode {
    render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
            code += this.catch.render(opts);
        if (this.finally)
            code += this.finally.render(opts);
        return code;
    }
    optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
    }
    optimizeNames(names, constants) {
        var _a, _b;
        super.optimizeNames(names, constants);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
        return this;
    }
    get names() {
        const names = super.names;
        if (this.catch)
            addNames(names, this.catch.names);
        if (this.finally)
            addNames(names, this.finally.names);
        return names;
    }
}
class Catch extends BlockNode {
    constructor(error) {
        super();
        this.error = error;
    }
    render(opts) {
        return `catch(${this.error})` + super.render(opts);
    }
}
Catch.kind = "catch";
class Finally extends BlockNode {
    render(opts) {
        return "finally" + super.render(opts);
    }
}
Finally.kind = "finally";
class CodeGen {
    constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
    }
    toString() {
        return this._root.render(this.opts);
    }
    // returns unique name in the internal scope
    name(prefix) {
        return this._scope.name(prefix);
    }
    // reserves unique name in the external scope
    scopeName(prefix) {
        return this._extScope.name(prefix);
    }
    // reserves unique name in the external scope and assigns value to it
    scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = new Set());
        vs.add(name);
        return name;
    }
    getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
    }
    // return code that assigns values in the external scope to the names that are used internally
    // (same names that were returned by gen.scopeName or gen.scopeValue)
    scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
    }
    scopeCode() {
        return this._extScope.scopeCode(this._values);
    }
    _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== undefined && constant)
            this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
    }
    // `const` declaration (`var` in es5 mode)
    const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
    }
    // `let` declaration with optional assignment (`var` in es5 mode)
    let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
    }
    // `var` declaration with optional assignment
    var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
    }
    // assignment code
    assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
    }
    // `+=` code
    add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
    }
    // appends passed SafeExpr to code or executes Block
    code(c) {
        if (typeof c == "function")
            c();
        else if (c !== code_1.nil)
            this._leafNode(new AnyCode(c));
        return this;
    }
    // returns code for object literal for the passed argument list of key-value pairs
    object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
            if (code.length > 1)
                code.push(",");
            code.push(key);
            if (key !== value || this.opts.es5) {
                code.push(":");
                (0, code_1.addCodeArg)(code, value);
            }
        }
        code.push("}");
        return new code_1._Code(code);
    }
    // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
    if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
            this.code(thenBody).else().code(elseBody).endIf();
        }
        else if (thenBody) {
            this.code(thenBody).endIf();
        }
        else if (elseBody) {
            throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
    }
    // `else if` clause - invalid without `if` or after `else` clauses
    elseIf(condition) {
        return this._elseNode(new If(condition));
    }
    // `else` clause - only valid after `if` or `else if` clauses
    else() {
        return this._elseNode(new Else());
    }
    // end `if` statement (needed if gen.if was used only with condition)
    endIf() {
        return this._endBlockNode(If, Else);
    }
    _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
            this.code(forBody).endFor();
        return this;
    }
    // a generic `for` clause (or statement if `forBody` is passed)
    for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
    }
    // `for` statement for a range of values
    forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
    }
    // `for-of` statement (in es5 mode replace with a normal for loop)
    forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
            const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
            return this.forRange("_i", 0, (0, code_1._) `${arr}.length`, (i) => {
                this.var(name, (0, code_1._) `${arr}[${i}]`);
                forBody(name);
            });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
    }
    // `for-in` statement.
    // With option `ownProperties` replaced with a `for-of` loop for object keys
    forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
            return this.forOf(nameOrPrefix, (0, code_1._) `Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
    }
    // end `for` loop
    endFor() {
        return this._endBlockNode(For);
    }
    // `label` statement
    label(label) {
        return this._leafNode(new Label(label));
    }
    // `break` statement
    break(label) {
        return this._leafNode(new Break(label));
    }
    // `return` statement
    return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
            throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
    }
    // `try` statement
    try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
            throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
            const error = this.name("e");
            this._currNode = node.catch = new Catch(error);
            catchCode(error);
        }
        if (finallyCode) {
            this._currNode = node.finally = new Finally();
            this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
    }
    // `throw` statement
    throw(error) {
        return this._leafNode(new Throw(error));
    }
    // start self-balancing block
    block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
            this.code(body).endBlock(nodeCount);
        return this;
    }
    // end the current self-balancing block
    endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === undefined)
            throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || (nodeCount !== undefined && toClose !== nodeCount)) {
            throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
    }
    // `function` heading (or definition if funcBody is passed)
    func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
            this.code(funcBody).endFunc();
        return this;
    }
    // end function definition
    endFunc() {
        return this._endBlockNode(Func);
    }
    optimize(n = 1) {
        while (n-- > 0) {
            this._root.optimizeNodes();
            this._root.optimizeNames(this._root.names, this._constants);
        }
    }
    _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
    }
    _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
    }
    _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || (N2 && n instanceof N2)) {
            this._nodes.pop();
            return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
    }
    _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
            throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
    }
    get _root() {
        return this._nodes[0];
    }
    get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
    }
    set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
    }
}
exports.CodeGen = CodeGen;
function addNames(names, from) {
    for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
    return names;
}
function addExprNames(names, from) {
    return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
}
function optimizeExpr(expr, names, constants) {
    if (expr instanceof code_1.Name)
        return replaceName(expr);
    if (!canOptimize(expr))
        return expr;
    return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
            c = replaceName(c);
        if (c instanceof code_1._Code)
            items.push(...c._items);
        else
            items.push(c);
        return items;
    }, []));
    function replaceName(n) {
        const c = constants[n.str];
        if (c === undefined || names[n.str] !== 1)
            return n;
        delete names[n.str];
        return c;
    }
    function canOptimize(e) {
        return (e instanceof code_1._Code &&
            e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== undefined));
    }
}
function subtractNames(names, from) {
    for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
}
function not(x) {
    return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._) `!${par(x)}`;
}
exports.not = not;
const andCode = mappend(exports.operators.AND);
// boolean AND (&&) expression with the passed arguments
function and(...args) {
    return args.reduce(andCode);
}
exports.and = and;
const orCode = mappend(exports.operators.OR);
// boolean OR (||) expression with the passed arguments
function or(...args) {
    return args.reduce(orCode);
}
exports.or = or;
function mappend(op) {
    return (x, y) => (x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._) `${par(x)} ${op} ${par(y)}`);
}
function par(x) {
    return x instanceof code_1.Name ? x : (0, code_1._) `(${x})`;
}

},{"./code":12,"./scope":14}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
const code_1 = require("./code");
class ValueError extends Error {
    constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
    }
}
var UsedValueState;
(function (UsedValueState) {
    UsedValueState[UsedValueState["Started"] = 0] = "Started";
    UsedValueState[UsedValueState["Completed"] = 1] = "Completed";
})(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
exports.varKinds = {
    const: new code_1.Name("const"),
    let: new code_1.Name("let"),
    var: new code_1.Name("var"),
};
class Scope {
    constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
    }
    toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
    }
    name(prefix) {
        return new code_1.Name(this._newName(prefix));
    }
    _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
    }
    _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || (this._prefixes && !this._prefixes.has(prefix))) {
            throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return (this._names[prefix] = { prefix, index: 0 });
    }
}
exports.Scope = Scope;
class ValueScopeName extends code_1.Name {
    constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
    }
    setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._) `.${new code_1.Name(property)}[${itemIndex}]`;
    }
}
exports.ValueScopeName = ValueScopeName;
const line = (0, code_1._) `\n`;
class ValueScope extends Scope {
    constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
    }
    get() {
        return this._scope;
    }
    name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
    }
    value(nameOrPrefix, value) {
        var _a;
        if (value.ref === undefined)
            throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
            const _name = vs.get(valueKey);
            if (_name)
                return _name;
        }
        else {
            vs = this._values[prefix] = new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
    }
    getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
            return;
        return vs.get(keyOrRef);
    }
    scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
            if (name.scopePath === undefined)
                throw new Error(`CodeGen: name "${name}" has no value`);
            return (0, code_1._) `${scopeName}${name.scopePath}`;
        });
    }
    scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
            if (name.value === undefined)
                throw new Error(`CodeGen: name "${name}" has no value`);
            return name.value.code;
        }, usedValues, getCode);
    }
    _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
            const vs = values[prefix];
            if (!vs)
                continue;
            const nameSet = (usedValues[prefix] = usedValues[prefix] || new Map());
            vs.forEach((name) => {
                if (nameSet.has(name))
                    return;
                nameSet.set(name, UsedValueState.Started);
                let c = valueCode(name);
                if (c) {
                    const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
                    code = (0, code_1._) `${code}${def} ${name} = ${c};${this.opts._n}`;
                }
                else if ((c = getCode === null || getCode === void 0 ? void 0 : getCode(name))) {
                    code = (0, code_1._) `${code}${c}${this.opts._n}`;
                }
                else {
                    throw new ValueError(name);
                }
                nameSet.set(name, UsedValueState.Completed);
            });
        }
        return code;
    }
}
exports.ValueScope = ValueScope;

},{"./code":12}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
const codegen_1 = require("./codegen");
const util_1 = require("./util");
const names_1 = require("./names");
exports.keywordError = {
    message: ({ keyword }) => (0, codegen_1.str) `must pass "${keyword}" keyword validation`,
};
exports.keyword$DataError = {
    message: ({ keyword, schemaType }) => schemaType
        ? (0, codegen_1.str) `"${keyword}" keyword must be ${schemaType} ($data)`
        : (0, codegen_1.str) `"${keyword}" keyword is invalid ($data)`,
};
function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
    const { it } = cxt;
    const { gen, compositeRule, allErrors } = it;
    const errObj = errorObjectCode(cxt, error, errorPaths);
    if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : (compositeRule || allErrors)) {
        addError(gen, errObj);
    }
    else {
        returnErrors(it, (0, codegen_1._) `[${errObj}]`);
    }
}
exports.reportError = reportError;
function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
    const { it } = cxt;
    const { gen, compositeRule, allErrors } = it;
    const errObj = errorObjectCode(cxt, error, errorPaths);
    addError(gen, errObj);
    if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
    }
}
exports.reportExtraError = reportExtraError;
function resetErrorsCount(gen, errsCount) {
    gen.assign(names_1.default.errors, errsCount);
    gen.if((0, codegen_1._) `${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._) `${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
}
exports.resetErrorsCount = resetErrorsCount;
function extendErrors({ gen, keyword, schemaValue, data, errsCount, it, }) {
    /* istanbul ignore if */
    if (errsCount === undefined)
        throw new Error("ajv implementation error");
    const err = gen.name("err");
    gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._) `${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._) `${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._) `${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._) `${err}.schemaPath`, (0, codegen_1.str) `${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
            gen.assign((0, codegen_1._) `${err}.schema`, schemaValue);
            gen.assign((0, codegen_1._) `${err}.data`, data);
        }
    });
}
exports.extendErrors = extendErrors;
function addError(gen, errObj) {
    const err = gen.const("err", errObj);
    gen.if((0, codegen_1._) `${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._) `[${err}]`), (0, codegen_1._) `${names_1.default.vErrors}.push(${err})`);
    gen.code((0, codegen_1._) `${names_1.default.errors}++`);
}
function returnErrors(it, errs) {
    const { gen, validateName, schemaEnv } = it;
    if (schemaEnv.$async) {
        gen.throw((0, codegen_1._) `new ${it.ValidationError}(${errs})`);
    }
    else {
        gen.assign((0, codegen_1._) `${validateName}.errors`, errs);
        gen.return(false);
    }
}
const E = {
    keyword: new codegen_1.Name("keyword"),
    schemaPath: new codegen_1.Name("schemaPath"), // also used in JTD errors
    params: new codegen_1.Name("params"),
    propertyName: new codegen_1.Name("propertyName"),
    message: new codegen_1.Name("message"),
    schema: new codegen_1.Name("schema"),
    parentSchema: new codegen_1.Name("parentSchema"),
};
function errorObjectCode(cxt, error, errorPaths) {
    const { createErrors } = cxt.it;
    if (createErrors === false)
        return (0, codegen_1._) `{}`;
    return errorObject(cxt, error, errorPaths);
}
function errorObject(cxt, error, errorPaths = {}) {
    const { gen, it } = cxt;
    const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths),
    ];
    extraErrorProps(cxt, error, keyValues);
    return gen.object(...keyValues);
}
function errorInstancePath({ errorPath }, { instancePath }) {
    const instPath = instancePath
        ? (0, codegen_1.str) `${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}`
        : errorPath;
    return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
}
function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
    let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str) `${errSchemaPath}/${keyword}`;
    if (schemaPath) {
        schPath = (0, codegen_1.str) `${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
    }
    return [E.schemaPath, schPath];
}
function extraErrorProps(cxt, { params, message }, keyValues) {
    const { keyword, data, schemaValue, it } = cxt;
    const { opts, propertyName, topSchemaRef, schemaPath } = it;
    keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._) `{}`]);
    if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
    }
    if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._) `${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
    }
    if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
}

},{"./codegen":13,"./names":17,"./util":21}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
const codegen_1 = require("./codegen");
const validation_error_1 = require("../runtime/validation_error");
const names_1 = require("./names");
const resolve_1 = require("./resolve");
const util_1 = require("./util");
const validate_1 = require("./validate");
class SchemaEnv {
    constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema;
        if (typeof env.schema == "object")
            schema = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
        this.refs = {};
    }
}
exports.SchemaEnv = SchemaEnv;
// let codeSize = 0
// let nodeCount = 0
// Compiles schema in SchemaEnv
function compileSchema(sch) {
    // TODO refactor - remove compilations
    const _sch = getCompilingSchema.call(this, sch);
    if (_sch)
        return _sch;
    const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId); // TODO if getFullPath removed 1 tests fails
    const { es5, lines } = this.opts.code;
    const { ownProperties } = this.opts;
    const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
    let _ValidationError;
    if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
            ref: validation_error_1.default,
            code: (0, codegen_1._) `require("ajv/dist/runtime/validation_error").default`,
        });
    }
    const validateName = gen.scopeName("validate");
    sch.validateName = validateName;
    const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil], // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true
            ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) }
            : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._) `""`,
        opts: this.opts,
        self: this,
    };
    let sourceCode;
    try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        // gen.optimize(1)
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        // console.log((codeSize += sourceCode.length), (nodeCount += gen.nodeCount))
        if (this.opts.code.process)
            sourceCode = this.opts.code.process(sourceCode, sch);
        // console.log("\n\n\n *** \n", sourceCode)
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate });
        validate.errors = null;
        validate.schema = sch.schema;
        validate.schemaEnv = sch;
        if (sch.$async)
            validate.$async = true;
        if (this.opts.code.source === true) {
            validate.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
            const { props, items } = schemaCxt;
            validate.evaluated = {
                props: props instanceof codegen_1.Name ? undefined : props,
                items: items instanceof codegen_1.Name ? undefined : items,
                dynamicProps: props instanceof codegen_1.Name,
                dynamicItems: items instanceof codegen_1.Name,
            };
            if (validate.source)
                validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
        }
        sch.validate = validate;
        return sch;
    }
    catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
            this.logger.error("Error compiling schema, function code:", sourceCode);
        // console.log("\n\n\n *** \n", sourceCode, this.opts)
        throw e;
    }
    finally {
        this._compilations.delete(sch);
    }
}
exports.compileSchema = compileSchema;
function resolveRef(root, baseId, ref) {
    var _a;
    ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
    const schOrFunc = root.refs[ref];
    if (schOrFunc)
        return schOrFunc;
    let _sch = resolve.call(this, root, ref);
    if (_sch === undefined) {
        const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref]; // TODO maybe localRefs should hold SchemaEnv
        const { schemaId } = this.opts;
        if (schema)
            _sch = new SchemaEnv({ schema, schemaId, root, baseId });
    }
    if (_sch === undefined)
        return;
    return (root.refs[ref] = inlineOrCompile.call(this, _sch));
}
exports.resolveRef = resolveRef;
function inlineOrCompile(sch) {
    if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
    return sch.validate ? sch : compileSchema.call(this, sch);
}
// Index of schema compilation in the currently compiled list
function getCompilingSchema(schEnv) {
    for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
            return sch;
    }
}
exports.getCompilingSchema = getCompilingSchema;
function sameSchemaEnv(s1, s2) {
    return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
}
// resolve and compile the references ($ref)
// TODO returns AnySchemaObject (if the schema can be inlined) or validation function
function resolve(root, // information about the root schema for the current schema
ref // reference to resolve
) {
    let sch;
    while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
    return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
}
// Resolve schema, its root and baseId
function resolveSchema(root, // root object with properties schema, refs TODO below SchemaEnv is assigned to it
ref // reference to resolve
) {
    const p = this.opts.uriResolver.parse(ref);
    const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
    let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, undefined);
    // TODO `Object.keys(root.schema).length > 0` should not be needed - but removing breaks 2 tests
    if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
    }
    const id = (0, resolve_1.normalizeId)(refPath);
    const schOrRef = this.refs[id] || this.schemas[id];
    if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
            return;
        return getJsonPointer.call(this, p, sch);
    }
    if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
    if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
    if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema[schemaId];
        if (schId)
            baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema, schemaId, root, baseId });
    }
    return getJsonPointer.call(this, p, schOrRef);
}
exports.resolveSchema = resolveSchema;
const PREVENT_SCOPE_CHANGE = new Set([
    "properties",
    "patternProperties",
    "enum",
    "dependencies",
    "definitions",
]);
function getJsonPointer(parsedRef, { baseId, schema, root }) {
    var _a;
    if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
    for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema === "boolean")
            return;
        const partSchema = schema[(0, util_1.unescapeFragment)(part)];
        if (partSchema === undefined)
            return;
        schema = partSchema;
        // TODO PREVENT_SCOPE_CHANGE could be defined in keyword def?
        const schId = typeof schema === "object" && schema[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
            baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
    }
    let env;
    if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
        env = resolveSchema.call(this, root, $ref);
    }
    // even though resolution failed we need to return SchemaEnv to throw exception
    // so that compileAsync loads missing schema.
    const { schemaId } = this.opts;
    env = env || new SchemaEnv({ schema, schemaId, root, baseId });
    if (env.schema !== env.root.schema)
        return env;
    return undefined;
}

},{"../runtime/validation_error":35,"./codegen":13,"./names":17,"./resolve":19,"./util":21,"./validate":26}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("./codegen");
const names = {
    // validation function arguments
    data: new codegen_1.Name("data"), // data passed to validation function
    // args passed from referencing schema
    valCxt: new codegen_1.Name("valCxt"), // validation/data context - should not be used directly, it is destructured to the names below
    instancePath: new codegen_1.Name("instancePath"),
    parentData: new codegen_1.Name("parentData"),
    parentDataProperty: new codegen_1.Name("parentDataProperty"),
    rootData: new codegen_1.Name("rootData"), // root data - same as the data passed to the first/top validation function
    dynamicAnchors: new codegen_1.Name("dynamicAnchors"), // used to support recursiveRef and dynamicRef
    // function scoped variables
    vErrors: new codegen_1.Name("vErrors"), // null or array of validation errors
    errors: new codegen_1.Name("errors"), // counter of validation errors
    this: new codegen_1.Name("this"),
    // "globals"
    self: new codegen_1.Name("self"),
    scope: new codegen_1.Name("scope"),
    // JTD serialize/parse name for JSON string and position
    json: new codegen_1.Name("json"),
    jsonPos: new codegen_1.Name("jsonPos"),
    jsonLen: new codegen_1.Name("jsonLen"),
    jsonPart: new codegen_1.Name("jsonPart"),
};
exports.default = names;

},{"./codegen":13}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resolve_1 = require("./resolve");
class MissingRefError extends Error {
    constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
    }
}
exports.default = MissingRefError;

},{"./resolve":19}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
const util_1 = require("./util");
const equal = require("fast-deep-equal");
const traverse = require("json-schema-traverse");
// TODO refactor to use keyword definitions
const SIMPLE_INLINED = new Set([
    "type",
    "format",
    "pattern",
    "maxLength",
    "minLength",
    "maxProperties",
    "minProperties",
    "maxItems",
    "minItems",
    "maximum",
    "minimum",
    "uniqueItems",
    "multipleOf",
    "required",
    "enum",
    "const",
]);
function inlineRef(schema, limit = true) {
    if (typeof schema == "boolean")
        return true;
    if (limit === true)
        return !hasRef(schema);
    if (!limit)
        return false;
    return countKeys(schema) <= limit;
}
exports.inlineRef = inlineRef;
const REF_KEYWORDS = new Set([
    "$ref",
    "$recursiveRef",
    "$recursiveAnchor",
    "$dynamicRef",
    "$dynamicAnchor",
]);
function hasRef(schema) {
    for (const key in schema) {
        if (REF_KEYWORDS.has(key))
            return true;
        const sch = schema[key];
        if (Array.isArray(sch) && sch.some(hasRef))
            return true;
        if (typeof sch == "object" && hasRef(sch))
            return true;
    }
    return false;
}
function countKeys(schema) {
    let count = 0;
    for (const key in schema) {
        if (key === "$ref")
            return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
            continue;
        if (typeof schema[key] == "object") {
            (0, util_1.eachItem)(schema[key], (sch) => (count += countKeys(sch)));
        }
        if (count === Infinity)
            return Infinity;
    }
    return count;
}
function getFullPath(resolver, id = "", normalize) {
    if (normalize !== false)
        id = normalizeId(id);
    const p = resolver.parse(id);
    return _getFullPath(resolver, p);
}
exports.getFullPath = getFullPath;
function _getFullPath(resolver, p) {
    const serialized = resolver.serialize(p);
    return serialized.split("#")[0] + "#";
}
exports._getFullPath = _getFullPath;
const TRAILING_SLASH_HASH = /#\/?$/;
function normalizeId(id) {
    return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
}
exports.normalizeId = normalizeId;
function resolveUrl(resolver, baseId, id) {
    id = normalizeId(id);
    return resolver.resolve(baseId, id);
}
exports.resolveUrl = resolveUrl;
const ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
function getSchemaRefs(schema, baseId) {
    if (typeof schema == "boolean")
        return {};
    const { schemaId, uriResolver } = this.opts;
    const schId = normalizeId(schema[schemaId] || baseId);
    const baseIds = { "": schId };
    const pathPrefix = getFullPath(uriResolver, schId, false);
    const localRefs = {};
    const schemaRefs = new Set();
    traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === undefined)
            return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
            innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            const _resolve = this.opts.uriResolver.resolve;
            ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
            if (schemaRefs.has(ref))
                throw ambiguos(ref);
            schemaRefs.add(ref);
            let schOrRef = this.refs[ref];
            if (typeof schOrRef == "string")
                schOrRef = this.refs[schOrRef];
            if (typeof schOrRef == "object") {
                checkAmbiguosRef(sch, schOrRef.schema, ref);
            }
            else if (ref !== normalizeId(fullPath)) {
                if (ref[0] === "#") {
                    checkAmbiguosRef(sch, localRefs[ref], ref);
                    localRefs[ref] = sch;
                }
                else {
                    this.refs[ref] = fullPath;
                }
            }
            return ref;
        }
        function addAnchor(anchor) {
            if (typeof anchor == "string") {
                if (!ANCHOR.test(anchor))
                    throw new Error(`invalid anchor "${anchor}"`);
                addRef.call(this, `#${anchor}`);
            }
        }
    });
    return localRefs;
    function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== undefined && !equal(sch1, sch2))
            throw ambiguos(ref);
    }
    function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
    }
}
exports.getSchemaRefs = getSchemaRefs;

},{"./util":21,"fast-deep-equal":79,"json-schema-traverse":86}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRules = exports.isJSONType = void 0;
const _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
const jsonTypes = new Set(_jsonTypes);
function isJSONType(x) {
    return typeof x == "string" && jsonTypes.has(x);
}
exports.isJSONType = isJSONType;
function getRules() {
    const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] },
    };
    return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {},
    };
}
exports.getRules = getRules;

},{}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
const codegen_1 = require("./codegen");
const code_1 = require("./codegen/code");
// TODO refactor to use Set
function toHash(arr) {
    const hash = {};
    for (const item of arr)
        hash[item] = true;
    return hash;
}
exports.toHash = toHash;
function alwaysValidSchema(it, schema) {
    if (typeof schema == "boolean")
        return schema;
    if (Object.keys(schema).length === 0)
        return true;
    checkUnknownRules(it, schema);
    return !schemaHasRules(schema, it.self.RULES.all);
}
exports.alwaysValidSchema = alwaysValidSchema;
function checkUnknownRules(it, schema = it.schema) {
    const { opts, self } = it;
    if (!opts.strictSchema)
        return;
    if (typeof schema === "boolean")
        return;
    const rules = self.RULES.keywords;
    for (const key in schema) {
        if (!rules[key])
            checkStrictMode(it, `unknown keyword: "${key}"`);
    }
}
exports.checkUnknownRules = checkUnknownRules;
function schemaHasRules(schema, rules) {
    if (typeof schema == "boolean")
        return !schema;
    for (const key in schema)
        if (rules[key])
            return true;
    return false;
}
exports.schemaHasRules = schemaHasRules;
function schemaHasRulesButRef(schema, RULES) {
    if (typeof schema == "boolean")
        return !schema;
    for (const key in schema)
        if (key !== "$ref" && RULES.all[key])
            return true;
    return false;
}
exports.schemaHasRulesButRef = schemaHasRulesButRef;
function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
    if (!$data) {
        if (typeof schema == "number" || typeof schema == "boolean")
            return schema;
        if (typeof schema == "string")
            return (0, codegen_1._) `${schema}`;
    }
    return (0, codegen_1._) `${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
}
exports.schemaRefOrVal = schemaRefOrVal;
function unescapeFragment(str) {
    return unescapeJsonPointer(decodeURIComponent(str));
}
exports.unescapeFragment = unescapeFragment;
function escapeFragment(str) {
    return encodeURIComponent(escapeJsonPointer(str));
}
exports.escapeFragment = escapeFragment;
function escapeJsonPointer(str) {
    if (typeof str == "number")
        return `${str}`;
    return str.replace(/~/g, "~0").replace(/\//g, "~1");
}
exports.escapeJsonPointer = escapeJsonPointer;
function unescapeJsonPointer(str) {
    return str.replace(/~1/g, "/").replace(/~0/g, "~");
}
exports.unescapeJsonPointer = unescapeJsonPointer;
function eachItem(xs, f) {
    if (Array.isArray(xs)) {
        for (const x of xs)
            f(x);
    }
    else {
        f(xs);
    }
}
exports.eachItem = eachItem;
function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName, }) {
    return (gen, from, to, toName) => {
        const res = to === undefined
            ? from
            : to instanceof codegen_1.Name
                ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to)
                : from instanceof codegen_1.Name
                    ? (mergeToName(gen, to, from), from)
                    : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
    };
}
exports.mergeEvaluated = {
    props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._) `${to} !== true && ${from} !== undefined`, () => {
            gen.if((0, codegen_1._) `${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._) `${to} || {}`).code((0, codegen_1._) `Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._) `${to} !== true`, () => {
            if (from === true) {
                gen.assign(to, true);
            }
            else {
                gen.assign(to, (0, codegen_1._) `${to} || {}`);
                setEvaluated(gen, to, from);
            }
        }),
        mergeValues: (from, to) => (from === true ? true : { ...from, ...to }),
        resultToName: evaluatedPropsToName,
    }),
    items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._) `${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._) `${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._) `${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._) `${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => (from === true ? true : Math.max(from, to)),
        resultToName: (gen, items) => gen.var("items", items),
    }),
};
function evaluatedPropsToName(gen, ps) {
    if (ps === true)
        return gen.var("props", true);
    const props = gen.var("props", (0, codegen_1._) `{}`);
    if (ps !== undefined)
        setEvaluated(gen, props, ps);
    return props;
}
exports.evaluatedPropsToName = evaluatedPropsToName;
function setEvaluated(gen, props, ps) {
    Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._) `${props}${(0, codegen_1.getProperty)(p)}`, true));
}
exports.setEvaluated = setEvaluated;
const snippets = {};
function useFunc(gen, f) {
    return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code)),
    });
}
exports.useFunc = useFunc;
var Type;
(function (Type) {
    Type[Type["Num"] = 0] = "Num";
    Type[Type["Str"] = 1] = "Str";
})(Type || (exports.Type = Type = {}));
function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
    // let path
    if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax
            ? isNumber
                ? (0, codegen_1._) `"[" + ${dataProp} + "]"`
                : (0, codegen_1._) `"['" + ${dataProp} + "']"`
            : isNumber
                ? (0, codegen_1._) `"/" + ${dataProp}`
                : (0, codegen_1._) `"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`; // TODO maybe use global escapePointer
    }
    return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
}
exports.getErrorPath = getErrorPath;
function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
    if (!mode)
        return;
    msg = `strict mode: ${msg}`;
    if (mode === true)
        throw new Error(msg);
    it.self.logger.warn(msg);
}
exports.checkStrictMode = checkStrictMode;

},{"./codegen":13,"./codegen/code":12}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
function schemaHasRulesForType({ schema, self }, type) {
    const group = self.RULES.types[type];
    return group && group !== true && shouldUseGroup(schema, group);
}
exports.schemaHasRulesForType = schemaHasRulesForType;
function shouldUseGroup(schema, group) {
    return group.rules.some((rule) => shouldUseRule(schema, rule));
}
exports.shouldUseGroup = shouldUseGroup;
function shouldUseRule(schema, rule) {
    var _a;
    return (schema[rule.keyword] !== undefined ||
        ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== undefined)));
}
exports.shouldUseRule = shouldUseRule;

},{}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
const errors_1 = require("../errors");
const codegen_1 = require("../codegen");
const names_1 = require("../names");
const boolError = {
    message: "boolean schema is false",
};
function topBoolOrEmptySchema(it) {
    const { gen, schema, validateName } = it;
    if (schema === false) {
        falseSchemaError(it, false);
    }
    else if (typeof schema == "object" && schema.$async === true) {
        gen.return(names_1.default.data);
    }
    else {
        gen.assign((0, codegen_1._) `${validateName}.errors`, null);
        gen.return(true);
    }
}
exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
function boolOrEmptySchema(it, valid) {
    const { gen, schema } = it;
    if (schema === false) {
        gen.var(valid, false); // TODO var
        falseSchemaError(it);
    }
    else {
        gen.var(valid, true); // TODO var
    }
}
exports.boolOrEmptySchema = boolOrEmptySchema;
function falseSchemaError(it, overrideAllErrors) {
    const { gen, data } = it;
    // TODO maybe some other interface should be used for non-keyword validation errors...
    const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it,
    };
    (0, errors_1.reportError)(cxt, boolError, undefined, overrideAllErrors);
}

},{"../codegen":13,"../errors":15,"../names":17}],24:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
const rules_1 = require("../rules");
const applicability_1 = require("./applicability");
const errors_1 = require("../errors");
const codegen_1 = require("../codegen");
const util_1 = require("../util");
var DataType;
(function (DataType) {
    DataType[DataType["Correct"] = 0] = "Correct";
    DataType[DataType["Wrong"] = 1] = "Wrong";
})(DataType || (exports.DataType = DataType = {}));
function getSchemaTypes(schema) {
    const types = getJSONTypes(schema.type);
    const hasNull = types.includes("null");
    if (hasNull) {
        if (schema.nullable === false)
            throw new Error("type: null contradicts nullable: false");
    }
    else {
        if (!types.length && schema.nullable !== undefined) {
            throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema.nullable === true)
            types.push("null");
    }
    return types;
}
exports.getSchemaTypes = getSchemaTypes;
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
function getJSONTypes(ts) {
    const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
    if (types.every(rules_1.isJSONType))
        return types;
    throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
}
exports.getJSONTypes = getJSONTypes;
function coerceAndCheckDataType(it, types) {
    const { gen, data, opts } = it;
    const coerceTo = coerceToTypes(types, opts.coerceTypes);
    const checkTypes = types.length > 0 &&
        !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
    if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
            if (coerceTo.length)
                coerceData(it, types, coerceTo);
            else
                reportTypeError(it);
        });
    }
    return checkTypes;
}
exports.coerceAndCheckDataType = coerceAndCheckDataType;
const COERCIBLE = new Set(["string", "number", "integer", "boolean", "null"]);
function coerceToTypes(types, coerceTypes) {
    return coerceTypes
        ? types.filter((t) => COERCIBLE.has(t) || (coerceTypes === "array" && t === "array"))
        : [];
}
function coerceData(it, types, coerceTo) {
    const { gen, data, opts } = it;
    const dataType = gen.let("dataType", (0, codegen_1._) `typeof ${data}`);
    const coerced = gen.let("coerced", (0, codegen_1._) `undefined`);
    if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._) `${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen
            .assign(data, (0, codegen_1._) `${data}[0]`)
            .assign(dataType, (0, codegen_1._) `typeof ${data}`)
            .if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
    }
    gen.if((0, codegen_1._) `${coerced} !== undefined`);
    for (const t of coerceTo) {
        if (COERCIBLE.has(t) || (t === "array" && opts.coerceTypes === "array")) {
            coerceSpecificType(t);
        }
    }
    gen.else();
    reportTypeError(it);
    gen.endIf();
    gen.if((0, codegen_1._) `${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
    });
    function coerceSpecificType(t) {
        switch (t) {
            case "string":
                gen
                    .elseIf((0, codegen_1._) `${dataType} == "number" || ${dataType} == "boolean"`)
                    .assign(coerced, (0, codegen_1._) `"" + ${data}`)
                    .elseIf((0, codegen_1._) `${data} === null`)
                    .assign(coerced, (0, codegen_1._) `""`);
                return;
            case "number":
                gen
                    .elseIf((0, codegen_1._) `${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`)
                    .assign(coerced, (0, codegen_1._) `+${data}`);
                return;
            case "integer":
                gen
                    .elseIf((0, codegen_1._) `${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`)
                    .assign(coerced, (0, codegen_1._) `+${data}`);
                return;
            case "boolean":
                gen
                    .elseIf((0, codegen_1._) `${data} === "false" || ${data} === 0 || ${data} === null`)
                    .assign(coerced, false)
                    .elseIf((0, codegen_1._) `${data} === "true" || ${data} === 1`)
                    .assign(coerced, true);
                return;
            case "null":
                gen.elseIf((0, codegen_1._) `${data} === "" || ${data} === 0 || ${data} === false`);
                gen.assign(coerced, null);
                return;
            case "array":
                gen
                    .elseIf((0, codegen_1._) `${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`)
                    .assign(coerced, (0, codegen_1._) `[${data}]`);
        }
    }
}
function assignParentData({ gen, parentData, parentDataProperty }, expr) {
    // TODO use gen.property
    gen.if((0, codegen_1._) `${parentData} !== undefined`, () => gen.assign((0, codegen_1._) `${parentData}[${parentDataProperty}]`, expr));
}
function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
    const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
    let cond;
    switch (dataType) {
        case "null":
            return (0, codegen_1._) `${data} ${EQ} null`;
        case "array":
            cond = (0, codegen_1._) `Array.isArray(${data})`;
            break;
        case "object":
            cond = (0, codegen_1._) `${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
            break;
        case "integer":
            cond = numCond((0, codegen_1._) `!(${data} % 1) && !isNaN(${data})`);
            break;
        case "number":
            cond = numCond();
            break;
        default:
            return (0, codegen_1._) `typeof ${data} ${EQ} ${dataType}`;
    }
    return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
    function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._) `typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._) `isFinite(${data})` : codegen_1.nil);
    }
}
exports.checkDataType = checkDataType;
function checkDataTypes(dataTypes, data, strictNums, correct) {
    if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
    }
    let cond;
    const types = (0, util_1.toHash)(dataTypes);
    if (types.array && types.object) {
        const notObj = (0, codegen_1._) `typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._) `!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
    }
    else {
        cond = codegen_1.nil;
    }
    if (types.number)
        delete types.integer;
    for (const t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
    return cond;
}
exports.checkDataTypes = checkDataTypes;
const typeError = {
    message: ({ schema }) => `must be ${schema}`,
    params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._) `{type: ${schema}}` : (0, codegen_1._) `{type: ${schemaValue}}`,
};
function reportTypeError(it) {
    const cxt = getTypeErrorContext(it);
    (0, errors_1.reportError)(cxt, typeError);
}
exports.reportTypeError = reportTypeError;
function getTypeErrorContext(it) {
    const { gen, data, schema } = it;
    const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
    return {
        gen,
        keyword: "type",
        data,
        schema: schema.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema,
        params: {},
        it,
    };
}

},{"../codegen":13,"../errors":15,"../rules":20,"../util":21,"./applicability":22}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignDefaults = void 0;
const codegen_1 = require("../codegen");
const util_1 = require("../util");
function assignDefaults(it, ty) {
    const { properties, items } = it.schema;
    if (ty === "object" && properties) {
        for (const key in properties) {
            assignDefault(it, key, properties[key].default);
        }
    }
    else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
    }
}
exports.assignDefaults = assignDefaults;
function assignDefault(it, prop, defaultValue) {
    const { gen, compositeRule, data, opts } = it;
    if (defaultValue === undefined)
        return;
    const childData = (0, codegen_1._) `${data}${(0, codegen_1.getProperty)(prop)}`;
    if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
    }
    let condition = (0, codegen_1._) `${childData} === undefined`;
    if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._) `${condition} || ${childData} === null || ${childData} === ""`;
    }
    // `${childData} === undefined` +
    // (opts.useDefaults === "empty" ? ` || ${childData} === null || ${childData} === ""` : "")
    gen.if(condition, (0, codegen_1._) `${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
}

},{"../codegen":13,"../util":21}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
const boolSchema_1 = require("./boolSchema");
const dataType_1 = require("./dataType");
const applicability_1 = require("./applicability");
const dataType_2 = require("./dataType");
const defaults_1 = require("./defaults");
const keyword_1 = require("./keyword");
const subschema_1 = require("./subschema");
const codegen_1 = require("../codegen");
const names_1 = require("../names");
const resolve_1 = require("../resolve");
const util_1 = require("../util");
const errors_1 = require("../errors");
// schema compilation - generates validation function, subschemaCode (below) is used for subschemas
function validateFunctionCode(it) {
    if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
            topSchemaObjCode(it);
            return;
        }
    }
    validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
}
exports.validateFunctionCode = validateFunctionCode;
function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
    if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._) `${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
            gen.code((0, codegen_1._) `"use strict"; ${funcSourceUrl(schema, opts)}`);
            destructureValCxtES5(gen, opts);
            gen.code(body);
        });
    }
    else {
        gen.func(validateName, (0, codegen_1._) `${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
    }
}
function destructureValCxt(opts) {
    return (0, codegen_1._) `{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._) `, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
}
function destructureValCxtES5(gen, opts) {
    gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._) `${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._) `${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._) `${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._) `${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
            gen.var(names_1.default.dynamicAnchors, (0, codegen_1._) `${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
    }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._) `""`);
        gen.var(names_1.default.parentData, (0, codegen_1._) `undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._) `undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
            gen.var(names_1.default.dynamicAnchors, (0, codegen_1._) `{}`);
    });
}
function topSchemaObjCode(it) {
    const { schema, opts, gen } = it;
    validateFunction(it, () => {
        if (opts.$comment && schema.$comment)
            commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
            resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
    });
    return;
}
function resetEvaluated(it) {
    // TODO maybe some hook to execute it in the end to check whether props/items are Name, as in assignEvaluated
    const { gen, validateName } = it;
    it.evaluated = gen.const("evaluated", (0, codegen_1._) `${validateName}.evaluated`);
    gen.if((0, codegen_1._) `${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._) `${it.evaluated}.props`, (0, codegen_1._) `undefined`));
    gen.if((0, codegen_1._) `${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._) `${it.evaluated}.items`, (0, codegen_1._) `undefined`));
}
function funcSourceUrl(schema, opts) {
    const schId = typeof schema == "object" && schema[opts.schemaId];
    return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._) `/*# sourceURL=${schId} */` : codegen_1.nil;
}
// schema compilation - this function is used recursively to generate code for sub-schemas
function subschemaCode(it, valid) {
    if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
            subSchemaObjCode(it, valid);
            return;
        }
    }
    (0, boolSchema_1.boolOrEmptySchema)(it, valid);
}
function schemaCxtHasRules({ schema, self }) {
    if (typeof schema == "boolean")
        return !schema;
    for (const key in schema)
        if (self.RULES.all[key])
            return true;
    return false;
}
function isSchemaObj(it) {
    return typeof it.schema != "boolean";
}
function subSchemaObjCode(it, valid) {
    const { schema, gen, opts } = it;
    if (opts.$comment && schema.$comment)
        commentKeyword(it);
    updateContext(it);
    checkAsyncSchema(it);
    const errsCount = gen.const("_errs", names_1.default.errors);
    typeAndKeywords(it, errsCount);
    // TODO var
    gen.var(valid, (0, codegen_1._) `${errsCount} === ${names_1.default.errors}`);
}
function checkKeywords(it) {
    (0, util_1.checkUnknownRules)(it);
    checkRefsAndKeywords(it);
}
function typeAndKeywords(it, errsCount) {
    if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
    const types = (0, dataType_1.getSchemaTypes)(it.schema);
    const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
    schemaKeywords(it, types, !checkedTypes, errsCount);
}
function checkRefsAndKeywords(it) {
    const { schema, errSchemaPath, opts, self } = it;
    if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES)) {
        self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
    }
}
function checkNoDefault(it) {
    const { schema, opts } = it;
    if (schema.default !== undefined && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
    }
}
function updateContext(it) {
    const schId = it.schema[it.opts.schemaId];
    if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
}
function checkAsyncSchema(it) {
    if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
}
function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
    const msg = schema.$comment;
    if (opts.$comment === true) {
        gen.code((0, codegen_1._) `${names_1.default.self}.logger.log(${msg})`);
    }
    else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str) `${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._) `${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
    }
}
function returnResults(it) {
    const { gen, schemaEnv, validateName, ValidationError, opts } = it;
    if (schemaEnv.$async) {
        // TODO assign unevaluated
        gen.if((0, codegen_1._) `${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._) `new ${ValidationError}(${names_1.default.vErrors})`));
    }
    else {
        gen.assign((0, codegen_1._) `${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
            assignEvaluated(it);
        gen.return((0, codegen_1._) `${names_1.default.errors} === 0`);
    }
}
function assignEvaluated({ gen, evaluated, props, items }) {
    if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._) `${evaluated}.props`, props);
    if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._) `${evaluated}.items`, items);
}
function schemaKeywords(it, types, typeErrors, errsCount) {
    const { gen, schema, data, allErrors, opts, self } = it;
    const { RULES } = self;
    if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition)); // TODO typecast
        return;
    }
    if (!opts.jtd)
        checkStrictTypes(it, types);
    gen.block(() => {
        for (const group of RULES.rules)
            groupKeywords(group);
        groupKeywords(RULES.post);
    });
    function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema, group))
            return;
        if (group.type) {
            gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
            iterateKeywords(it, group);
            if (types.length === 1 && types[0] === group.type && typeErrors) {
                gen.else();
                (0, dataType_2.reportTypeError)(it);
            }
            gen.endIf();
        }
        else {
            iterateKeywords(it, group);
        }
        // TODO make it "ok" call?
        if (!allErrors)
            gen.if((0, codegen_1._) `${names_1.default.errors} === ${errsCount || 0}`);
    }
}
function iterateKeywords(it, group) {
    const { gen, schema, opts: { useDefaults }, } = it;
    if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
    gen.block(() => {
        for (const rule of group.rules) {
            if ((0, applicability_1.shouldUseRule)(schema, rule)) {
                keywordCode(it, rule.keyword, rule.definition, group.type);
            }
        }
    });
}
function checkStrictTypes(it, types) {
    if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
    checkContextTypes(it, types);
    if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
    checkKeywordTypes(it, it.dataTypes);
}
function checkContextTypes(it, types) {
    if (!types.length)
        return;
    if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
    }
    types.forEach((t) => {
        if (!includesType(it.dataTypes, t)) {
            strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
    });
    narrowSchemaTypes(it, types);
}
function checkMultipleTypes(it, ts) {
    if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
    }
}
function checkKeywordTypes(it, ts) {
    const rules = it.self.RULES.all;
    for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
            const { type } = rule.definition;
            if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
                strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
            }
        }
    }
}
function hasApplicableType(schTs, kwdT) {
    return schTs.includes(kwdT) || (kwdT === "number" && schTs.includes("integer"));
}
function includesType(ts, t) {
    return ts.includes(t) || (t === "integer" && ts.includes("number"));
}
function narrowSchemaTypes(it, withTypes) {
    const ts = [];
    for (const t of it.dataTypes) {
        if (includesType(withTypes, t))
            ts.push(t);
        else if (withTypes.includes("integer") && t === "number")
            ts.push("integer");
    }
    it.dataTypes = ts;
}
function strictTypesError(it, msg) {
    const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
    msg += ` at "${schemaPath}" (strictTypes)`;
    (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
}
class KeywordCxt {
    constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
            this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        }
        else {
            this.schemaCode = this.schemaValue;
            if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
                throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
            }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
            this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
    }
    result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
    }
    failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
            failAction();
        else
            this.error();
        if (successAction) {
            this.gen.else();
            successAction();
            if (this.allErrors)
                this.gen.endIf();
        }
        else {
            if (this.allErrors)
                this.gen.endIf();
            else
                this.gen.else();
        }
    }
    pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), undefined, failAction);
    }
    fail(condition) {
        if (condition === undefined) {
            this.error();
            if (!this.allErrors)
                this.gen.if(false); // this branch will be removed by gen.optimize
            return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
            this.gen.endIf();
        else
            this.gen.else();
    }
    fail$data(condition) {
        if (!this.$data)
            return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._) `${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
    }
    error(append, errorParams, errorPaths) {
        if (errorParams) {
            this.setParams(errorParams);
            this._error(append, errorPaths);
            this.setParams({});
            return;
        }
        this._error(append, errorPaths);
    }
    _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
    }
    $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
    }
    reset() {
        if (this.errsCount === undefined)
            throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
    }
    ok(cond) {
        if (!this.allErrors)
            this.gen.if(cond);
    }
    setParams(obj, assign) {
        if (assign)
            Object.assign(this.params, obj);
        else
            this.params = obj;
    }
    block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
            this.check$data(valid, $dataValid);
            codeBlock();
        });
    }
    check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
            return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._) `${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
            gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
            gen.elseIf(this.invalid$data());
            this.$dataError();
            if (valid !== codegen_1.nil)
                gen.assign(valid, false);
        }
        gen.else();
    }
    invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
            if (schemaType.length) {
                /* istanbul ignore if */
                if (!(schemaCode instanceof codegen_1.Name))
                    throw new Error("ajv implementation error");
                const st = Array.isArray(schemaType) ? schemaType : [schemaType];
                return (0, codegen_1._) `${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
            }
            return codegen_1.nil;
        }
        function invalid$DataSchema() {
            if (def.validateSchema) {
                const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema }); // TODO value.code for standalone
                return (0, codegen_1._) `!${validateSchemaRef}(${schemaCode})`;
            }
            return codegen_1.nil;
        }
    }
    subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: undefined, props: undefined };
        subschemaCode(nextContext, valid);
        return nextContext;
    }
    mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
            return;
        if (it.props !== true && schemaCxt.props !== undefined) {
            it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== undefined) {
            it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
    }
    mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
            gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
            return true;
        }
    }
}
exports.KeywordCxt = KeywordCxt;
function keywordCode(it, keyword, def, ruleType) {
    const cxt = new KeywordCxt(it, def, keyword);
    if ("code" in def) {
        def.code(cxt, ruleType);
    }
    else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
    }
    else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
    }
    else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
    }
}
const JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
const RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
function getData($data, { dataLevel, dataNames, dataPathArr }) {
    let jsonPointer;
    let data;
    if ($data === "")
        return names_1.default.rootData;
    if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
            throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
    }
    else {
        const matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
            throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches[1];
        jsonPointer = matches[2];
        if (jsonPointer === "#") {
            if (up >= dataLevel)
                throw new Error(errorMsg("property/index", up));
            return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
            throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
            return data;
    }
    let expr = data;
    const segments = jsonPointer.split("/");
    for (const segment of segments) {
        if (segment) {
            data = (0, codegen_1._) `${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
            expr = (0, codegen_1._) `${expr} && ${data}`;
        }
    }
    return expr;
    function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
    }
}
exports.getData = getData;

},{"../codegen":13,"../errors":15,"../names":17,"../resolve":19,"../util":21,"./applicability":22,"./boolSchema":23,"./dataType":24,"./defaults":25,"./keyword":27,"./subschema":28}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
const codegen_1 = require("../codegen");
const names_1 = require("../names");
const code_1 = require("../../vocabularies/code");
const errors_1 = require("../errors");
function macroKeywordCode(cxt, def) {
    const { gen, keyword, schema, parentSchema, it } = cxt;
    const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
    const schemaRef = useKeyword(gen, keyword, macroSchema);
    if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
    const valid = gen.name("valid");
    cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true,
    }, valid);
    cxt.pass(valid, () => cxt.error(true));
}
exports.macroKeywordCode = macroKeywordCode;
function funcKeywordCode(cxt, def) {
    var _a;
    const { gen, keyword, schema, parentSchema, $data, it } = cxt;
    checkAsyncKeyword(it, def);
    const validate = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate;
    const validateRef = useKeyword(gen, keyword, validate);
    const valid = gen.let("valid");
    cxt.block$data(valid, validateKeyword);
    cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
    function validateKeyword() {
        if (def.errors === false) {
            assignValid();
            if (def.modifying)
                modifyData(cxt);
            reportErrs(() => cxt.error());
        }
        else {
            const ruleErrs = def.async ? validateAsync() : validateSync();
            if (def.modifying)
                modifyData(cxt);
            reportErrs(() => addErrs(cxt, ruleErrs));
        }
    }
    function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._) `await `), (e) => gen.assign(valid, false).if((0, codegen_1._) `${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._) `${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
    }
    function validateSync() {
        const validateErrs = (0, codegen_1._) `${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
    }
    function assignValid(_await = def.async ? (0, codegen_1._) `await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !(("compile" in def && !$data) || def.schema === false);
        gen.assign(valid, (0, codegen_1._) `${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
    }
    function reportErrs(errors) {
        var _a;
        gen.if((0, codegen_1.not)((_a = def.valid) !== null && _a !== void 0 ? _a : valid), errors);
    }
}
exports.funcKeywordCode = funcKeywordCode;
function modifyData(cxt) {
    const { gen, data, it } = cxt;
    gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._) `${it.parentData}[${it.parentDataProperty}]`));
}
function addErrs(cxt, errs) {
    const { gen } = cxt;
    gen.if((0, codegen_1._) `Array.isArray(${errs})`, () => {
        gen
            .assign(names_1.default.vErrors, (0, codegen_1._) `${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`)
            .assign(names_1.default.errors, (0, codegen_1._) `${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
    }, () => cxt.error());
}
function checkAsyncKeyword({ schemaEnv }, def) {
    if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
}
function useKeyword(gen, keyword, result) {
    if (result === undefined)
        throw new Error(`keyword "${keyword}" failed to compile`);
    return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
}
function validSchemaType(schema, schemaType, allowUndefined = false) {
    // TODO add tests
    return (!schemaType.length ||
        schemaType.some((st) => st === "array"
            ? Array.isArray(schema)
            : st === "object"
                ? schema && typeof schema == "object" && !Array.isArray(schema)
                : typeof schema == st || (allowUndefined && typeof schema == "undefined")));
}
exports.validSchemaType = validSchemaType;
function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
    /* istanbul ignore if */
    if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
    }
    const deps = def.dependencies;
    if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
    }
    if (def.validateSchema) {
        const valid = def.validateSchema(schema[keyword]);
        if (!valid) {
            const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` +
                self.errorsText(def.validateSchema.errors);
            if (opts.validateSchema === "log")
                self.logger.error(msg);
            else
                throw new Error(msg);
        }
    }
}
exports.validateKeywordUsage = validateKeywordUsage;

},{"../../vocabularies/code":53,"../codegen":13,"../errors":15,"../names":17}],28:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
const codegen_1 = require("../codegen");
const util_1 = require("../util");
function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
    if (keyword !== undefined && schema !== undefined) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
    }
    if (keyword !== undefined) {
        const sch = it.schema[keyword];
        return schemaProp === undefined
            ? {
                schema: sch,
                schemaPath: (0, codegen_1._) `${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
                errSchemaPath: `${it.errSchemaPath}/${keyword}`,
            }
            : {
                schema: sch[schemaProp],
                schemaPath: (0, codegen_1._) `${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
                errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`,
            };
    }
    if (schema !== undefined) {
        if (schemaPath === undefined || errSchemaPath === undefined || topSchemaRef === undefined) {
            throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
            schema,
            schemaPath,
            topSchemaRef,
            errSchemaPath,
        };
    }
    throw new Error('either "keyword" or "schema" must be passed');
}
exports.getSubschema = getSubschema;
function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
    if (data !== undefined && dataProp !== undefined) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
    }
    const { gen } = it;
    if (dataProp !== undefined) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._) `${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str) `${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._) `${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
    }
    if (data !== undefined) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true); // replaceable if used once?
        dataContextProps(nextData);
        if (propertyName !== undefined)
            subschema.propertyName = propertyName;
        // TODO something is possibly wrong here with not changing parentDataProperty and not appending dataPathArr
    }
    if (dataTypes)
        subschema.dataTypes = dataTypes;
    function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
    }
}
exports.extendSubschemaData = extendSubschemaData;
function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
    if (compositeRule !== undefined)
        subschema.compositeRule = compositeRule;
    if (createErrors !== undefined)
        subschema.createErrors = createErrors;
    if (allErrors !== undefined)
        subschema.allErrors = allErrors;
    subschema.jtdDiscriminator = jtdDiscriminator; // not inherited
    subschema.jtdMetadata = jtdMetadata; // not inherited
}
exports.extendSubschemaMode = extendSubschemaMode;

},{"../codegen":13,"../util":21}],29:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
var validate_1 = require("./compile/validate");
Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function () { return validate_1.KeywordCxt; } });
var codegen_1 = require("./compile/codegen");
Object.defineProperty(exports, "_", { enumerable: true, get: function () { return codegen_1._; } });
Object.defineProperty(exports, "str", { enumerable: true, get: function () { return codegen_1.str; } });
Object.defineProperty(exports, "stringify", { enumerable: true, get: function () { return codegen_1.stringify; } });
Object.defineProperty(exports, "nil", { enumerable: true, get: function () { return codegen_1.nil; } });
Object.defineProperty(exports, "Name", { enumerable: true, get: function () { return codegen_1.Name; } });
Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function () { return codegen_1.CodeGen; } });
const validation_error_1 = require("./runtime/validation_error");
const ref_error_1 = require("./compile/ref_error");
const rules_1 = require("./compile/rules");
const compile_1 = require("./compile");
const codegen_2 = require("./compile/codegen");
const resolve_1 = require("./compile/resolve");
const dataType_1 = require("./compile/validate/dataType");
const util_1 = require("./compile/util");
const $dataRefSchema = require("./refs/data.json");
const uri_1 = require("./runtime/uri");
const defaultRegExp = (str, flags) => new RegExp(str, flags);
defaultRegExp.code = "new RegExp";
const META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
const EXT_SCOPE_NAMES = new Set([
    "validate",
    "serialize",
    "parse",
    "wrapper",
    "root",
    "schema",
    "keyword",
    "pattern",
    "formats",
    "validate$data",
    "func",
    "obj",
    "Error",
]);
const removedOptions = {
    errorDataPath: "",
    format: "`validateFormats: false` can be used instead.",
    nullable: '"nullable" keyword is supported by default.',
    jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
    extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
    missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
    processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
    sourceCode: "Use option `code: {source: true}`",
    strictDefaults: "It is default now, see option `strict`.",
    strictKeywords: "It is default now, see option `strict`.",
    uniqueItems: '"uniqueItems" keyword is always validated.',
    unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
    cache: "Map is used as cache, schema object as key.",
    serialize: "Map is used as cache, schema object as key.",
    ajvErrors: "It is default now.",
};
const deprecatedOptions = {
    ignoreKeywordsWithRef: "",
    jsPropertySyntax: "",
    unicode: '"minLength"/"maxLength" account for unicode characters by default.',
};
const MAX_EXPRESSION = 200;
// eslint-disable-next-line complexity
function requiredOptions(o) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
    const s = o.strict;
    const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
    const optimize = _optz === true || _optz === undefined ? 1 : _optz || 0;
    const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
    const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
    return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver: uriResolver,
    };
}
class Ajv {
    constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = {};
        this._compilations = new Set();
        this._loading = {};
        this._cache = new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
            addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
            addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
            this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
    }
    _addVocabularies() {
        this.addKeyword("$async");
    }
    _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
            _dataRefSchema = { ...$dataRefSchema };
            _dataRefSchema.id = _dataRefSchema.$id;
            delete _dataRefSchema.$id;
        }
        if (meta && $data)
            this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
    }
    defaultMeta() {
        const { meta, schemaId } = this.opts;
        return (this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : undefined);
    }
    validate(schemaKeyRef, // key, ref or schema object
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    data // to be validated
    ) {
        let v;
        if (typeof schemaKeyRef == "string") {
            v = this.getSchema(schemaKeyRef);
            if (!v)
                throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        }
        else {
            v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
            this.errors = v.errors;
        return valid;
    }
    compile(schema, _meta) {
        const sch = this._addSchema(schema, _meta);
        return (sch.validate || this._compileSchemaEnv(sch));
    }
    compileAsync(schema, meta) {
        if (typeof this.opts.loadSchema != "function") {
            throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema, meta);
        async function runCompileAsync(_schema, _meta) {
            await loadMetaSchema.call(this, _schema.$schema);
            const sch = this._addSchema(_schema, _meta);
            return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
            if ($ref && !this.getSchema($ref)) {
                await runCompileAsync.call(this, { $ref }, true);
            }
        }
        async function _compileAsync(sch) {
            try {
                return this._compileSchemaEnv(sch);
            }
            catch (e) {
                if (!(e instanceof ref_error_1.default))
                    throw e;
                checkLoaded.call(this, e);
                await loadMissingSchema.call(this, e.missingSchema);
                return _compileAsync.call(this, sch);
            }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
            if (this.refs[ref]) {
                throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
            }
        }
        async function loadMissingSchema(ref) {
            const _schema = await _loadSchema.call(this, ref);
            if (!this.refs[ref])
                await loadMetaSchema.call(this, _schema.$schema);
            if (!this.refs[ref])
                this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
            const p = this._loading[ref];
            if (p)
                return p;
            try {
                return await (this._loading[ref] = loadSchema(ref));
            }
            finally {
                delete this._loading[ref];
            }
        }
    }
    // Adds schema to the instance
    addSchema(schema, // If array is passed, `key` will be ignored
    key, // Optional schema key. Can be passed to `validate` method instead of schema object or id/ref. One schema per instance can have empty `id` and `key`.
    _meta, // true if schema is a meta-schema. Used internally, addMetaSchema should be used instead.
    _validateSchema = this.opts.validateSchema // false to skip schema validation. Used internally, option validateSchema should be used instead.
    ) {
        if (Array.isArray(schema)) {
            for (const sch of schema)
                this.addSchema(sch, undefined, _meta, _validateSchema);
            return this;
        }
        let id;
        if (typeof schema === "object") {
            const { schemaId } = this.opts;
            id = schema[schemaId];
            if (id !== undefined && typeof id != "string") {
                throw new Error(`schema ${schemaId} must be string`);
            }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
        return this;
    }
    // Add schema that will be used to validate other schemas
    // options in META_IGNORE_OPTIONS are alway set to false
    addMetaSchema(schema, key, // schema key
    _validateSchema = this.opts.validateSchema // false to skip schema validation, can be used to override validateSchema option for meta-schema
    ) {
        this.addSchema(schema, key, true, _validateSchema);
        return this;
    }
    //  Validate schema against its meta-schema
    validateSchema(schema, throwOrLogError) {
        if (typeof schema == "boolean")
            return true;
        let $schema;
        $schema = schema.$schema;
        if ($schema !== undefined && typeof $schema != "string") {
            throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
            this.logger.warn("meta-schema not available");
            this.errors = null;
            return true;
        }
        const valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
            const message = "schema is invalid: " + this.errorsText();
            if (this.opts.validateSchema === "log")
                this.logger.error(message);
            else
                throw new Error(message);
        }
        return valid;
    }
    // Get compiled schema by `key` or `ref`.
    // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
    getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
            keyRef = sch;
        if (sch === undefined) {
            const { schemaId } = this.opts;
            const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
            sch = compile_1.resolveSchema.call(this, root, keyRef);
            if (!sch)
                return;
            this.refs[keyRef] = sch;
        }
        return (sch.validate || this._compileSchemaEnv(sch));
    }
    // Remove cached schema(s).
    // If no parameter is passed all schemas but meta-schemas are removed.
    // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
    // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
    removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
            this._removeAllSchemas(this.schemas, schemaKeyRef);
            this._removeAllSchemas(this.refs, schemaKeyRef);
            return this;
        }
        switch (typeof schemaKeyRef) {
            case "undefined":
                this._removeAllSchemas(this.schemas);
                this._removeAllSchemas(this.refs);
                this._cache.clear();
                return this;
            case "string": {
                const sch = getSchEnv.call(this, schemaKeyRef);
                if (typeof sch == "object")
                    this._cache.delete(sch.schema);
                delete this.schemas[schemaKeyRef];
                delete this.refs[schemaKeyRef];
                return this;
            }
            case "object": {
                const cacheKey = schemaKeyRef;
                this._cache.delete(cacheKey);
                let id = schemaKeyRef[this.opts.schemaId];
                if (id) {
                    id = (0, resolve_1.normalizeId)(id);
                    delete this.schemas[id];
                    delete this.refs[id];
                }
                return this;
            }
            default:
                throw new Error("ajv.removeSchema: invalid parameter");
        }
    }
    // add "vocabulary" - a collection of keywords
    addVocabulary(definitions) {
        for (const def of definitions)
            this.addKeyword(def);
        return this;
    }
    addKeyword(kwdOrDef, def // deprecated
    ) {
        let keyword;
        if (typeof kwdOrDef == "string") {
            keyword = kwdOrDef;
            if (typeof def == "object") {
                this.logger.warn("these parameters are deprecated, see docs for addKeyword");
                def.keyword = keyword;
            }
        }
        else if (typeof kwdOrDef == "object" && def === undefined) {
            def = kwdOrDef;
            keyword = def.keyword;
            if (Array.isArray(keyword) && !keyword.length) {
                throw new Error("addKeywords: keyword must be string or non-empty array");
            }
        }
        else {
            throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
            (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
            return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
            ...def,
            type: (0, dataType_1.getJSONTypes)(def.type),
            schemaType: (0, dataType_1.getJSONTypes)(def.schemaType),
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0
            ? (k) => addRule.call(this, k, definition)
            : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
        return this;
    }
    getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
    }
    // Remove keyword
    removeKeyword(keyword) {
        // TODO return type should be Ajv
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
            const i = group.rules.findIndex((rule) => rule.keyword === keyword);
            if (i >= 0)
                group.rules.splice(i, 1);
        }
        return this;
    }
    // Add format
    addFormat(name, format) {
        if (typeof format == "string")
            format = new RegExp(format);
        this.formats[name] = format;
        return this;
    }
    errorsText(errors = this.errors, // optional array of validation errors
    { separator = ", ", dataVar = "data" } = {} // optional options with properties `separator` and `dataVar`
    ) {
        if (!errors || errors.length === 0)
            return "No errors";
        return errors
            .map((e) => `${dataVar}${e.instancePath} ${e.message}`)
            .reduce((text, msg) => text + separator + msg);
    }
    $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
            const segments = jsonPointer.split("/").slice(1); // first segment is an empty string
            let keywords = metaSchema;
            for (const seg of segments)
                keywords = keywords[seg];
            for (const key in rules) {
                const rule = rules[key];
                if (typeof rule != "object")
                    continue;
                const { $data } = rule.definition;
                const schema = keywords[key];
                if ($data && schema)
                    keywords[key] = schemaOrData(schema);
            }
        }
        return metaSchema;
    }
    _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
            const sch = schemas[keyRef];
            if (!regex || regex.test(keyRef)) {
                if (typeof sch == "string") {
                    delete schemas[keyRef];
                }
                else if (sch && !sch.meta) {
                    this._cache.delete(sch.schema);
                    delete schemas[keyRef];
                }
            }
        }
    }
    _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema == "object") {
            id = schema[schemaId];
        }
        else {
            if (this.opts.jtd)
                throw new Error("schema must be object");
            else if (typeof schema != "boolean")
                throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema);
        if (sch !== undefined)
            return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
        sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
            // TODO atm it is allowed to overwrite schemas without id (instead of not adding them)
            if (baseId)
                this._checkUnique(baseId);
            this.refs[baseId] = sch;
        }
        if (validateSchema)
            this.validateSchema(schema, true);
        return sch;
    }
    _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
            throw new Error(`schema with key or id "${id}" already exists`);
        }
    }
    _compileSchemaEnv(sch) {
        if (sch.meta)
            this._compileMetaSchema(sch);
        else
            compile_1.compileSchema.call(this, sch);
        /* istanbul ignore if */
        if (!sch.validate)
            throw new Error("ajv implementation error");
        return sch.validate;
    }
    _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
            compile_1.compileSchema.call(this, sch);
        }
        finally {
            this.opts = currentOpts;
        }
    }
}
Ajv.ValidationError = validation_error_1.default;
Ajv.MissingRefError = ref_error_1.default;
exports.default = Ajv;
function checkOptions(checkOpts, options, msg, log = "error") {
    for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
            this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
    }
}
function getSchEnv(keyRef) {
    keyRef = (0, resolve_1.normalizeId)(keyRef); // TODO tests fail without this line
    return this.schemas[keyRef] || this.refs[keyRef];
}
function addInitialSchemas() {
    const optsSchemas = this.opts.schemas;
    if (!optsSchemas)
        return;
    if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
    else
        for (const key in optsSchemas)
            this.addSchema(optsSchemas[key], key);
}
function addInitialFormats() {
    for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
            this.addFormat(name, format);
    }
}
function addInitialKeywords(defs) {
    if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
    }
    this.logger.warn("keywords option as map is deprecated, pass array");
    for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
            def.keyword = keyword;
        this.addKeyword(def);
    }
}
function getMetaSchemaOptions() {
    const metaOpts = { ...this.opts };
    for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
    return metaOpts;
}
const noLogs = { log() { }, warn() { }, error() { } };
function getLogger(logger) {
    if (logger === false)
        return noLogs;
    if (logger === undefined)
        return console;
    if (logger.log && logger.warn && logger.error)
        return logger;
    throw new Error("logger must implement log, warn and error methods");
}
const KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
function checkKeyword(keyword, def) {
    const { RULES } = this;
    (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
            throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
            throw new Error(`Keyword ${kwd} has invalid name`);
    });
    if (!def)
        return;
    if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
    }
}
function addRule(keyword, definition, dataType) {
    var _a;
    const post = definition === null || definition === void 0 ? void 0 : definition.post;
    if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
    const { RULES } = this;
    let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
    if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
    }
    RULES.keywords[keyword] = true;
    if (!definition)
        return;
    const rule = {
        keyword,
        definition: {
            ...definition,
            type: (0, dataType_1.getJSONTypes)(definition.type),
            schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType),
        },
    };
    if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
    else
        ruleGroup.rules.push(rule);
    RULES.all[keyword] = rule;
    (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
}
function addBeforeRule(ruleGroup, rule, before) {
    const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
    if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
    }
    else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
    }
}
function keywordMetaschema(def) {
    let { metaSchema } = def;
    if (metaSchema === undefined)
        return;
    if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
    def.validateSchema = this.compile(metaSchema, true);
}
const $dataRef = {
    $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
};
function schemaOrData(schema) {
    return { anyOf: [schema, $dataRef] };
}

},{"./compile":16,"./compile/codegen":13,"./compile/ref_error":18,"./compile/resolve":19,"./compile/rules":20,"./compile/util":21,"./compile/validate":26,"./compile/validate/dataType":24,"./refs/data.json":30,"./runtime/uri":34,"./runtime/validation_error":35}],30:[function(require,module,exports){
module.exports={
  "$id": "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
  "description": "Meta-schema for $data reference (JSON AnySchema extension proposal)",
  "type": "object",
  "required": ["$data"],
  "properties": {
    "$data": {
      "type": "string",
      "anyOf": [{"format": "relative-json-pointer"}, {"format": "json-pointer"}]
    }
  },
  "additionalProperties": false
}

},{}],31:[function(require,module,exports){
module.exports={
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "http://json-schema.org/draft-07/schema#",
  "title": "Core schema meta-schema",
  "definitions": {
    "schemaArray": {
      "type": "array",
      "minItems": 1,
      "items": {"$ref": "#"}
    },
    "nonNegativeInteger": {
      "type": "integer",
      "minimum": 0
    },
    "nonNegativeIntegerDefault0": {
      "allOf": [{"$ref": "#/definitions/nonNegativeInteger"}, {"default": 0}]
    },
    "simpleTypes": {
      "enum": ["array", "boolean", "integer", "null", "number", "object", "string"]
    },
    "stringArray": {
      "type": "array",
      "items": {"type": "string"},
      "uniqueItems": true,
      "default": []
    }
  },
  "type": ["object", "boolean"],
  "properties": {
    "$id": {
      "type": "string",
      "format": "uri-reference"
    },
    "$schema": {
      "type": "string",
      "format": "uri"
    },
    "$ref": {
      "type": "string",
      "format": "uri-reference"
    },
    "$comment": {
      "type": "string"
    },
    "title": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "default": true,
    "readOnly": {
      "type": "boolean",
      "default": false
    },
    "examples": {
      "type": "array",
      "items": true
    },
    "multipleOf": {
      "type": "number",
      "exclusiveMinimum": 0
    },
    "maximum": {
      "type": "number"
    },
    "exclusiveMaximum": {
      "type": "number"
    },
    "minimum": {
      "type": "number"
    },
    "exclusiveMinimum": {
      "type": "number"
    },
    "maxLength": {"$ref": "#/definitions/nonNegativeInteger"},
    "minLength": {"$ref": "#/definitions/nonNegativeIntegerDefault0"},
    "pattern": {
      "type": "string",
      "format": "regex"
    },
    "additionalItems": {"$ref": "#"},
    "items": {
      "anyOf": [{"$ref": "#"}, {"$ref": "#/definitions/schemaArray"}],
      "default": true
    },
    "maxItems": {"$ref": "#/definitions/nonNegativeInteger"},
    "minItems": {"$ref": "#/definitions/nonNegativeIntegerDefault0"},
    "uniqueItems": {
      "type": "boolean",
      "default": false
    },
    "contains": {"$ref": "#"},
    "maxProperties": {"$ref": "#/definitions/nonNegativeInteger"},
    "minProperties": {"$ref": "#/definitions/nonNegativeIntegerDefault0"},
    "required": {"$ref": "#/definitions/stringArray"},
    "additionalProperties": {"$ref": "#"},
    "definitions": {
      "type": "object",
      "additionalProperties": {"$ref": "#"},
      "default": {}
    },
    "properties": {
      "type": "object",
      "additionalProperties": {"$ref": "#"},
      "default": {}
    },
    "patternProperties": {
      "type": "object",
      "additionalProperties": {"$ref": "#"},
      "propertyNames": {"format": "regex"},
      "default": {}
    },
    "dependencies": {
      "type": "object",
      "additionalProperties": {
        "anyOf": [{"$ref": "#"}, {"$ref": "#/definitions/stringArray"}]
      }
    },
    "propertyNames": {"$ref": "#"},
    "const": true,
    "enum": {
      "type": "array",
      "items": true,
      "minItems": 1,
      "uniqueItems": true
    },
    "type": {
      "anyOf": [
        {"$ref": "#/definitions/simpleTypes"},
        {
          "type": "array",
          "items": {"$ref": "#/definitions/simpleTypes"},
          "minItems": 1,
          "uniqueItems": true
        }
      ]
    },
    "format": {"type": "string"},
    "contentMediaType": {"type": "string"},
    "contentEncoding": {"type": "string"},
    "if": {"$ref": "#"},
    "then": {"$ref": "#"},
    "else": {"$ref": "#"},
    "allOf": {"$ref": "#/definitions/schemaArray"},
    "anyOf": {"$ref": "#/definitions/schemaArray"},
    "oneOf": {"$ref": "#/definitions/schemaArray"},
    "not": {"$ref": "#"}
  },
  "default": true
}

},{}],32:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// https://github.com/ajv-validator/ajv/issues/889
const equal = require("fast-deep-equal");
equal.code = 'require("ajv/dist/runtime/equal").default';
exports.default = equal;

},{"fast-deep-equal":79}],33:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// https://mathiasbynens.be/notes/javascript-encoding
// https://github.com/bestiejs/punycode.js - punycode.ucs2.decode
function ucs2length(str) {
    const len = str.length;
    let length = 0;
    let pos = 0;
    let value;
    while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 0xd800 && value <= 0xdbff && pos < len) {
            // high surrogate, and there is a next character
            value = str.charCodeAt(pos);
            if ((value & 0xfc00) === 0xdc00)
                pos++; // low surrogate
        }
    }
    return length;
}
exports.default = ucs2length;
ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';

},{}],34:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uri = require("fast-uri");
uri.code = 'require("ajv/dist/runtime/uri").default';
exports.default = uri;

},{"fast-uri":80}],35:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ValidationError extends Error {
    constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
    }
}
exports.default = ValidationError;

},{}],36:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAdditionalItems = void 0;
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const error = {
    message: ({ params: { len } }) => (0, codegen_1.str) `must NOT have more than ${len} items`,
    params: ({ params: { len } }) => (0, codegen_1._) `{limit: ${len}}`,
};
const def = {
    keyword: "additionalItems",
    type: "array",
    schemaType: ["boolean", "object"],
    before: "uniqueItems",
    error,
    code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
            (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
            return;
        }
        validateAdditionalItems(cxt, items);
    },
};
function validateAdditionalItems(cxt, items) {
    const { gen, schema, data, keyword, it } = cxt;
    it.items = true;
    const len = gen.const("len", (0, codegen_1._) `${data}.length`);
    if (schema === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._) `${len} <= ${items.length}`);
    }
    else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
        const valid = gen.var("valid", (0, codegen_1._) `${len} <= ${items.length}`); // TODO var
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
    }
    function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
            cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
            if (!it.allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
    }
}
exports.validateAdditionalItems = validateAdditionalItems;
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21}],37:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const code_1 = require("../code");
const codegen_1 = require("../../compile/codegen");
const names_1 = require("../../compile/names");
const util_1 = require("../../compile/util");
const error = {
    message: "must NOT have additional properties",
    params: ({ params }) => (0, codegen_1._) `{additionalProperty: ${params.additionalProperty}}`,
};
const def = {
    keyword: "additionalProperties",
    type: ["object"],
    schemaType: ["boolean", "object"],
    allowUndefined: true,
    trackErrors: true,
    error,
    code(cxt) {
        const { gen, schema, parentSchema, data, errsCount, it } = cxt;
        /* istanbul ignore if */
        if (!errsCount)
            throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
            return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._) `${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
            gen.forIn("key", data, (key) => {
                if (!props.length && !patProps.length)
                    additionalPropertyCode(key);
                else
                    gen.if(isAdditional(key), () => additionalPropertyCode(key));
            });
        }
        function isAdditional(key) {
            let definedProp;
            if (props.length > 8) {
                // TODO maybe an option instead of hard-coded 8?
                const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
                definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
            }
            else if (props.length) {
                definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._) `${key} === ${p}`));
            }
            else {
                definedProp = codegen_1.nil;
            }
            if (patProps.length) {
                definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._) `${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
            }
            return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
            gen.code((0, codegen_1._) `delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
            if (opts.removeAdditional === "all" || (opts.removeAdditional && schema === false)) {
                deleteAdditional(key);
                return;
            }
            if (schema === false) {
                cxt.setParams({ additionalProperty: key });
                cxt.error();
                if (!allErrors)
                    gen.break();
                return;
            }
            if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
                const valid = gen.name("valid");
                if (opts.removeAdditional === "failing") {
                    applyAdditionalSchema(key, valid, false);
                    gen.if((0, codegen_1.not)(valid), () => {
                        cxt.reset();
                        deleteAdditional(key);
                    });
                }
                else {
                    applyAdditionalSchema(key, valid);
                    if (!allErrors)
                        gen.if((0, codegen_1.not)(valid), () => gen.break());
                }
            }
        }
        function applyAdditionalSchema(key, valid, errors) {
            const subschema = {
                keyword: "additionalProperties",
                dataProp: key,
                dataPropType: util_1.Type.Str,
            };
            if (errors === false) {
                Object.assign(subschema, {
                    compositeRule: true,
                    createErrors: false,
                    allErrors: false,
                });
            }
            cxt.subschema(subschema, valid);
        }
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/names":17,"../../compile/util":21,"../code":53}],38:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../../compile/util");
const def = {
    keyword: "allOf",
    schemaType: "array",
    code(cxt) {
        const { gen, schema, it } = cxt;
        /* istanbul ignore if */
        if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema.forEach((sch, i) => {
            if ((0, util_1.alwaysValidSchema)(it, sch))
                return;
            const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
            cxt.ok(valid);
            cxt.mergeEvaluated(schCxt);
        });
    },
};
exports.default = def;

},{"../../compile/util":21}],39:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const code_1 = require("../code");
const def = {
    keyword: "anyOf",
    schemaType: "array",
    trackErrors: true,
    code: code_1.validateUnion,
    error: { message: "must match a schema in anyOf" },
};
exports.default = def;

},{"../code":53}],40:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const error = {
    message: ({ params: { min, max } }) => max === undefined
        ? (0, codegen_1.str) `must contain at least ${min} valid item(s)`
        : (0, codegen_1.str) `must contain at least ${min} and no more than ${max} valid item(s)`,
    params: ({ params: { min, max } }) => max === undefined ? (0, codegen_1._) `{minContains: ${min}}` : (0, codegen_1._) `{minContains: ${min}, maxContains: ${max}}`,
};
const def = {
    keyword: "contains",
    type: "array",
    schemaType: ["object", "boolean"],
    before: "uniqueItems",
    trackErrors: true,
    error,
    code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
            min = minContains === undefined ? 1 : minContains;
            max = maxContains;
        }
        else {
            min = 1;
        }
        const len = gen.const("len", (0, codegen_1._) `${data}.length`);
        cxt.setParams({ min, max });
        if (max === undefined && min === 0) {
            (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
            return;
        }
        if (max !== undefined && min > max) {
            (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
            cxt.fail();
            return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
            let cond = (0, codegen_1._) `${len} >= ${min}`;
            if (max !== undefined)
                cond = (0, codegen_1._) `${cond} && ${len} <= ${max}`;
            cxt.pass(cond);
            return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === undefined && min === 1) {
            validateItems(valid, () => gen.if(valid, () => gen.break()));
        }
        else if (min === 0) {
            gen.let(valid, true);
            if (max !== undefined)
                gen.if((0, codegen_1._) `${data}.length > 0`, validateItemsWithCount);
        }
        else {
            gen.let(valid, false);
            validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
            const schValid = gen.name("_valid");
            const count = gen.let("count", 0);
            validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
            gen.forRange("i", 0, len, (i) => {
                cxt.subschema({
                    keyword: "contains",
                    dataProp: i,
                    dataPropType: util_1.Type.Num,
                    compositeRule: true,
                }, _valid);
                block();
            });
        }
        function checkLimits(count) {
            gen.code((0, codegen_1._) `${count}++`);
            if (max === undefined) {
                gen.if((0, codegen_1._) `${count} >= ${min}`, () => gen.assign(valid, true).break());
            }
            else {
                gen.if((0, codegen_1._) `${count} > ${max}`, () => gen.assign(valid, false).break());
                if (min === 1)
                    gen.assign(valid, true);
                else
                    gen.if((0, codegen_1._) `${count} >= ${min}`, () => gen.assign(valid, true));
            }
        }
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21}],41:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const code_1 = require("../code");
exports.error = {
    message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str) `must have ${property_ies} ${deps} when property ${property} is present`;
    },
    params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._) `{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`, // TODO change to reference
};
const def = {
    keyword: "dependencies",
    type: "object",
    schemaType: "object",
    error: exports.error,
    code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
    },
};
function splitDependencies({ schema }) {
    const propertyDeps = {};
    const schemaDeps = {};
    for (const key in schema) {
        if (key === "__proto__")
            continue;
        const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema[key];
    }
    return [propertyDeps, schemaDeps];
}
function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
    const { gen, data, it } = cxt;
    if (Object.keys(propertyDeps).length === 0)
        return;
    const missing = gen.let("missing");
    for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
            continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
            property: prop,
            depsCount: deps.length,
            deps: deps.join(", "),
        });
        if (it.allErrors) {
            gen.if(hasProperty, () => {
                for (const depProp of deps) {
                    (0, code_1.checkReportMissingProp)(cxt, depProp);
                }
            });
        }
        else {
            gen.if((0, codegen_1._) `${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
        }
    }
}
exports.validatePropertyDeps = validatePropertyDeps;
function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
    const { gen, data, keyword, it } = cxt;
    const valid = gen.name("valid");
    for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
            continue;
        gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties), () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
        }, () => gen.var(valid, true) // TODO var
        );
        cxt.ok(valid);
    }
}
exports.validateSchemaDeps = validateSchemaDeps;
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21,"../code":53}],42:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const error = {
    message: ({ params }) => (0, codegen_1.str) `must match "${params.ifClause}" schema`,
    params: ({ params }) => (0, codegen_1._) `{failingKeyword: ${params.ifClause}}`,
};
const def = {
    keyword: "if",
    schemaType: ["object", "boolean"],
    trackErrors: true,
    error,
    code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === undefined && parentSchema.else === undefined) {
            (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
            return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
            const ifClause = gen.let("ifClause");
            cxt.setParams({ ifClause });
            gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        }
        else if (hasThen) {
            gen.if(schValid, validateClause("then"));
        }
        else {
            gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
            const schCxt = cxt.subschema({
                keyword: "if",
                compositeRule: true,
                createErrors: false,
                allErrors: false,
            }, schValid);
            cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
            return () => {
                const schCxt = cxt.subschema({ keyword }, schValid);
                gen.assign(valid, schValid);
                cxt.mergeValidEvaluated(schCxt, valid);
                if (ifClause)
                    gen.assign(ifClause, (0, codegen_1._) `${keyword}`);
                else
                    cxt.setParams({ ifClause: keyword });
            };
        }
    },
};
function hasSchema(it, keyword) {
    const schema = it.schema[keyword];
    return schema !== undefined && !(0, util_1.alwaysValidSchema)(it, schema);
}
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21}],43:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const additionalItems_1 = require("./additionalItems");
const prefixItems_1 = require("./prefixItems");
const items_1 = require("./items");
const items2020_1 = require("./items2020");
const contains_1 = require("./contains");
const dependencies_1 = require("./dependencies");
const propertyNames_1 = require("./propertyNames");
const additionalProperties_1 = require("./additionalProperties");
const properties_1 = require("./properties");
const patternProperties_1 = require("./patternProperties");
const not_1 = require("./not");
const anyOf_1 = require("./anyOf");
const oneOf_1 = require("./oneOf");
const allOf_1 = require("./allOf");
const if_1 = require("./if");
const thenElse_1 = require("./thenElse");
function getApplicator(draft2020 = false) {
    const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default,
    ];
    // array
    if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
    else
        applicator.push(additionalItems_1.default, items_1.default);
    applicator.push(contains_1.default);
    return applicator;
}
exports.default = getApplicator;

},{"./additionalItems":36,"./additionalProperties":37,"./allOf":38,"./anyOf":39,"./contains":40,"./dependencies":41,"./if":42,"./items":44,"./items2020":45,"./not":46,"./oneOf":47,"./patternProperties":48,"./prefixItems":49,"./properties":50,"./propertyNames":51,"./thenElse":52}],44:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTuple = void 0;
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const code_1 = require("../code");
const def = {
    keyword: "items",
    type: "array",
    schemaType: ["object", "array", "boolean"],
    before: "uniqueItems",
    code(cxt) {
        const { schema, it } = cxt;
        if (Array.isArray(schema))
            return validateTuple(cxt, "additionalItems", schema);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
            return;
        cxt.ok((0, code_1.validateArray)(cxt));
    },
};
function validateTuple(cxt, extraItems, schArr = cxt.schema) {
    const { gen, parentSchema, data, keyword, it } = cxt;
    checkStrictTuple(parentSchema);
    if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
    }
    const valid = gen.name("valid");
    const len = gen.const("len", (0, codegen_1._) `${data}.length`);
    schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
        gen.if((0, codegen_1._) `${len} > ${i}`, () => cxt.subschema({
            keyword,
            schemaProp: i,
            dataProp: i,
        }, valid));
        cxt.ok(valid);
    });
    function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
            const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
            (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
    }
}
exports.validateTuple = validateTuple;
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21,"../code":53}],45:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const code_1 = require("../code");
const additionalItems_1 = require("./additionalItems");
const error = {
    message: ({ params: { len } }) => (0, codegen_1.str) `must NOT have more than ${len} items`,
    params: ({ params: { len } }) => (0, codegen_1._) `{limit: ${len}}`,
};
const def = {
    keyword: "items",
    type: "array",
    schemaType: ["object", "boolean"],
    before: "uniqueItems",
    error,
    code(cxt) {
        const { schema, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
            return;
        if (prefixItems)
            (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
            cxt.ok((0, code_1.validateArray)(cxt));
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21,"../code":53,"./additionalItems":36}],46:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../../compile/util");
const def = {
    keyword: "not",
    schemaType: ["object", "boolean"],
    trackErrors: true,
    code(cxt) {
        const { gen, schema, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
            cxt.fail();
            return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
            keyword: "not",
            compositeRule: true,
            createErrors: false,
            allErrors: false,
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
    },
    error: { message: "must NOT be valid" },
};
exports.default = def;

},{"../../compile/util":21}],47:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const error = {
    message: "must match exactly one schema in oneOf",
    params: ({ params }) => (0, codegen_1._) `{passingSchemas: ${params.passing}}`,
};
const def = {
    keyword: "oneOf",
    schemaType: "array",
    trackErrors: true,
    error,
    code(cxt) {
        const { gen, schema, parentSchema, it } = cxt;
        /* istanbul ignore if */
        if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
            return;
        const schArr = schema;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        // TODO possibly fail straight away (with warning or exception) if there are two empty always valid schemas
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
            schArr.forEach((sch, i) => {
                let schCxt;
                if ((0, util_1.alwaysValidSchema)(it, sch)) {
                    gen.var(schValid, true);
                }
                else {
                    schCxt = cxt.subschema({
                        keyword: "oneOf",
                        schemaProp: i,
                        compositeRule: true,
                    }, schValid);
                }
                if (i > 0) {
                    gen
                        .if((0, codegen_1._) `${schValid} && ${valid}`)
                        .assign(valid, false)
                        .assign(passing, (0, codegen_1._) `[${passing}, ${i}]`)
                        .else();
                }
                gen.if(schValid, () => {
                    gen.assign(valid, true);
                    gen.assign(passing, i);
                    if (schCxt)
                        cxt.mergeEvaluated(schCxt, codegen_1.Name);
                });
            });
        }
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21}],48:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const code_1 = require("../code");
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const util_2 = require("../../compile/util");
const def = {
    keyword: "patternProperties",
    type: "object",
    schemaType: "object",
    code(cxt) {
        const { gen, schema, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
        if (patterns.length === 0 ||
            (alwaysValidPatterns.length === patterns.length &&
                (!it.opts.unevaluated || it.props === true))) {
            return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
            it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
            for (const pat of patterns) {
                if (checkProperties)
                    checkMatchingProperties(pat);
                if (it.allErrors) {
                    validateProperties(pat);
                }
                else {
                    gen.var(valid, true); // TODO var
                    validateProperties(pat);
                    gen.if(valid);
                }
            }
        }
        function checkMatchingProperties(pat) {
            for (const prop in checkProperties) {
                if (new RegExp(pat).test(prop)) {
                    (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
                }
            }
        }
        function validateProperties(pat) {
            gen.forIn("key", data, (key) => {
                gen.if((0, codegen_1._) `${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
                    const alwaysValid = alwaysValidPatterns.includes(pat);
                    if (!alwaysValid) {
                        cxt.subschema({
                            keyword: "patternProperties",
                            schemaProp: pat,
                            dataProp: key,
                            dataPropType: util_2.Type.Str,
                        }, valid);
                    }
                    if (it.opts.unevaluated && props !== true) {
                        gen.assign((0, codegen_1._) `${props}[${key}]`, true);
                    }
                    else if (!alwaysValid && !it.allErrors) {
                        // can short-circuit if `unevaluatedProperties` is not supported (opts.next === false)
                        // or if all properties were evaluated (props === true)
                        gen.if((0, codegen_1.not)(valid), () => gen.break());
                    }
                });
            });
        }
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21,"../code":53}],49:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const items_1 = require("./items");
const def = {
    keyword: "prefixItems",
    type: "array",
    schemaType: ["array"],
    before: "uniqueItems",
    code: (cxt) => (0, items_1.validateTuple)(cxt, "items"),
};
exports.default = def;

},{"./items":44}],50:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validate_1 = require("../../compile/validate");
const code_1 = require("../code");
const util_1 = require("../../compile/util");
const additionalProperties_1 = require("./additionalProperties");
const def = {
    keyword: "properties",
    type: "object",
    schemaType: "object",
    code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === undefined) {
            additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema);
        for (const prop of allProps) {
            it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
            it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
        if (properties.length === 0)
            return;
        const valid = gen.name("valid");
        for (const prop of properties) {
            if (hasDefault(prop)) {
                applyPropertySchema(prop);
            }
            else {
                gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
                applyPropertySchema(prop);
                if (!it.allErrors)
                    gen.else().var(valid, true);
                gen.endIf();
            }
            cxt.it.definedProperties.add(prop);
            cxt.ok(valid);
        }
        function hasDefault(prop) {
            return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== undefined;
        }
        function applyPropertySchema(prop) {
            cxt.subschema({
                keyword: "properties",
                schemaProp: prop,
                dataProp: prop,
            }, valid);
        }
    },
};
exports.default = def;

},{"../../compile/util":21,"../../compile/validate":26,"../code":53,"./additionalProperties":37}],51:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const error = {
    message: "property name must be valid",
    params: ({ params }) => (0, codegen_1._) `{propertyName: ${params.propertyName}}`,
};
const def = {
    keyword: "propertyNames",
    type: "object",
    schemaType: ["object", "boolean"],
    error,
    code(cxt) {
        const { gen, schema, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema))
            return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
            cxt.setParams({ propertyName: key });
            cxt.subschema({
                keyword: "propertyNames",
                data: key,
                dataTypes: ["string"],
                propertyName: key,
                compositeRule: true,
            }, valid);
            gen.if((0, codegen_1.not)(valid), () => {
                cxt.error(true);
                if (!it.allErrors)
                    gen.break();
            });
        });
        cxt.ok(valid);
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21}],52:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("../../compile/util");
const def = {
    keyword: ["then", "else"],
    schemaType: ["object", "boolean"],
    code({ keyword, parentSchema, it }) {
        if (parentSchema.if === undefined)
            (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
    },
};
exports.default = def;

},{"../../compile/util":21}],53:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
const codegen_1 = require("../compile/codegen");
const util_1 = require("../compile/util");
const names_1 = require("../compile/names");
const util_2 = require("../compile/util");
function checkReportMissingProp(cxt, prop) {
    const { gen, data, it } = cxt;
    gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._) `${prop}` }, true);
        cxt.error();
    });
}
exports.checkReportMissingProp = checkReportMissingProp;
function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
    return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._) `${missing} = ${prop}`)));
}
exports.checkMissingProp = checkMissingProp;
function reportMissingProp(cxt, missing) {
    cxt.setParams({ missingProperty: missing }, true);
    cxt.error();
}
exports.reportMissingProp = reportMissingProp;
function hasPropFunc(gen) {
    return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._) `Object.prototype.hasOwnProperty`,
    });
}
exports.hasPropFunc = hasPropFunc;
function isOwnProperty(gen, data, property) {
    return (0, codegen_1._) `${hasPropFunc(gen)}.call(${data}, ${property})`;
}
exports.isOwnProperty = isOwnProperty;
function propertyInData(gen, data, property, ownProperties) {
    const cond = (0, codegen_1._) `${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
    return ownProperties ? (0, codegen_1._) `${cond} && ${isOwnProperty(gen, data, property)}` : cond;
}
exports.propertyInData = propertyInData;
function noPropertyInData(gen, data, property, ownProperties) {
    const cond = (0, codegen_1._) `${data}${(0, codegen_1.getProperty)(property)} === undefined`;
    return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
}
exports.noPropertyInData = noPropertyInData;
function allSchemaProperties(schemaMap) {
    return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
}
exports.allSchemaProperties = allSchemaProperties;
function schemaProperties(it, schemaMap) {
    return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
}
exports.schemaProperties = schemaProperties;
function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
    const dataAndSchema = passSchema ? (0, codegen_1._) `${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
    const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData],
    ];
    if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
    const args = (0, codegen_1._) `${dataAndSchema}, ${gen.object(...valCxt)}`;
    return context !== codegen_1.nil ? (0, codegen_1._) `${func}.call(${context}, ${args})` : (0, codegen_1._) `${func}(${args})`;
}
exports.callValidateCode = callValidateCode;
const newRegExp = (0, codegen_1._) `new RegExp`;
function usePattern({ gen, it: { opts } }, pattern) {
    const u = opts.unicodeRegExp ? "u" : "";
    const { regExp } = opts.code;
    const rx = regExp(pattern, u);
    return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._) `${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`,
    });
}
exports.usePattern = usePattern;
function validateArray(cxt) {
    const { gen, data, keyword, it } = cxt;
    const valid = gen.name("valid");
    if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
    }
    gen.var(valid, true);
    validateItems(() => gen.break());
    return valid;
    function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._) `${data}.length`);
        gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
                keyword,
                dataProp: i,
                dataPropType: util_1.Type.Num,
            }, valid);
            gen.if((0, codegen_1.not)(valid), notValid);
        });
    }
}
exports.validateArray = validateArray;
function validateUnion(cxt) {
    const { gen, schema, keyword, it } = cxt;
    /* istanbul ignore if */
    if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
    const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
    if (alwaysValid && !it.opts.unevaluated)
        return;
    const valid = gen.let("valid", false);
    const schValid = gen.name("_valid");
    gen.block(() => schema.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
            keyword,
            schemaProp: i,
            compositeRule: true,
        }, schValid);
        gen.assign(valid, (0, codegen_1._) `${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        // can short-circuit if `unevaluatedProperties/Items` not supported (opts.unevaluated !== true)
        // or if all properties and items were evaluated (it.props === true && it.items === true)
        if (!merged)
            gen.if((0, codegen_1.not)(valid));
    }));
    cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
}
exports.validateUnion = validateUnion;

},{"../compile/codegen":13,"../compile/names":17,"../compile/util":21}],54:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const def = {
    keyword: "id",
    code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
    },
};
exports.default = def;

},{}],55:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const id_1 = require("./id");
const ref_1 = require("./ref");
const core = [
    "$schema",
    "$id",
    "$defs",
    "$vocabulary",
    { keyword: "$comment" },
    "definitions",
    id_1.default,
    ref_1.default,
];
exports.default = core;

},{"./id":54,"./ref":56}],56:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callRef = exports.getValidate = void 0;
const ref_error_1 = require("../../compile/ref_error");
const code_1 = require("../code");
const codegen_1 = require("../../compile/codegen");
const names_1 = require("../../compile/names");
const compile_1 = require("../../compile");
const util_1 = require("../../compile/util");
const def = {
    keyword: "$ref",
    schemaType: "string",
    code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
            return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
        if (schOrEnv === undefined)
            throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
            return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
            if (env === root)
                return callRef(cxt, validateName, env, env.$async);
            const rootName = gen.scopeValue("root", { ref: root });
            return callRef(cxt, (0, codegen_1._) `${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
            const v = getValidate(cxt, sch);
            callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
            const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
            const valid = gen.name("valid");
            const schCxt = cxt.subschema({
                schema: sch,
                dataTypes: [],
                schemaPath: codegen_1.nil,
                topSchemaRef: schName,
                errSchemaPath: $ref,
            }, valid);
            cxt.mergeEvaluated(schCxt);
            cxt.ok(valid);
        }
    },
};
function getValidate(cxt, sch) {
    const { gen } = cxt;
    return sch.validate
        ? gen.scopeValue("validate", { ref: sch.validate })
        : (0, codegen_1._) `${gen.scopeValue("wrapper", { ref: sch })}.validate`;
}
exports.getValidate = getValidate;
function callRef(cxt, v, sch, $async) {
    const { gen, it } = cxt;
    const { allErrors, schemaEnv: env, opts } = it;
    const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
    if ($async)
        callAsyncRef();
    else
        callSyncRef();
    function callAsyncRef() {
        if (!env.$async)
            throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
            gen.code((0, codegen_1._) `await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
            addEvaluatedFrom(v); // TODO will not work with async, it has to be returned with the result
            if (!allErrors)
                gen.assign(valid, true);
        }, (e) => {
            gen.if((0, codegen_1._) `!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
            addErrorsFrom(e);
            if (!allErrors)
                gen.assign(valid, false);
        });
        cxt.ok(valid);
    }
    function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
    }
    function addErrorsFrom(source) {
        const errs = (0, codegen_1._) `${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._) `${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`); // TODO tagged
        gen.assign(names_1.default.errors, (0, codegen_1._) `${names_1.default.vErrors}.length`);
    }
    function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
            return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        // TODO refactor
        if (it.props !== true) {
            if (schEvaluated && !schEvaluated.dynamicProps) {
                if (schEvaluated.props !== undefined) {
                    it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
                }
            }
            else {
                const props = gen.var("props", (0, codegen_1._) `${source}.evaluated.props`);
                it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
            }
        }
        if (it.items !== true) {
            if (schEvaluated && !schEvaluated.dynamicItems) {
                if (schEvaluated.items !== undefined) {
                    it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
                }
            }
            else {
                const items = gen.var("items", (0, codegen_1._) `${source}.evaluated.items`);
                it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
            }
        }
    }
}
exports.callRef = callRef;
exports.default = def;

},{"../../compile":16,"../../compile/codegen":13,"../../compile/names":17,"../../compile/ref_error":18,"../../compile/util":21,"../code":53}],57:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const types_1 = require("../discriminator/types");
const compile_1 = require("../../compile");
const ref_error_1 = require("../../compile/ref_error");
const util_1 = require("../../compile/util");
const error = {
    message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag
        ? `tag "${tagName}" must be string`
        : `value of tag "${tagName}" must be in oneOf`,
    params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._) `{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`,
};
const def = {
    keyword: "discriminator",
    type: "object",
    schemaType: "object",
    error,
    code(cxt) {
        const { gen, data, schema, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
            throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema.propertyName;
        if (typeof tagName != "string")
            throw new Error("discriminator: requires propertyName");
        if (schema.mapping)
            throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
            throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._) `${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._) `typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
            const mapping = getMapping();
            gen.if(false);
            for (const tagValue in mapping) {
                gen.elseIf((0, codegen_1._) `${tag} === ${tagValue}`);
                gen.assign(valid, applyTagSchema(mapping[tagValue]));
            }
            gen.else();
            cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
            gen.endIf();
        }
        function applyTagSchema(schemaProp) {
            const _valid = gen.name("valid");
            const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
            cxt.mergeEvaluated(schCxt, codegen_1.Name);
            return _valid;
        }
        function getMapping() {
            var _a;
            const oneOfMapping = {};
            const topRequired = hasRequired(parentSchema);
            let tagRequired = true;
            for (let i = 0; i < oneOf.length; i++) {
                let sch = oneOf[i];
                if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
                    const ref = sch.$ref;
                    sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
                    if (sch instanceof compile_1.SchemaEnv)
                        sch = sch.schema;
                    if (sch === undefined)
                        throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
                }
                const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
                if (typeof propSch != "object") {
                    throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
                }
                tagRequired = tagRequired && (topRequired || hasRequired(sch));
                addMappings(propSch, i);
            }
            if (!tagRequired)
                throw new Error(`discriminator: "${tagName}" must be required`);
            return oneOfMapping;
            function hasRequired({ required }) {
                return Array.isArray(required) && required.includes(tagName);
            }
            function addMappings(sch, i) {
                if (sch.const) {
                    addMapping(sch.const, i);
                }
                else if (sch.enum) {
                    for (const tagValue of sch.enum) {
                        addMapping(tagValue, i);
                    }
                }
                else {
                    throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
                }
            }
            function addMapping(tagValue, i) {
                if (typeof tagValue != "string" || tagValue in oneOfMapping) {
                    throw new Error(`discriminator: "${tagName}" values must be unique strings`);
                }
                oneOfMapping[tagValue] = i;
            }
        }
    },
};
exports.default = def;

},{"../../compile":16,"../../compile/codegen":13,"../../compile/ref_error":18,"../../compile/util":21,"../discriminator/types":58}],58:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscrError = void 0;
var DiscrError;
(function (DiscrError) {
    DiscrError["Tag"] = "tag";
    DiscrError["Mapping"] = "mapping";
})(DiscrError || (exports.DiscrError = DiscrError = {}));

},{}],59:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("./core");
const validation_1 = require("./validation");
const applicator_1 = require("./applicator");
const format_1 = require("./format");
const metadata_1 = require("./metadata");
const draft7Vocabularies = [
    core_1.default,
    validation_1.default,
    (0, applicator_1.default)(),
    format_1.default,
    metadata_1.metadataVocabulary,
    metadata_1.contentVocabulary,
];
exports.default = draft7Vocabularies;

},{"./applicator":43,"./core":55,"./format":61,"./metadata":62,"./validation":65}],60:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const error = {
    message: ({ schemaCode }) => (0, codegen_1.str) `must match format "${schemaCode}"`,
    params: ({ schemaCode }) => (0, codegen_1._) `{format: ${schemaCode}}`,
};
const def = {
    keyword: "format",
    type: ["number", "string"],
    schemaType: "string",
    $data: true,
    error,
    code(cxt, ruleType) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self } = it;
        if (!opts.validateFormats)
            return;
        if ($data)
            validate$DataFormat();
        else
            validateFormat();
        function validate$DataFormat() {
            const fmts = gen.scopeValue("formats", {
                ref: self.formats,
                code: opts.code.formats,
            });
            const fDef = gen.const("fDef", (0, codegen_1._) `${fmts}[${schemaCode}]`);
            const fType = gen.let("fType");
            const format = gen.let("format");
            // TODO simplify
            gen.if((0, codegen_1._) `typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._) `${fDef}.type || "string"`).assign(format, (0, codegen_1._) `${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._) `"string"`).assign(format, fDef));
            cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
            function unknownFmt() {
                if (opts.strictSchema === false)
                    return codegen_1.nil;
                return (0, codegen_1._) `${schemaCode} && !${format}`;
            }
            function invalidFmt() {
                const callFormat = schemaEnv.$async
                    ? (0, codegen_1._) `(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))`
                    : (0, codegen_1._) `${format}(${data})`;
                const validData = (0, codegen_1._) `(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
                return (0, codegen_1._) `${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
            }
        }
        function validateFormat() {
            const formatDef = self.formats[schema];
            if (!formatDef) {
                unknownFormat();
                return;
            }
            if (formatDef === true)
                return;
            const [fmtType, format, fmtRef] = getFormat(formatDef);
            if (fmtType === ruleType)
                cxt.pass(validCondition());
            function unknownFormat() {
                if (opts.strictSchema === false) {
                    self.logger.warn(unknownMsg());
                    return;
                }
                throw new Error(unknownMsg());
                function unknownMsg() {
                    return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
                }
            }
            function getFormat(fmtDef) {
                const code = fmtDef instanceof RegExp
                    ? (0, codegen_1.regexpCode)(fmtDef)
                    : opts.code.formats
                        ? (0, codegen_1._) `${opts.code.formats}${(0, codegen_1.getProperty)(schema)}`
                        : undefined;
                const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
                if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
                    return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._) `${fmt}.validate`];
                }
                return ["string", fmtDef, fmt];
            }
            function validCondition() {
                if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
                    if (!schemaEnv.$async)
                        throw new Error("async format in sync schema");
                    return (0, codegen_1._) `await ${fmtRef}(${data})`;
                }
                return typeof format == "function" ? (0, codegen_1._) `${fmtRef}(${data})` : (0, codegen_1._) `${fmtRef}.test(${data})`;
            }
        }
    },
};
exports.default = def;

},{"../../compile/codegen":13}],61:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const format_1 = require("./format");
const format = [format_1.default];
exports.default = format;

},{"./format":60}],62:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentVocabulary = exports.metadataVocabulary = void 0;
exports.metadataVocabulary = [
    "title",
    "description",
    "default",
    "deprecated",
    "readOnly",
    "writeOnly",
    "examples",
];
exports.contentVocabulary = [
    "contentMediaType",
    "contentEncoding",
    "contentSchema",
];

},{}],63:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const equal_1 = require("../../runtime/equal");
const error = {
    message: "must be equal to constant",
    params: ({ schemaCode }) => (0, codegen_1._) `{allowedValue: ${schemaCode}}`,
};
const def = {
    keyword: "const",
    $data: true,
    error,
    code(cxt) {
        const { gen, data, $data, schemaCode, schema } = cxt;
        if ($data || (schema && typeof schema == "object")) {
            cxt.fail$data((0, codegen_1._) `!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        }
        else {
            cxt.fail((0, codegen_1._) `${schema} !== ${data}`);
        }
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21,"../../runtime/equal":32}],64:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const equal_1 = require("../../runtime/equal");
const error = {
    message: "must be equal to one of the allowed values",
    params: ({ schemaCode }) => (0, codegen_1._) `{allowedValues: ${schemaCode}}`,
};
const def = {
    keyword: "enum",
    schemaType: "array",
    $data: true,
    error,
    code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        if (!$data && schema.length === 0)
            throw new Error("enum must have non-empty array");
        const useLoop = schema.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => (eql !== null && eql !== void 0 ? eql : (eql = (0, util_1.useFunc)(gen, equal_1.default)));
        let valid;
        if (useLoop || $data) {
            valid = gen.let("valid");
            cxt.block$data(valid, loopEnum);
        }
        else {
            /* istanbul ignore if */
            if (!Array.isArray(schema))
                throw new Error("ajv implementation error");
            const vSchema = gen.const("vSchema", schemaCode);
            valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
            gen.assign(valid, false);
            gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._) `${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
            const sch = schema[i];
            return typeof sch === "object" && sch !== null
                ? (0, codegen_1._) `${getEql()}(${data}, ${vSchema}[${i}])`
                : (0, codegen_1._) `${data} === ${sch}`;
        }
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21,"../../runtime/equal":32}],65:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const limitNumber_1 = require("./limitNumber");
const multipleOf_1 = require("./multipleOf");
const limitLength_1 = require("./limitLength");
const pattern_1 = require("./pattern");
const limitProperties_1 = require("./limitProperties");
const required_1 = require("./required");
const limitItems_1 = require("./limitItems");
const uniqueItems_1 = require("./uniqueItems");
const const_1 = require("./const");
const enum_1 = require("./enum");
const validation = [
    // number
    limitNumber_1.default,
    multipleOf_1.default,
    // string
    limitLength_1.default,
    pattern_1.default,
    // object
    limitProperties_1.default,
    required_1.default,
    // array
    limitItems_1.default,
    uniqueItems_1.default,
    // any
    { keyword: "type", schemaType: ["string", "array"] },
    { keyword: "nullable", schemaType: "boolean" },
    const_1.default,
    enum_1.default,
];
exports.default = validation;

},{"./const":63,"./enum":64,"./limitItems":66,"./limitLength":67,"./limitNumber":68,"./limitProperties":69,"./multipleOf":70,"./pattern":71,"./required":72,"./uniqueItems":73}],66:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const error = {
    message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str) `must NOT have ${comp} than ${schemaCode} items`;
    },
    params: ({ schemaCode }) => (0, codegen_1._) `{limit: ${schemaCode}}`,
};
const def = {
    keyword: ["maxItems", "minItems"],
    type: "array",
    schemaType: "number",
    $data: true,
    error,
    code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._) `${data}.length ${op} ${schemaCode}`);
    },
};
exports.default = def;

},{"../../compile/codegen":13}],67:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const ucs2length_1 = require("../../runtime/ucs2length");
const error = {
    message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str) `must NOT have ${comp} than ${schemaCode} characters`;
    },
    params: ({ schemaCode }) => (0, codegen_1._) `{limit: ${schemaCode}}`,
};
const def = {
    keyword: ["maxLength", "minLength"],
    type: "string",
    schemaType: "number",
    $data: true,
    error,
    code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._) `${data}.length` : (0, codegen_1._) `${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._) `${len} ${op} ${schemaCode}`);
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21,"../../runtime/ucs2length":33}],68:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const ops = codegen_1.operators;
const KWDs = {
    maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
    minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
    exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
    exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE },
};
const error = {
    message: ({ keyword, schemaCode }) => (0, codegen_1.str) `must be ${KWDs[keyword].okStr} ${schemaCode}`,
    params: ({ keyword, schemaCode }) => (0, codegen_1._) `{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`,
};
const def = {
    keyword: Object.keys(KWDs),
    type: "number",
    schemaType: "number",
    $data: true,
    error,
    code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._) `${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
    },
};
exports.default = def;

},{"../../compile/codegen":13}],69:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const error = {
    message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str) `must NOT have ${comp} than ${schemaCode} properties`;
    },
    params: ({ schemaCode }) => (0, codegen_1._) `{limit: ${schemaCode}}`,
};
const def = {
    keyword: ["maxProperties", "minProperties"],
    type: "object",
    schemaType: "number",
    $data: true,
    error,
    code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._) `Object.keys(${data}).length ${op} ${schemaCode}`);
    },
};
exports.default = def;

},{"../../compile/codegen":13}],70:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const codegen_1 = require("../../compile/codegen");
const error = {
    message: ({ schemaCode }) => (0, codegen_1.str) `must be multiple of ${schemaCode}`,
    params: ({ schemaCode }) => (0, codegen_1._) `{multipleOf: ${schemaCode}}`,
};
const def = {
    keyword: "multipleOf",
    type: "number",
    schemaType: "number",
    $data: true,
    error,
    code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        // const bdt = bad$DataType(schemaCode, <string>def.schemaType, $data)
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec
            ? (0, codegen_1._) `Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}`
            : (0, codegen_1._) `${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._) `(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
    },
};
exports.default = def;

},{"../../compile/codegen":13}],71:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const code_1 = require("../code");
const codegen_1 = require("../../compile/codegen");
const error = {
    message: ({ schemaCode }) => (0, codegen_1.str) `must match pattern "${schemaCode}"`,
    params: ({ schemaCode }) => (0, codegen_1._) `{pattern: ${schemaCode}}`,
};
const def = {
    keyword: "pattern",
    type: "string",
    schemaType: "string",
    $data: true,
    error,
    code(cxt) {
        const { data, $data, schema, schemaCode, it } = cxt;
        // TODO regexp should be wrapped in try/catchs
        const u = it.opts.unicodeRegExp ? "u" : "";
        const regExp = $data ? (0, codegen_1._) `(new RegExp(${schemaCode}, ${u}))` : (0, code_1.usePattern)(cxt, schema);
        cxt.fail$data((0, codegen_1._) `!${regExp}.test(${data})`);
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../code":53}],72:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const code_1 = require("../code");
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const error = {
    message: ({ params: { missingProperty } }) => (0, codegen_1.str) `must have required property '${missingProperty}'`,
    params: ({ params: { missingProperty } }) => (0, codegen_1._) `{missingProperty: ${missingProperty}}`,
};
const def = {
    keyword: "required",
    type: "object",
    schemaType: "array",
    $data: true,
    error,
    code(cxt) {
        const { gen, schema, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema.length === 0)
            return;
        const useLoop = schema.length >= opts.loopRequired;
        if (it.allErrors)
            allErrorsMode();
        else
            exitOnErrorMode();
        if (opts.strictRequired) {
            const props = cxt.parentSchema.properties;
            const { definedProperties } = cxt.it;
            for (const requiredKey of schema) {
                if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === undefined && !definedProperties.has(requiredKey)) {
                    const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
                    const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
                    (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
                }
            }
        }
        function allErrorsMode() {
            if (useLoop || $data) {
                cxt.block$data(codegen_1.nil, loopAllRequired);
            }
            else {
                for (const prop of schema) {
                    (0, code_1.checkReportMissingProp)(cxt, prop);
                }
            }
        }
        function exitOnErrorMode() {
            const missing = gen.let("missing");
            if (useLoop || $data) {
                const valid = gen.let("valid", true);
                cxt.block$data(valid, () => loopUntilMissing(missing, valid));
                cxt.ok(valid);
            }
            else {
                gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
                (0, code_1.reportMissingProp)(cxt, missing);
                gen.else();
            }
        }
        function loopAllRequired() {
            gen.forOf("prop", schemaCode, (prop) => {
                cxt.setParams({ missingProperty: prop });
                gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
            });
        }
        function loopUntilMissing(missing, valid) {
            cxt.setParams({ missingProperty: missing });
            gen.forOf(missing, schemaCode, () => {
                gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
                gen.if((0, codegen_1.not)(valid), () => {
                    cxt.error();
                    gen.break();
                });
            }, codegen_1.nil);
        }
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21,"../code":53}],73:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dataType_1 = require("../../compile/validate/dataType");
const codegen_1 = require("../../compile/codegen");
const util_1 = require("../../compile/util");
const equal_1 = require("../../runtime/equal");
const error = {
    message: ({ params: { i, j } }) => (0, codegen_1.str) `must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
    params: ({ params: { i, j } }) => (0, codegen_1._) `{i: ${i}, j: ${j}}`,
};
const def = {
    keyword: "uniqueItems",
    type: "array",
    schemaType: "boolean",
    $data: true,
    error,
    code(cxt) {
        const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema)
            return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._) `${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
            const i = gen.let("i", (0, codegen_1._) `${data}.length`);
            const j = gen.let("j");
            cxt.setParams({ i, j });
            gen.assign(valid, true);
            gen.if((0, codegen_1._) `${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
            return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
            const item = gen.name("item");
            const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
            const indices = gen.const("indices", (0, codegen_1._) `{}`);
            gen.for((0, codegen_1._) `;${i}--;`, () => {
                gen.let(item, (0, codegen_1._) `${data}[${i}]`);
                gen.if(wrongType, (0, codegen_1._) `continue`);
                if (itemTypes.length > 1)
                    gen.if((0, codegen_1._) `typeof ${item} == "string"`, (0, codegen_1._) `${item} += "_"`);
                gen
                    .if((0, codegen_1._) `typeof ${indices}[${item}] == "number"`, () => {
                    gen.assign(j, (0, codegen_1._) `${indices}[${item}]`);
                    cxt.error();
                    gen.assign(valid, false).break();
                })
                    .code((0, codegen_1._) `${indices}[${item}] = ${i}`);
            });
        }
        function loopN2(i, j) {
            const eql = (0, util_1.useFunc)(gen, equal_1.default);
            const outer = gen.name("outer");
            gen.label(outer).for((0, codegen_1._) `;${i}--;`, () => gen.for((0, codegen_1._) `${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._) `${eql}(${data}[${i}], ${data}[${j}])`, () => {
                cxt.error();
                gen.assign(valid, false).break(outer);
            })));
        }
    },
};
exports.default = def;

},{"../../compile/codegen":13,"../../compile/util":21,"../../compile/validate/dataType":24,"../../runtime/equal":32}],74:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],75:[function(require,module,exports){

},{}],76:[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"base64-js":74,"buffer":76,"ieee754":84}],77:[function(require,module,exports){
(function (Buffer){(function (){
var clone = (function() {
'use strict';

function _instanceof(obj, type) {
  return type != null && obj instanceof type;
}

var nativeMap;
try {
  nativeMap = Map;
} catch(_) {
  // maybe a reference error because no `Map`. Give it a dummy value that no
  // value will ever be an instanceof.
  nativeMap = function() {};
}

var nativeSet;
try {
  nativeSet = Set;
} catch(_) {
  nativeSet = function() {};
}

var nativePromise;
try {
  nativePromise = Promise;
} catch(_) {
  nativePromise = function() {};
}

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
 * @param `depth` - set to a number if the object is only to be cloned to
 *    a particular depth. (optional - defaults to Infinity)
 * @param `prototype` - sets the prototype to be used when cloning an object.
 *    (optional - defaults to parent prototype).
 * @param `includeNonEnumerable` - set to true if the non-enumerable properties
 *    should be cloned as well. Non-enumerable properties on the prototype
 *    chain will be ignored. (optional - false by default)
*/
function clone(parent, circular, depth, prototype, includeNonEnumerable) {
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    includeNonEnumerable = circular.includeNonEnumerable;
    circular = circular.circular;
  }
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  var allParents = [];
  var allChildren = [];

  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined')
    circular = true;

  if (typeof depth == 'undefined')
    depth = Infinity;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    if (parent === null)
      return null;

    if (depth === 0)
      return parent;

    var child;
    var proto;
    if (typeof parent != 'object') {
      return parent;
    }

    if (_instanceof(parent, nativeMap)) {
      child = new nativeMap();
    } else if (_instanceof(parent, nativeSet)) {
      child = new nativeSet();
    } else if (_instanceof(parent, nativePromise)) {
      child = new nativePromise(function (resolve, reject) {
        parent.then(function(value) {
          resolve(_clone(value, depth - 1));
        }, function(err) {
          reject(_clone(err, depth - 1));
        });
      });
    } else if (clone.__isArray(parent)) {
      child = [];
    } else if (clone.__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (clone.__isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      if (Buffer.allocUnsafe) {
        // Node.js >= 4.5.0
        child = Buffer.allocUnsafe(parent.length);
      } else {
        // Older Node.js versions
        child = new Buffer(parent.length);
      }
      parent.copy(child);
      return child;
    } else if (_instanceof(parent, Error)) {
      child = Object.create(parent);
    } else {
      if (typeof prototype == 'undefined') {
        proto = Object.getPrototypeOf(parent);
        child = Object.create(proto);
      }
      else {
        child = Object.create(prototype);
        proto = prototype;
      }
    }

    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    if (_instanceof(parent, nativeMap)) {
      parent.forEach(function(value, key) {
        var keyChild = _clone(key, depth - 1);
        var valueChild = _clone(value, depth - 1);
        child.set(keyChild, valueChild);
      });
    }
    if (_instanceof(parent, nativeSet)) {
      parent.forEach(function(value) {
        var entryChild = _clone(value, depth - 1);
        child.add(entryChild);
      });
    }

    for (var i in parent) {
      var attrs;
      if (proto) {
        attrs = Object.getOwnPropertyDescriptor(proto, i);
      }

      if (attrs && attrs.set == null) {
        continue;
      }
      child[i] = _clone(parent[i], depth - 1);
    }

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(parent);
      for (var i = 0; i < symbols.length; i++) {
        // Don't need to worry about cloning a symbol because it is a primitive,
        // like a number or string.
        var symbol = symbols[i];
        var descriptor = Object.getOwnPropertyDescriptor(parent, symbol);
        if (descriptor && !descriptor.enumerable && !includeNonEnumerable) {
          continue;
        }
        child[symbol] = _clone(parent[symbol], depth - 1);
        if (!descriptor.enumerable) {
          Object.defineProperty(child, symbol, {
            enumerable: false
          });
        }
      }
    }

    if (includeNonEnumerable) {
      var allPropertyNames = Object.getOwnPropertyNames(parent);
      for (var i = 0; i < allPropertyNames.length; i++) {
        var propertyName = allPropertyNames[i];
        var descriptor = Object.getOwnPropertyDescriptor(parent, propertyName);
        if (descriptor && descriptor.enumerable) {
          continue;
        }
        child[propertyName] = _clone(parent[propertyName], depth - 1);
        Object.defineProperty(child, propertyName, {
          enumerable: false
        });
      }
    }

    return child;
  }

  return _clone(parent, depth);
}

/**
 * Simple flat clone using prototype, accepts only objects, usefull for property
 * override on FLAT configuration object (no nested props).
 *
 * USE WITH CAUTION! This may not behave as you wish if you do not know how this
 * works.
 */
clone.clonePrototype = function clonePrototype(parent) {
  if (parent === null)
    return null;

  var c = function () {};
  c.prototype = parent;
  return new c();
};

// private utility functions

function __objToStr(o) {
  return Object.prototype.toString.call(o);
}
clone.__objToStr = __objToStr;

function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
}
clone.__isDate = __isDate;

function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
}
clone.__isArray = __isArray;

function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
}
clone.__isRegExp = __isRegExp;

function __getRegExpFlags(re) {
  var flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
}
clone.__getRegExpFlags = __getRegExpFlags;

return clone;
})();

if (typeof module === 'object' && module.exports) {
  module.exports = clone;
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"buffer":76}],78:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}

},{}],79:[function(require,module,exports){
'use strict';

// do not edit .js files directly - edit src/index.jst



module.exports = function equal(a, b) {
  if (a === b) return true;

  if (a && b && typeof a == 'object' && typeof b == 'object') {
    if (a.constructor !== b.constructor) return false;

    var length, i, keys;
    if (Array.isArray(a)) {
      length = a.length;
      if (length != b.length) return false;
      for (i = length; i-- !== 0;)
        if (!equal(a[i], b[i])) return false;
      return true;
    }



    if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
    if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
    if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) return false;

    for (i = length; i-- !== 0;)
      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

    for (i = length; i-- !== 0;) {
      var key = keys[i];

      if (!equal(a[key], b[key])) return false;
    }

    return true;
  }

  // true if both NaN, false otherwise
  return a!==a && b!==b;
};

},{}],80:[function(require,module,exports){
'use strict'

const { normalizeIPv6, normalizeIPv4, removeDotSegments, recomposeAuthority, normalizeComponentEncoding } = require('./lib/utils')
const SCHEMES = require('./lib/schemes')

function normalize (uri, options) {
  if (typeof uri === 'string') {
    uri = serialize(parse(uri, options), options)
  } else if (typeof uri === 'object') {
    uri = parse(serialize(uri, options), options)
  }
  return uri
}

function resolve (baseURI, relativeURI, options) {
  const schemelessOptions = Object.assign({ scheme: 'null' }, options)
  const resolved = resolveComponents(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true)
  return serialize(resolved, { ...schemelessOptions, skipEscape: true })
}

function resolveComponents (base, relative, options, skipNormalization) {
  const target = {}
  if (!skipNormalization) {
    base = parse(serialize(base, options), options) // normalize base components
    relative = parse(serialize(relative, options), options) // normalize relative components
  }
  options = options || {}

  if (!options.tolerant && relative.scheme) {
    target.scheme = relative.scheme
    // target.authority = relative.authority;
    target.userinfo = relative.userinfo
    target.host = relative.host
    target.port = relative.port
    target.path = removeDotSegments(relative.path || '')
    target.query = relative.query
  } else {
    if (relative.userinfo !== undefined || relative.host !== undefined || relative.port !== undefined) {
      // target.authority = relative.authority;
      target.userinfo = relative.userinfo
      target.host = relative.host
      target.port = relative.port
      target.path = removeDotSegments(relative.path || '')
      target.query = relative.query
    } else {
      if (!relative.path) {
        target.path = base.path
        if (relative.query !== undefined) {
          target.query = relative.query
        } else {
          target.query = base.query
        }
      } else {
        if (relative.path.charAt(0) === '/') {
          target.path = removeDotSegments(relative.path)
        } else {
          if ((base.userinfo !== undefined || base.host !== undefined || base.port !== undefined) && !base.path) {
            target.path = '/' + relative.path
          } else if (!base.path) {
            target.path = relative.path
          } else {
            target.path = base.path.slice(0, base.path.lastIndexOf('/') + 1) + relative.path
          }
          target.path = removeDotSegments(target.path)
        }
        target.query = relative.query
      }
      // target.authority = base.authority;
      target.userinfo = base.userinfo
      target.host = base.host
      target.port = base.port
    }
    target.scheme = base.scheme
  }

  target.fragment = relative.fragment

  return target
}

function equal (uriA, uriB, options) {
  if (typeof uriA === 'string') {
    uriA = unescape(uriA)
    uriA = serialize(normalizeComponentEncoding(parse(uriA, options), true), { ...options, skipEscape: true })
  } else if (typeof uriA === 'object') {
    uriA = serialize(normalizeComponentEncoding(uriA, true), { ...options, skipEscape: true })
  }

  if (typeof uriB === 'string') {
    uriB = unescape(uriB)
    uriB = serialize(normalizeComponentEncoding(parse(uriB, options), true), { ...options, skipEscape: true })
  } else if (typeof uriB === 'object') {
    uriB = serialize(normalizeComponentEncoding(uriB, true), { ...options, skipEscape: true })
  }

  return uriA.toLowerCase() === uriB.toLowerCase()
}

function serialize (cmpts, opts) {
  const components = {
    host: cmpts.host,
    scheme: cmpts.scheme,
    userinfo: cmpts.userinfo,
    port: cmpts.port,
    path: cmpts.path,
    query: cmpts.query,
    nid: cmpts.nid,
    nss: cmpts.nss,
    uuid: cmpts.uuid,
    fragment: cmpts.fragment,
    reference: cmpts.reference,
    resourceName: cmpts.resourceName,
    secure: cmpts.secure,
    error: ''
  }
  const options = Object.assign({}, opts)
  const uriTokens = []

  // find scheme handler
  const schemeHandler = SCHEMES[(options.scheme || components.scheme || '').toLowerCase()]

  // perform scheme specific serialization
  if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(components, options)

  if (components.path !== undefined) {
    if (!options.skipEscape) {
      components.path = escape(components.path)

      if (components.scheme !== undefined) {
        components.path = components.path.split('%3A').join(':')
      }
    } else {
      components.path = unescape(components.path)
    }
  }

  if (options.reference !== 'suffix' && components.scheme) {
    uriTokens.push(components.scheme, ':')
  }

  const authority = recomposeAuthority(components)
  if (authority !== undefined) {
    if (options.reference !== 'suffix') {
      uriTokens.push('//')
    }

    uriTokens.push(authority)

    if (components.path && components.path.charAt(0) !== '/') {
      uriTokens.push('/')
    }
  }
  if (components.path !== undefined) {
    let s = components.path

    if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
      s = removeDotSegments(s)
    }

    if (authority === undefined) {
      s = s.replace(/^\/\//u, '/%2F') // don't allow the path to start with "//"
    }

    uriTokens.push(s)
  }

  if (components.query !== undefined) {
    uriTokens.push('?', components.query)
  }

  if (components.fragment !== undefined) {
    uriTokens.push('#', components.fragment)
  }
  return uriTokens.join('')
}

const hexLookUp = Array.from({ length: 127 }, (_v, k) => /[^!"$&'()*+,\-.;=_`a-z{}~]/u.test(String.fromCharCode(k)))

function nonSimpleDomain (value) {
  let code = 0
  for (let i = 0, len = value.length; i < len; ++i) {
    code = value.charCodeAt(i)
    if (code > 126 || hexLookUp[code]) {
      return true
    }
  }
  return false
}

const URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u

function parse (uri, opts) {
  const options = Object.assign({}, opts)
  const parsed = {
    scheme: undefined,
    userinfo: undefined,
    host: '',
    port: undefined,
    path: '',
    query: undefined,
    fragment: undefined
  }
  const gotEncoding = uri.indexOf('%') !== -1
  let isIP = false
  if (options.reference === 'suffix') uri = (options.scheme ? options.scheme + ':' : '') + '//' + uri

  const matches = uri.match(URI_PARSE)

  if (matches) {
    // store each component
    parsed.scheme = matches[1]
    parsed.userinfo = matches[3]
    parsed.host = matches[4]
    parsed.port = parseInt(matches[5], 10)
    parsed.path = matches[6] || ''
    parsed.query = matches[7]
    parsed.fragment = matches[8]

    // fix port number
    if (isNaN(parsed.port)) {
      parsed.port = matches[5]
    }
    if (parsed.host) {
      const ipv4result = normalizeIPv4(parsed.host)
      if (ipv4result.isIPV4 === false) {
        const ipv6result = normalizeIPv6(ipv4result.host)
        parsed.host = ipv6result.host.toLowerCase()
        isIP = ipv6result.isIPV6
      } else {
        parsed.host = ipv4result.host
        isIP = true
      }
    }
    if (parsed.scheme === undefined && parsed.userinfo === undefined && parsed.host === undefined && parsed.port === undefined && parsed.query === undefined && !parsed.path) {
      parsed.reference = 'same-document'
    } else if (parsed.scheme === undefined) {
      parsed.reference = 'relative'
    } else if (parsed.fragment === undefined) {
      parsed.reference = 'absolute'
    } else {
      parsed.reference = 'uri'
    }

    // check for reference errors
    if (options.reference && options.reference !== 'suffix' && options.reference !== parsed.reference) {
      parsed.error = parsed.error || 'URI is not a ' + options.reference + ' reference.'
    }

    // find scheme handler
    const schemeHandler = SCHEMES[(options.scheme || parsed.scheme || '').toLowerCase()]

    // check if scheme can't handle IRIs
    if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
      // if host component is a domain name
      if (parsed.host && (options.domainHost || (schemeHandler && schemeHandler.domainHost)) && isIP === false && nonSimpleDomain(parsed.host)) {
        // convert Unicode IDN -> ASCII IDN
        try {
          parsed.host = URL.domainToASCII(parsed.host.toLowerCase())
        } catch (e) {
          parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e
        }
      }
      // convert IRI -> URI
    }

    if (!schemeHandler || (schemeHandler && !schemeHandler.skipNormalize)) {
      if (gotEncoding && parsed.scheme !== undefined) {
        parsed.scheme = unescape(parsed.scheme)
      }
      if (gotEncoding && parsed.host !== undefined) {
        parsed.host = unescape(parsed.host)
      }
      if (parsed.path) {
        parsed.path = escape(unescape(parsed.path))
      }
      if (parsed.fragment) {
        parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment))
      }
    }

    // perform scheme specific parsing
    if (schemeHandler && schemeHandler.parse) {
      schemeHandler.parse(parsed, options)
    }
  } else {
    parsed.error = parsed.error || 'URI can not be parsed.'
  }
  return parsed
}

const fastUri = {
  SCHEMES,
  normalize,
  resolve,
  resolveComponents,
  equal,
  serialize,
  parse
}

module.exports = fastUri
module.exports.default = fastUri
module.exports.fastUri = fastUri

},{"./lib/schemes":81,"./lib/utils":83}],81:[function(require,module,exports){
'use strict'

const UUID_REG = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu
const URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu

function isSecure (wsComponents) {
  return typeof wsComponents.secure === 'boolean' ? wsComponents.secure : String(wsComponents.scheme).toLowerCase() === 'wss'
}

function httpParse (components) {
  if (!components.host) {
    components.error = components.error || 'HTTP URIs must have a host.'
  }

  return components
}

function httpSerialize (components) {
  const secure = String(components.scheme).toLowerCase() === 'https'

  // normalize the default port
  if (components.port === (secure ? 443 : 80) || components.port === '') {
    components.port = undefined
  }

  // normalize the empty path
  if (!components.path) {
    components.path = '/'
  }

  // NOTE: We do not parse query strings for HTTP URIs
  // as WWW Form Url Encoded query strings are part of the HTML4+ spec,
  // and not the HTTP spec.

  return components
}

function wsParse (wsComponents) {
// indicate if the secure flag is set
  wsComponents.secure = isSecure(wsComponents)

  // construct resouce name
  wsComponents.resourceName = (wsComponents.path || '/') + (wsComponents.query ? '?' + wsComponents.query : '')
  wsComponents.path = undefined
  wsComponents.query = undefined

  return wsComponents
}

function wsSerialize (wsComponents) {
// normalize the default port
  if (wsComponents.port === (isSecure(wsComponents) ? 443 : 80) || wsComponents.port === '') {
    wsComponents.port = undefined
  }

  // ensure scheme matches secure flag
  if (typeof wsComponents.secure === 'boolean') {
    wsComponents.scheme = (wsComponents.secure ? 'wss' : 'ws')
    wsComponents.secure = undefined
  }

  // reconstruct path from resource name
  if (wsComponents.resourceName) {
    const [path, query] = wsComponents.resourceName.split('?')
    wsComponents.path = (path && path !== '/' ? path : undefined)
    wsComponents.query = query
    wsComponents.resourceName = undefined
  }

  // forbid fragment component
  wsComponents.fragment = undefined

  return wsComponents
}

function urnParse (urnComponents, options) {
  if (!urnComponents.path) {
    urnComponents.error = 'URN can not be parsed'
    return urnComponents
  }
  const matches = urnComponents.path.match(URN_REG)
  if (matches) {
    const scheme = options.scheme || urnComponents.scheme || 'urn'
    urnComponents.nid = matches[1].toLowerCase()
    urnComponents.nss = matches[2]
    const urnScheme = `${scheme}:${options.nid || urnComponents.nid}`
    const schemeHandler = SCHEMES[urnScheme]
    urnComponents.path = undefined

    if (schemeHandler) {
      urnComponents = schemeHandler.parse(urnComponents, options)
    }
  } else {
    urnComponents.error = urnComponents.error || 'URN can not be parsed.'
  }

  return urnComponents
}

function urnSerialize (urnComponents, options) {
  const scheme = options.scheme || urnComponents.scheme || 'urn'
  const nid = urnComponents.nid.toLowerCase()
  const urnScheme = `${scheme}:${options.nid || nid}`
  const schemeHandler = SCHEMES[urnScheme]

  if (schemeHandler) {
    urnComponents = schemeHandler.serialize(urnComponents, options)
  }

  const uriComponents = urnComponents
  const nss = urnComponents.nss
  uriComponents.path = `${nid || options.nid}:${nss}`

  options.skipEscape = true
  return uriComponents
}

function urnuuidParse (urnComponents, options) {
  const uuidComponents = urnComponents
  uuidComponents.uuid = uuidComponents.nss
  uuidComponents.nss = undefined

  if (!options.tolerant && (!uuidComponents.uuid || !UUID_REG.test(uuidComponents.uuid))) {
    uuidComponents.error = uuidComponents.error || 'UUID is not valid.'
  }

  return uuidComponents
}

function urnuuidSerialize (uuidComponents) {
  const urnComponents = uuidComponents
  // normalize UUID
  urnComponents.nss = (uuidComponents.uuid || '').toLowerCase()
  return urnComponents
}

const http = {
  scheme: 'http',
  domainHost: true,
  parse: httpParse,
  serialize: httpSerialize
}

const https = {
  scheme: 'https',
  domainHost: http.domainHost,
  parse: httpParse,
  serialize: httpSerialize
}

const ws = {
  scheme: 'ws',
  domainHost: true,
  parse: wsParse,
  serialize: wsSerialize
}

const wss = {
  scheme: 'wss',
  domainHost: ws.domainHost,
  parse: ws.parse,
  serialize: ws.serialize
}

const urn = {
  scheme: 'urn',
  parse: urnParse,
  serialize: urnSerialize,
  skipNormalize: true
}

const urnuuid = {
  scheme: 'urn:uuid',
  parse: urnuuidParse,
  serialize: urnuuidSerialize,
  skipNormalize: true
}

const SCHEMES = {
  http,
  https,
  ws,
  wss,
  urn,
  'urn:uuid': urnuuid
}

module.exports = SCHEMES

},{}],82:[function(require,module,exports){
'use strict'

const HEX = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  a: 10,
  A: 10,
  b: 11,
  B: 11,
  c: 12,
  C: 12,
  d: 13,
  D: 13,
  e: 14,
  E: 14,
  f: 15,
  F: 15
}

module.exports = {
  HEX
}

},{}],83:[function(require,module,exports){
'use strict'

const { HEX } = require('./scopedChars')

const IPV4_REG = /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u

function normalizeIPv4 (host) {
  if (findToken(host, '.') < 3) { return { host, isIPV4: false } }
  const matches = host.match(IPV4_REG) || []
  const [address] = matches
  if (address) {
    return { host: stripLeadingZeros(address, '.'), isIPV4: true }
  } else {
    return { host, isIPV4: false }
  }
}

/**
 * @param {string[]} input
 * @param {boolean} [keepZero=false]
 * @returns {string|undefined}
 */
function stringArrayToHexStripped (input, keepZero = false) {
  let acc = ''
  let strip = true
  for (const c of input) {
    if (HEX[c] === undefined) return undefined
    if (c !== '0' && strip === true) strip = false
    if (!strip) acc += c
  }
  if (keepZero && acc.length === 0) acc = '0'
  return acc
}

function getIPV6 (input) {
  let tokenCount = 0
  const output = { error: false, address: '', zone: '' }
  const address = []
  const buffer = []
  let isZone = false
  let endipv6Encountered = false
  let endIpv6 = false

  function consume () {
    if (buffer.length) {
      if (isZone === false) {
        const hex = stringArrayToHexStripped(buffer)
        if (hex !== undefined) {
          address.push(hex)
        } else {
          output.error = true
          return false
        }
      }
      buffer.length = 0
    }
    return true
  }

  for (let i = 0; i < input.length; i++) {
    const cursor = input[i]
    if (cursor === '[' || cursor === ']') { continue }
    if (cursor === ':') {
      if (endipv6Encountered === true) {
        endIpv6 = true
      }
      if (!consume()) { break }
      tokenCount++
      address.push(':')
      if (tokenCount > 7) {
        // not valid
        output.error = true
        break
      }
      if (i - 1 >= 0 && input[i - 1] === ':') {
        endipv6Encountered = true
      }
      continue
    } else if (cursor === '%') {
      if (!consume()) { break }
      // switch to zone detection
      isZone = true
    } else {
      buffer.push(cursor)
      continue
    }
  }
  if (buffer.length) {
    if (isZone) {
      output.zone = buffer.join('')
    } else if (endIpv6) {
      address.push(buffer.join(''))
    } else {
      address.push(stringArrayToHexStripped(buffer))
    }
  }
  output.address = address.join('')
  return output
}

function normalizeIPv6 (host) {
  if (findToken(host, ':') < 2) { return { host, isIPV6: false } }
  const ipv6 = getIPV6(host)

  if (!ipv6.error) {
    let newHost = ipv6.address
    let escapedHost = ipv6.address
    if (ipv6.zone) {
      newHost += '%' + ipv6.zone
      escapedHost += '%25' + ipv6.zone
    }
    return { host: newHost, escapedHost, isIPV6: true }
  } else {
    return { host, isIPV6: false }
  }
}

function stripLeadingZeros (str, token) {
  let out = ''
  let skip = true
  const l = str.length
  for (let i = 0; i < l; i++) {
    const c = str[i]
    if (c === '0' && skip) {
      if ((i + 1 <= l && str[i + 1] === token) || i + 1 === l) {
        out += c
        skip = false
      }
    } else {
      if (c === token) {
        skip = true
      } else {
        skip = false
      }
      out += c
    }
  }
  return out
}

function findToken (str, token) {
  let ind = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === token) ind++
  }
  return ind
}

const RDS1 = /^\.\.?\//u
const RDS2 = /^\/\.(?:\/|$)/u
const RDS3 = /^\/\.\.(?:\/|$)/u
const RDS5 = /^\/?(?:.|\n)*?(?=\/|$)/u

function removeDotSegments (input) {
  const output = []

  while (input.length) {
    if (input.match(RDS1)) {
      input = input.replace(RDS1, '')
    } else if (input.match(RDS2)) {
      input = input.replace(RDS2, '/')
    } else if (input.match(RDS3)) {
      input = input.replace(RDS3, '/')
      output.pop()
    } else if (input === '.' || input === '..') {
      input = ''
    } else {
      const im = input.match(RDS5)
      if (im) {
        const s = im[0]
        input = input.slice(s.length)
        output.push(s)
      } else {
        throw new Error('Unexpected dot segment condition')
      }
    }
  }
  return output.join('')
}

function normalizeComponentEncoding (components, esc) {
  const func = esc !== true ? escape : unescape
  if (components.scheme !== undefined) {
    components.scheme = func(components.scheme)
  }
  if (components.userinfo !== undefined) {
    components.userinfo = func(components.userinfo)
  }
  if (components.host !== undefined) {
    components.host = func(components.host)
  }
  if (components.path !== undefined) {
    components.path = func(components.path)
  }
  if (components.query !== undefined) {
    components.query = func(components.query)
  }
  if (components.fragment !== undefined) {
    components.fragment = func(components.fragment)
  }
  return components
}

function recomposeAuthority (components) {
  const uriTokens = []

  if (components.userinfo !== undefined) {
    uriTokens.push(components.userinfo)
    uriTokens.push('@')
  }

  if (components.host !== undefined) {
    let host = unescape(components.host)
    const ipV4res = normalizeIPv4(host)

    if (ipV4res.isIPV4) {
      host = ipV4res.host
    } else {
      const ipV6res = normalizeIPv6(ipV4res.host)
      if (ipV6res.isIPV6 === true) {
        host = `[${ipV6res.escapedHost}]`
      } else {
        host = components.host
      }
    }
    uriTokens.push(host)
  }

  if (typeof components.port === 'number' || typeof components.port === 'string') {
    uriTokens.push(':')
    uriTokens.push(String(components.port))
  }

  return uriTokens.length ? uriTokens.join('') : undefined
};

module.exports = {
  recomposeAuthority,
  normalizeComponentEncoding,
  removeDotSegments,
  normalizeIPv4,
  normalizeIPv6,
  stringArrayToHexStripped
}

},{"./scopedChars":82}],84:[function(require,module,exports){
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],85:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      })
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      var TempCtor = function () {}
      TempCtor.prototype = superCtor.prototype
      ctor.prototype = new TempCtor()
      ctor.prototype.constructor = ctor
    }
  }
}

},{}],86:[function(require,module,exports){
'use strict';

var traverse = module.exports = function (schema, opts, cb) {
  // Legacy support for v0.3.1 and earlier.
  if (typeof opts == 'function') {
    cb = opts;
    opts = {};
  }

  cb = opts.cb || cb;
  var pre = (typeof cb == 'function') ? cb : cb.pre || function() {};
  var post = cb.post || function() {};

  _traverse(opts, pre, post, schema, '', schema);
};


traverse.keywords = {
  additionalItems: true,
  items: true,
  contains: true,
  additionalProperties: true,
  propertyNames: true,
  not: true,
  if: true,
  then: true,
  else: true
};

traverse.arrayKeywords = {
  items: true,
  allOf: true,
  anyOf: true,
  oneOf: true
};

traverse.propsKeywords = {
  $defs: true,
  definitions: true,
  properties: true,
  patternProperties: true,
  dependencies: true
};

traverse.skipKeywords = {
  default: true,
  enum: true,
  const: true,
  required: true,
  maximum: true,
  minimum: true,
  exclusiveMaximum: true,
  exclusiveMinimum: true,
  multipleOf: true,
  maxLength: true,
  minLength: true,
  pattern: true,
  format: true,
  maxItems: true,
  minItems: true,
  uniqueItems: true,
  maxProperties: true,
  minProperties: true
};


function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
  if (schema && typeof schema == 'object' && !Array.isArray(schema)) {
    pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
    for (var key in schema) {
      var sch = schema[key];
      if (Array.isArray(sch)) {
        if (key in traverse.arrayKeywords) {
          for (var i=0; i<sch.length; i++)
            _traverse(opts, pre, post, sch[i], jsonPtr + '/' + key + '/' + i, rootSchema, jsonPtr, key, schema, i);
        }
      } else if (key in traverse.propsKeywords) {
        if (sch && typeof sch == 'object') {
          for (var prop in sch)
            _traverse(opts, pre, post, sch[prop], jsonPtr + '/' + key + '/' + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
        }
      } else if (key in traverse.keywords || (opts.allKeys && !(key in traverse.skipKeywords))) {
        _traverse(opts, pre, post, sch, jsonPtr + '/' + key, rootSchema, jsonPtr, key, schema);
      }
    }
    post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
  }
}


function escapeJsonPtr(str) {
  return str.replace(/~/g, '~0').replace(/\//g, '~1');
}

},{}],87:[function(require,module,exports){
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.JSON5 = factory());
}(this, (function () { 'use strict';

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var _global = createCommonjsModule(function (module) {
	// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
	var global = module.exports = typeof window != 'undefined' && window.Math == Math
	  ? window : typeof self != 'undefined' && self.Math == Math ? self
	  // eslint-disable-next-line no-new-func
	  : Function('return this')();
	if (typeof __g == 'number') { __g = global; } // eslint-disable-line no-undef
	});

	var _core = createCommonjsModule(function (module) {
	var core = module.exports = { version: '2.6.5' };
	if (typeof __e == 'number') { __e = core; } // eslint-disable-line no-undef
	});
	var _core_1 = _core.version;

	var _isObject = function (it) {
	  return typeof it === 'object' ? it !== null : typeof it === 'function';
	};

	var _anObject = function (it) {
	  if (!_isObject(it)) { throw TypeError(it + ' is not an object!'); }
	  return it;
	};

	var _fails = function (exec) {
	  try {
	    return !!exec();
	  } catch (e) {
	    return true;
	  }
	};

	// Thank's IE8 for his funny defineProperty
	var _descriptors = !_fails(function () {
	  return Object.defineProperty({}, 'a', { get: function () { return 7; } }).a != 7;
	});

	var document = _global.document;
	// typeof document.createElement is 'object' in old IE
	var is = _isObject(document) && _isObject(document.createElement);
	var _domCreate = function (it) {
	  return is ? document.createElement(it) : {};
	};

	var _ie8DomDefine = !_descriptors && !_fails(function () {
	  return Object.defineProperty(_domCreate('div'), 'a', { get: function () { return 7; } }).a != 7;
	});

	// 7.1.1 ToPrimitive(input [, PreferredType])

	// instead of the ES6 spec version, we didn't implement @@toPrimitive case
	// and the second argument - flag - preferred type is a string
	var _toPrimitive = function (it, S) {
	  if (!_isObject(it)) { return it; }
	  var fn, val;
	  if (S && typeof (fn = it.toString) == 'function' && !_isObject(val = fn.call(it))) { return val; }
	  if (typeof (fn = it.valueOf) == 'function' && !_isObject(val = fn.call(it))) { return val; }
	  if (!S && typeof (fn = it.toString) == 'function' && !_isObject(val = fn.call(it))) { return val; }
	  throw TypeError("Can't convert object to primitive value");
	};

	var dP = Object.defineProperty;

	var f = _descriptors ? Object.defineProperty : function defineProperty(O, P, Attributes) {
	  _anObject(O);
	  P = _toPrimitive(P, true);
	  _anObject(Attributes);
	  if (_ie8DomDefine) { try {
	    return dP(O, P, Attributes);
	  } catch (e) { /* empty */ } }
	  if ('get' in Attributes || 'set' in Attributes) { throw TypeError('Accessors not supported!'); }
	  if ('value' in Attributes) { O[P] = Attributes.value; }
	  return O;
	};

	var _objectDp = {
		f: f
	};

	var _propertyDesc = function (bitmap, value) {
	  return {
	    enumerable: !(bitmap & 1),
	    configurable: !(bitmap & 2),
	    writable: !(bitmap & 4),
	    value: value
	  };
	};

	var _hide = _descriptors ? function (object, key, value) {
	  return _objectDp.f(object, key, _propertyDesc(1, value));
	} : function (object, key, value) {
	  object[key] = value;
	  return object;
	};

	var hasOwnProperty = {}.hasOwnProperty;
	var _has = function (it, key) {
	  return hasOwnProperty.call(it, key);
	};

	var id = 0;
	var px = Math.random();
	var _uid = function (key) {
	  return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
	};

	var _library = false;

	var _shared = createCommonjsModule(function (module) {
	var SHARED = '__core-js_shared__';
	var store = _global[SHARED] || (_global[SHARED] = {});

	(module.exports = function (key, value) {
	  return store[key] || (store[key] = value !== undefined ? value : {});
	})('versions', []).push({
	  version: _core.version,
	  mode: _library ? 'pure' : 'global',
	  copyright: '© 2019 Denis Pushkarev (zloirock.ru)'
	});
	});

	var _functionToString = _shared('native-function-to-string', Function.toString);

	var _redefine = createCommonjsModule(function (module) {
	var SRC = _uid('src');

	var TO_STRING = 'toString';
	var TPL = ('' + _functionToString).split(TO_STRING);

	_core.inspectSource = function (it) {
	  return _functionToString.call(it);
	};

	(module.exports = function (O, key, val, safe) {
	  var isFunction = typeof val == 'function';
	  if (isFunction) { _has(val, 'name') || _hide(val, 'name', key); }
	  if (O[key] === val) { return; }
	  if (isFunction) { _has(val, SRC) || _hide(val, SRC, O[key] ? '' + O[key] : TPL.join(String(key))); }
	  if (O === _global) {
	    O[key] = val;
	  } else if (!safe) {
	    delete O[key];
	    _hide(O, key, val);
	  } else if (O[key]) {
	    O[key] = val;
	  } else {
	    _hide(O, key, val);
	  }
	// add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
	})(Function.prototype, TO_STRING, function toString() {
	  return typeof this == 'function' && this[SRC] || _functionToString.call(this);
	});
	});

	var _aFunction = function (it) {
	  if (typeof it != 'function') { throw TypeError(it + ' is not a function!'); }
	  return it;
	};

	// optional / simple context binding

	var _ctx = function (fn, that, length) {
	  _aFunction(fn);
	  if (that === undefined) { return fn; }
	  switch (length) {
	    case 1: return function (a) {
	      return fn.call(that, a);
	    };
	    case 2: return function (a, b) {
	      return fn.call(that, a, b);
	    };
	    case 3: return function (a, b, c) {
	      return fn.call(that, a, b, c);
	    };
	  }
	  return function (/* ...args */) {
	    return fn.apply(that, arguments);
	  };
	};

	var PROTOTYPE = 'prototype';

	var $export = function (type, name, source) {
	  var IS_FORCED = type & $export.F;
	  var IS_GLOBAL = type & $export.G;
	  var IS_STATIC = type & $export.S;
	  var IS_PROTO = type & $export.P;
	  var IS_BIND = type & $export.B;
	  var target = IS_GLOBAL ? _global : IS_STATIC ? _global[name] || (_global[name] = {}) : (_global[name] || {})[PROTOTYPE];
	  var exports = IS_GLOBAL ? _core : _core[name] || (_core[name] = {});
	  var expProto = exports[PROTOTYPE] || (exports[PROTOTYPE] = {});
	  var key, own, out, exp;
	  if (IS_GLOBAL) { source = name; }
	  for (key in source) {
	    // contains in native
	    own = !IS_FORCED && target && target[key] !== undefined;
	    // export native or passed
	    out = (own ? target : source)[key];
	    // bind timers to global for call from export context
	    exp = IS_BIND && own ? _ctx(out, _global) : IS_PROTO && typeof out == 'function' ? _ctx(Function.call, out) : out;
	    // extend global
	    if (target) { _redefine(target, key, out, type & $export.U); }
	    // export
	    if (exports[key] != out) { _hide(exports, key, exp); }
	    if (IS_PROTO && expProto[key] != out) { expProto[key] = out; }
	  }
	};
	_global.core = _core;
	// type bitmap
	$export.F = 1;   // forced
	$export.G = 2;   // global
	$export.S = 4;   // static
	$export.P = 8;   // proto
	$export.B = 16;  // bind
	$export.W = 32;  // wrap
	$export.U = 64;  // safe
	$export.R = 128; // real proto method for `library`
	var _export = $export;

	// 7.1.4 ToInteger
	var ceil = Math.ceil;
	var floor = Math.floor;
	var _toInteger = function (it) {
	  return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
	};

	// 7.2.1 RequireObjectCoercible(argument)
	var _defined = function (it) {
	  if (it == undefined) { throw TypeError("Can't call method on  " + it); }
	  return it;
	};

	// true  -> String#at
	// false -> String#codePointAt
	var _stringAt = function (TO_STRING) {
	  return function (that, pos) {
	    var s = String(_defined(that));
	    var i = _toInteger(pos);
	    var l = s.length;
	    var a, b;
	    if (i < 0 || i >= l) { return TO_STRING ? '' : undefined; }
	    a = s.charCodeAt(i);
	    return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff
	      ? TO_STRING ? s.charAt(i) : a
	      : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
	  };
	};

	var $at = _stringAt(false);
	_export(_export.P, 'String', {
	  // 21.1.3.3 String.prototype.codePointAt(pos)
	  codePointAt: function codePointAt(pos) {
	    return $at(this, pos);
	  }
	});

	var codePointAt = _core.String.codePointAt;

	var max = Math.max;
	var min = Math.min;
	var _toAbsoluteIndex = function (index, length) {
	  index = _toInteger(index);
	  return index < 0 ? max(index + length, 0) : min(index, length);
	};

	var fromCharCode = String.fromCharCode;
	var $fromCodePoint = String.fromCodePoint;

	// length should be 1, old FF problem
	_export(_export.S + _export.F * (!!$fromCodePoint && $fromCodePoint.length != 1), 'String', {
	  // 21.1.2.2 String.fromCodePoint(...codePoints)
	  fromCodePoint: function fromCodePoint(x) {
	    var arguments$1 = arguments;
	 // eslint-disable-line no-unused-vars
	    var res = [];
	    var aLen = arguments.length;
	    var i = 0;
	    var code;
	    while (aLen > i) {
	      code = +arguments$1[i++];
	      if (_toAbsoluteIndex(code, 0x10ffff) !== code) { throw RangeError(code + ' is not a valid code point'); }
	      res.push(code < 0x10000
	        ? fromCharCode(code)
	        : fromCharCode(((code -= 0x10000) >> 10) + 0xd800, code % 0x400 + 0xdc00)
	      );
	    } return res.join('');
	  }
	});

	var fromCodePoint = _core.String.fromCodePoint;

	// This is a generated file. Do not edit.
	var Space_Separator = /[\u1680\u2000-\u200A\u202F\u205F\u3000]/;
	var ID_Start = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDE00\uDE0B-\uDE32\uDE3A\uDE50\uDE5C-\uDE83\uDE86-\uDE89\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD30\uDD46]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]/;
	var ID_Continue = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09FC\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D00-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF9\u1D00-\u1DF9\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDE00-\uDE3E\uDE47\uDE50-\uDE83\uDE86-\uDE99\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD47\uDD50-\uDD59]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/;

	var unicode = {
		Space_Separator: Space_Separator,
		ID_Start: ID_Start,
		ID_Continue: ID_Continue
	};

	var util = {
	    isSpaceSeparator: function isSpaceSeparator (c) {
	        return typeof c === 'string' && unicode.Space_Separator.test(c)
	    },

	    isIdStartChar: function isIdStartChar (c) {
	        return typeof c === 'string' && (
	            (c >= 'a' && c <= 'z') ||
	        (c >= 'A' && c <= 'Z') ||
	        (c === '$') || (c === '_') ||
	        unicode.ID_Start.test(c)
	        )
	    },

	    isIdContinueChar: function isIdContinueChar (c) {
	        return typeof c === 'string' && (
	            (c >= 'a' && c <= 'z') ||
	        (c >= 'A' && c <= 'Z') ||
	        (c >= '0' && c <= '9') ||
	        (c === '$') || (c === '_') ||
	        (c === '\u200C') || (c === '\u200D') ||
	        unicode.ID_Continue.test(c)
	        )
	    },

	    isDigit: function isDigit (c) {
	        return typeof c === 'string' && /[0-9]/.test(c)
	    },

	    isHexDigit: function isHexDigit (c) {
	        return typeof c === 'string' && /[0-9A-Fa-f]/.test(c)
	    },
	};

	var source;
	var parseState;
	var stack;
	var pos;
	var line;
	var column;
	var token;
	var key;
	var root;

	var parse = function parse (text, reviver) {
	    source = String(text);
	    parseState = 'start';
	    stack = [];
	    pos = 0;
	    line = 1;
	    column = 0;
	    token = undefined;
	    key = undefined;
	    root = undefined;

	    do {
	        token = lex();

	        // This code is unreachable.
	        // if (!parseStates[parseState]) {
	        //     throw invalidParseState()
	        // }

	        parseStates[parseState]();
	    } while (token.type !== 'eof')

	    if (typeof reviver === 'function') {
	        return internalize({'': root}, '', reviver)
	    }

	    return root
	};

	function internalize (holder, name, reviver) {
	    var value = holder[name];
	    if (value != null && typeof value === 'object') {
	        if (Array.isArray(value)) {
	            for (var i = 0; i < value.length; i++) {
	                var key = String(i);
	                var replacement = internalize(value, key, reviver);
	                if (replacement === undefined) {
	                    delete value[key];
	                } else {
	                    Object.defineProperty(value, key, {
	                        value: replacement,
	                        writable: true,
	                        enumerable: true,
	                        configurable: true,
	                    });
	                }
	            }
	        } else {
	            for (var key$1 in value) {
	                var replacement$1 = internalize(value, key$1, reviver);
	                if (replacement$1 === undefined) {
	                    delete value[key$1];
	                } else {
	                    Object.defineProperty(value, key$1, {
	                        value: replacement$1,
	                        writable: true,
	                        enumerable: true,
	                        configurable: true,
	                    });
	                }
	            }
	        }
	    }

	    return reviver.call(holder, name, value)
	}

	var lexState;
	var buffer;
	var doubleQuote;
	var sign;
	var c;

	function lex () {
	    lexState = 'default';
	    buffer = '';
	    doubleQuote = false;
	    sign = 1;

	    for (;;) {
	        c = peek();

	        // This code is unreachable.
	        // if (!lexStates[lexState]) {
	        //     throw invalidLexState(lexState)
	        // }

	        var token = lexStates[lexState]();
	        if (token) {
	            return token
	        }
	    }
	}

	function peek () {
	    if (source[pos]) {
	        return String.fromCodePoint(source.codePointAt(pos))
	    }
	}

	function read () {
	    var c = peek();

	    if (c === '\n') {
	        line++;
	        column = 0;
	    } else if (c) {
	        column += c.length;
	    } else {
	        column++;
	    }

	    if (c) {
	        pos += c.length;
	    }

	    return c
	}

	var lexStates = {
	    default: function default$1 () {
	        switch (c) {
	        case '\t':
	        case '\v':
	        case '\f':
	        case ' ':
	        case '\u00A0':
	        case '\uFEFF':
	        case '\n':
	        case '\r':
	        case '\u2028':
	        case '\u2029':
	            read();
	            return

	        case '/':
	            read();
	            lexState = 'comment';
	            return

	        case undefined:
	            read();
	            return newToken('eof')
	        }

	        if (util.isSpaceSeparator(c)) {
	            read();
	            return
	        }

	        // This code is unreachable.
	        // if (!lexStates[parseState]) {
	        //     throw invalidLexState(parseState)
	        // }

	        return lexStates[parseState]()
	    },

	    comment: function comment () {
	        switch (c) {
	        case '*':
	            read();
	            lexState = 'multiLineComment';
	            return

	        case '/':
	            read();
	            lexState = 'singleLineComment';
	            return
	        }

	        throw invalidChar(read())
	    },

	    multiLineComment: function multiLineComment () {
	        switch (c) {
	        case '*':
	            read();
	            lexState = 'multiLineCommentAsterisk';
	            return

	        case undefined:
	            throw invalidChar(read())
	        }

	        read();
	    },

	    multiLineCommentAsterisk: function multiLineCommentAsterisk () {
	        switch (c) {
	        case '*':
	            read();
	            return

	        case '/':
	            read();
	            lexState = 'default';
	            return

	        case undefined:
	            throw invalidChar(read())
	        }

	        read();
	        lexState = 'multiLineComment';
	    },

	    singleLineComment: function singleLineComment () {
	        switch (c) {
	        case '\n':
	        case '\r':
	        case '\u2028':
	        case '\u2029':
	            read();
	            lexState = 'default';
	            return

	        case undefined:
	            read();
	            return newToken('eof')
	        }

	        read();
	    },

	    value: function value () {
	        switch (c) {
	        case '{':
	        case '[':
	            return newToken('punctuator', read())

	        case 'n':
	            read();
	            literal('ull');
	            return newToken('null', null)

	        case 't':
	            read();
	            literal('rue');
	            return newToken('boolean', true)

	        case 'f':
	            read();
	            literal('alse');
	            return newToken('boolean', false)

	        case '-':
	        case '+':
	            if (read() === '-') {
	                sign = -1;
	            }

	            lexState = 'sign';
	            return

	        case '.':
	            buffer = read();
	            lexState = 'decimalPointLeading';
	            return

	        case '0':
	            buffer = read();
	            lexState = 'zero';
	            return

	        case '1':
	        case '2':
	        case '3':
	        case '4':
	        case '5':
	        case '6':
	        case '7':
	        case '8':
	        case '9':
	            buffer = read();
	            lexState = 'decimalInteger';
	            return

	        case 'I':
	            read();
	            literal('nfinity');
	            return newToken('numeric', Infinity)

	        case 'N':
	            read();
	            literal('aN');
	            return newToken('numeric', NaN)

	        case '"':
	        case "'":
	            doubleQuote = (read() === '"');
	            buffer = '';
	            lexState = 'string';
	            return
	        }

	        throw invalidChar(read())
	    },

	    identifierNameStartEscape: function identifierNameStartEscape () {
	        if (c !== 'u') {
	            throw invalidChar(read())
	        }

	        read();
	        var u = unicodeEscape();
	        switch (u) {
	        case '$':
	        case '_':
	            break

	        default:
	            if (!util.isIdStartChar(u)) {
	                throw invalidIdentifier()
	            }

	            break
	        }

	        buffer += u;
	        lexState = 'identifierName';
	    },

	    identifierName: function identifierName () {
	        switch (c) {
	        case '$':
	        case '_':
	        case '\u200C':
	        case '\u200D':
	            buffer += read();
	            return

	        case '\\':
	            read();
	            lexState = 'identifierNameEscape';
	            return
	        }

	        if (util.isIdContinueChar(c)) {
	            buffer += read();
	            return
	        }

	        return newToken('identifier', buffer)
	    },

	    identifierNameEscape: function identifierNameEscape () {
	        if (c !== 'u') {
	            throw invalidChar(read())
	        }

	        read();
	        var u = unicodeEscape();
	        switch (u) {
	        case '$':
	        case '_':
	        case '\u200C':
	        case '\u200D':
	            break

	        default:
	            if (!util.isIdContinueChar(u)) {
	                throw invalidIdentifier()
	            }

	            break
	        }

	        buffer += u;
	        lexState = 'identifierName';
	    },

	    sign: function sign$1 () {
	        switch (c) {
	        case '.':
	            buffer = read();
	            lexState = 'decimalPointLeading';
	            return

	        case '0':
	            buffer = read();
	            lexState = 'zero';
	            return

	        case '1':
	        case '2':
	        case '3':
	        case '4':
	        case '5':
	        case '6':
	        case '7':
	        case '8':
	        case '9':
	            buffer = read();
	            lexState = 'decimalInteger';
	            return

	        case 'I':
	            read();
	            literal('nfinity');
	            return newToken('numeric', sign * Infinity)

	        case 'N':
	            read();
	            literal('aN');
	            return newToken('numeric', NaN)
	        }

	        throw invalidChar(read())
	    },

	    zero: function zero () {
	        switch (c) {
	        case '.':
	            buffer += read();
	            lexState = 'decimalPoint';
	            return

	        case 'e':
	        case 'E':
	            buffer += read();
	            lexState = 'decimalExponent';
	            return

	        case 'x':
	        case 'X':
	            buffer += read();
	            lexState = 'hexadecimal';
	            return
	        }

	        return newToken('numeric', sign * 0)
	    },

	    decimalInteger: function decimalInteger () {
	        switch (c) {
	        case '.':
	            buffer += read();
	            lexState = 'decimalPoint';
	            return

	        case 'e':
	        case 'E':
	            buffer += read();
	            lexState = 'decimalExponent';
	            return
	        }

	        if (util.isDigit(c)) {
	            buffer += read();
	            return
	        }

	        return newToken('numeric', sign * Number(buffer))
	    },

	    decimalPointLeading: function decimalPointLeading () {
	        if (util.isDigit(c)) {
	            buffer += read();
	            lexState = 'decimalFraction';
	            return
	        }

	        throw invalidChar(read())
	    },

	    decimalPoint: function decimalPoint () {
	        switch (c) {
	        case 'e':
	        case 'E':
	            buffer += read();
	            lexState = 'decimalExponent';
	            return
	        }

	        if (util.isDigit(c)) {
	            buffer += read();
	            lexState = 'decimalFraction';
	            return
	        }

	        return newToken('numeric', sign * Number(buffer))
	    },

	    decimalFraction: function decimalFraction () {
	        switch (c) {
	        case 'e':
	        case 'E':
	            buffer += read();
	            lexState = 'decimalExponent';
	            return
	        }

	        if (util.isDigit(c)) {
	            buffer += read();
	            return
	        }

	        return newToken('numeric', sign * Number(buffer))
	    },

	    decimalExponent: function decimalExponent () {
	        switch (c) {
	        case '+':
	        case '-':
	            buffer += read();
	            lexState = 'decimalExponentSign';
	            return
	        }

	        if (util.isDigit(c)) {
	            buffer += read();
	            lexState = 'decimalExponentInteger';
	            return
	        }

	        throw invalidChar(read())
	    },

	    decimalExponentSign: function decimalExponentSign () {
	        if (util.isDigit(c)) {
	            buffer += read();
	            lexState = 'decimalExponentInteger';
	            return
	        }

	        throw invalidChar(read())
	    },

	    decimalExponentInteger: function decimalExponentInteger () {
	        if (util.isDigit(c)) {
	            buffer += read();
	            return
	        }

	        return newToken('numeric', sign * Number(buffer))
	    },

	    hexadecimal: function hexadecimal () {
	        if (util.isHexDigit(c)) {
	            buffer += read();
	            lexState = 'hexadecimalInteger';
	            return
	        }

	        throw invalidChar(read())
	    },

	    hexadecimalInteger: function hexadecimalInteger () {
	        if (util.isHexDigit(c)) {
	            buffer += read();
	            return
	        }

	        return newToken('numeric', sign * Number(buffer))
	    },

	    string: function string () {
	        switch (c) {
	        case '\\':
	            read();
	            buffer += escape();
	            return

	        case '"':
	            if (doubleQuote) {
	                read();
	                return newToken('string', buffer)
	            }

	            buffer += read();
	            return

	        case "'":
	            if (!doubleQuote) {
	                read();
	                return newToken('string', buffer)
	            }

	            buffer += read();
	            return

	        case '\n':
	        case '\r':
	            throw invalidChar(read())

	        case '\u2028':
	        case '\u2029':
	            separatorChar(c);
	            break

	        case undefined:
	            throw invalidChar(read())
	        }

	        buffer += read();
	    },

	    start: function start () {
	        switch (c) {
	        case '{':
	        case '[':
	            return newToken('punctuator', read())

	        // This code is unreachable since the default lexState handles eof.
	        // case undefined:
	        //     return newToken('eof')
	        }

	        lexState = 'value';
	    },

	    beforePropertyName: function beforePropertyName () {
	        switch (c) {
	        case '$':
	        case '_':
	            buffer = read();
	            lexState = 'identifierName';
	            return

	        case '\\':
	            read();
	            lexState = 'identifierNameStartEscape';
	            return

	        case '}':
	            return newToken('punctuator', read())

	        case '"':
	        case "'":
	            doubleQuote = (read() === '"');
	            lexState = 'string';
	            return
	        }

	        if (util.isIdStartChar(c)) {
	            buffer += read();
	            lexState = 'identifierName';
	            return
	        }

	        throw invalidChar(read())
	    },

	    afterPropertyName: function afterPropertyName () {
	        if (c === ':') {
	            return newToken('punctuator', read())
	        }

	        throw invalidChar(read())
	    },

	    beforePropertyValue: function beforePropertyValue () {
	        lexState = 'value';
	    },

	    afterPropertyValue: function afterPropertyValue () {
	        switch (c) {
	        case ',':
	        case '}':
	            return newToken('punctuator', read())
	        }

	        throw invalidChar(read())
	    },

	    beforeArrayValue: function beforeArrayValue () {
	        if (c === ']') {
	            return newToken('punctuator', read())
	        }

	        lexState = 'value';
	    },

	    afterArrayValue: function afterArrayValue () {
	        switch (c) {
	        case ',':
	        case ']':
	            return newToken('punctuator', read())
	        }

	        throw invalidChar(read())
	    },

	    end: function end () {
	        // This code is unreachable since it's handled by the default lexState.
	        // if (c === undefined) {
	        //     read()
	        //     return newToken('eof')
	        // }

	        throw invalidChar(read())
	    },
	};

	function newToken (type, value) {
	    return {
	        type: type,
	        value: value,
	        line: line,
	        column: column,
	    }
	}

	function literal (s) {
	    for (var i = 0, list = s; i < list.length; i += 1) {
	        var c = list[i];

	        var p = peek();

	        if (p !== c) {
	            throw invalidChar(read())
	        }

	        read();
	    }
	}

	function escape () {
	    var c = peek();
	    switch (c) {
	    case 'b':
	        read();
	        return '\b'

	    case 'f':
	        read();
	        return '\f'

	    case 'n':
	        read();
	        return '\n'

	    case 'r':
	        read();
	        return '\r'

	    case 't':
	        read();
	        return '\t'

	    case 'v':
	        read();
	        return '\v'

	    case '0':
	        read();
	        if (util.isDigit(peek())) {
	            throw invalidChar(read())
	        }

	        return '\0'

	    case 'x':
	        read();
	        return hexEscape()

	    case 'u':
	        read();
	        return unicodeEscape()

	    case '\n':
	    case '\u2028':
	    case '\u2029':
	        read();
	        return ''

	    case '\r':
	        read();
	        if (peek() === '\n') {
	            read();
	        }

	        return ''

	    case '1':
	    case '2':
	    case '3':
	    case '4':
	    case '5':
	    case '6':
	    case '7':
	    case '8':
	    case '9':
	        throw invalidChar(read())

	    case undefined:
	        throw invalidChar(read())
	    }

	    return read()
	}

	function hexEscape () {
	    var buffer = '';
	    var c = peek();

	    if (!util.isHexDigit(c)) {
	        throw invalidChar(read())
	    }

	    buffer += read();

	    c = peek();
	    if (!util.isHexDigit(c)) {
	        throw invalidChar(read())
	    }

	    buffer += read();

	    return String.fromCodePoint(parseInt(buffer, 16))
	}

	function unicodeEscape () {
	    var buffer = '';
	    var count = 4;

	    while (count-- > 0) {
	        var c = peek();
	        if (!util.isHexDigit(c)) {
	            throw invalidChar(read())
	        }

	        buffer += read();
	    }

	    return String.fromCodePoint(parseInt(buffer, 16))
	}

	var parseStates = {
	    start: function start () {
	        if (token.type === 'eof') {
	            throw invalidEOF()
	        }

	        push();
	    },

	    beforePropertyName: function beforePropertyName () {
	        switch (token.type) {
	        case 'identifier':
	        case 'string':
	            key = token.value;
	            parseState = 'afterPropertyName';
	            return

	        case 'punctuator':
	            // This code is unreachable since it's handled by the lexState.
	            // if (token.value !== '}') {
	            //     throw invalidToken()
	            // }

	            pop();
	            return

	        case 'eof':
	            throw invalidEOF()
	        }

	        // This code is unreachable since it's handled by the lexState.
	        // throw invalidToken()
	    },

	    afterPropertyName: function afterPropertyName () {
	        // This code is unreachable since it's handled by the lexState.
	        // if (token.type !== 'punctuator' || token.value !== ':') {
	        //     throw invalidToken()
	        // }

	        if (token.type === 'eof') {
	            throw invalidEOF()
	        }

	        parseState = 'beforePropertyValue';
	    },

	    beforePropertyValue: function beforePropertyValue () {
	        if (token.type === 'eof') {
	            throw invalidEOF()
	        }

	        push();
	    },

	    beforeArrayValue: function beforeArrayValue () {
	        if (token.type === 'eof') {
	            throw invalidEOF()
	        }

	        if (token.type === 'punctuator' && token.value === ']') {
	            pop();
	            return
	        }

	        push();
	    },

	    afterPropertyValue: function afterPropertyValue () {
	        // This code is unreachable since it's handled by the lexState.
	        // if (token.type !== 'punctuator') {
	        //     throw invalidToken()
	        // }

	        if (token.type === 'eof') {
	            throw invalidEOF()
	        }

	        switch (token.value) {
	        case ',':
	            parseState = 'beforePropertyName';
	            return

	        case '}':
	            pop();
	        }

	        // This code is unreachable since it's handled by the lexState.
	        // throw invalidToken()
	    },

	    afterArrayValue: function afterArrayValue () {
	        // This code is unreachable since it's handled by the lexState.
	        // if (token.type !== 'punctuator') {
	        //     throw invalidToken()
	        // }

	        if (token.type === 'eof') {
	            throw invalidEOF()
	        }

	        switch (token.value) {
	        case ',':
	            parseState = 'beforeArrayValue';
	            return

	        case ']':
	            pop();
	        }

	        // This code is unreachable since it's handled by the lexState.
	        // throw invalidToken()
	    },

	    end: function end () {
	        // This code is unreachable since it's handled by the lexState.
	        // if (token.type !== 'eof') {
	        //     throw invalidToken()
	        // }
	    },
	};

	function push () {
	    var value;

	    switch (token.type) {
	    case 'punctuator':
	        switch (token.value) {
	        case '{':
	            value = {};
	            break

	        case '[':
	            value = [];
	            break
	        }

	        break

	    case 'null':
	    case 'boolean':
	    case 'numeric':
	    case 'string':
	        value = token.value;
	        break

	    // This code is unreachable.
	    // default:
	    //     throw invalidToken()
	    }

	    if (root === undefined) {
	        root = value;
	    } else {
	        var parent = stack[stack.length - 1];
	        if (Array.isArray(parent)) {
	            parent.push(value);
	        } else {
	            Object.defineProperty(parent, key, {
	                value: value,
	                writable: true,
	                enumerable: true,
	                configurable: true,
	            });
	        }
	    }

	    if (value !== null && typeof value === 'object') {
	        stack.push(value);

	        if (Array.isArray(value)) {
	            parseState = 'beforeArrayValue';
	        } else {
	            parseState = 'beforePropertyName';
	        }
	    } else {
	        var current = stack[stack.length - 1];
	        if (current == null) {
	            parseState = 'end';
	        } else if (Array.isArray(current)) {
	            parseState = 'afterArrayValue';
	        } else {
	            parseState = 'afterPropertyValue';
	        }
	    }
	}

	function pop () {
	    stack.pop();

	    var current = stack[stack.length - 1];
	    if (current == null) {
	        parseState = 'end';
	    } else if (Array.isArray(current)) {
	        parseState = 'afterArrayValue';
	    } else {
	        parseState = 'afterPropertyValue';
	    }
	}

	// This code is unreachable.
	// function invalidParseState () {
	//     return new Error(`JSON5: invalid parse state '${parseState}'`)
	// }

	// This code is unreachable.
	// function invalidLexState (state) {
	//     return new Error(`JSON5: invalid lex state '${state}'`)
	// }

	function invalidChar (c) {
	    if (c === undefined) {
	        return syntaxError(("JSON5: invalid end of input at " + line + ":" + column))
	    }

	    return syntaxError(("JSON5: invalid character '" + (formatChar(c)) + "' at " + line + ":" + column))
	}

	function invalidEOF () {
	    return syntaxError(("JSON5: invalid end of input at " + line + ":" + column))
	}

	// This code is unreachable.
	// function invalidToken () {
	//     if (token.type === 'eof') {
	//         return syntaxError(`JSON5: invalid end of input at ${line}:${column}`)
	//     }

	//     const c = String.fromCodePoint(token.value.codePointAt(0))
	//     return syntaxError(`JSON5: invalid character '${formatChar(c)}' at ${line}:${column}`)
	// }

	function invalidIdentifier () {
	    column -= 5;
	    return syntaxError(("JSON5: invalid identifier character at " + line + ":" + column))
	}

	function separatorChar (c) {
	    console.warn(("JSON5: '" + (formatChar(c)) + "' in strings is not valid ECMAScript; consider escaping"));
	}

	function formatChar (c) {
	    var replacements = {
	        "'": "\\'",
	        '"': '\\"',
	        '\\': '\\\\',
	        '\b': '\\b',
	        '\f': '\\f',
	        '\n': '\\n',
	        '\r': '\\r',
	        '\t': '\\t',
	        '\v': '\\v',
	        '\0': '\\0',
	        '\u2028': '\\u2028',
	        '\u2029': '\\u2029',
	    };

	    if (replacements[c]) {
	        return replacements[c]
	    }

	    if (c < ' ') {
	        var hexString = c.charCodeAt(0).toString(16);
	        return '\\x' + ('00' + hexString).substring(hexString.length)
	    }

	    return c
	}

	function syntaxError (message) {
	    var err = new SyntaxError(message);
	    err.lineNumber = line;
	    err.columnNumber = column;
	    return err
	}

	var stringify = function stringify (value, replacer, space) {
	    var stack = [];
	    var indent = '';
	    var propertyList;
	    var replacerFunc;
	    var gap = '';
	    var quote;

	    if (
	        replacer != null &&
	        typeof replacer === 'object' &&
	        !Array.isArray(replacer)
	    ) {
	        space = replacer.space;
	        quote = replacer.quote;
	        replacer = replacer.replacer;
	    }

	    if (typeof replacer === 'function') {
	        replacerFunc = replacer;
	    } else if (Array.isArray(replacer)) {
	        propertyList = [];
	        for (var i = 0, list = replacer; i < list.length; i += 1) {
	            var v = list[i];

	            var item = (void 0);

	            if (typeof v === 'string') {
	                item = v;
	            } else if (
	                typeof v === 'number' ||
	                v instanceof String ||
	                v instanceof Number
	            ) {
	                item = String(v);
	            }

	            if (item !== undefined && propertyList.indexOf(item) < 0) {
	                propertyList.push(item);
	            }
	        }
	    }

	    if (space instanceof Number) {
	        space = Number(space);
	    } else if (space instanceof String) {
	        space = String(space);
	    }

	    if (typeof space === 'number') {
	        if (space > 0) {
	            space = Math.min(10, Math.floor(space));
	            gap = '          '.substr(0, space);
	        }
	    } else if (typeof space === 'string') {
	        gap = space.substr(0, 10);
	    }

	    return serializeProperty('', {'': value})

	    function serializeProperty (key, holder) {
	        var value = holder[key];
	        if (value != null) {
	            if (typeof value.toJSON5 === 'function') {
	                value = value.toJSON5(key);
	            } else if (typeof value.toJSON === 'function') {
	                value = value.toJSON(key);
	            }
	        }

	        if (replacerFunc) {
	            value = replacerFunc.call(holder, key, value);
	        }

	        if (value instanceof Number) {
	            value = Number(value);
	        } else if (value instanceof String) {
	            value = String(value);
	        } else if (value instanceof Boolean) {
	            value = value.valueOf();
	        }

	        switch (value) {
	        case null: return 'null'
	        case true: return 'true'
	        case false: return 'false'
	        }

	        if (typeof value === 'string') {
	            return quoteString(value, false)
	        }

	        if (typeof value === 'number') {
	            return String(value)
	        }

	        if (typeof value === 'object') {
	            return Array.isArray(value) ? serializeArray(value) : serializeObject(value)
	        }

	        return undefined
	    }

	    function quoteString (value) {
	        var quotes = {
	            "'": 0.1,
	            '"': 0.2,
	        };

	        var replacements = {
	            "'": "\\'",
	            '"': '\\"',
	            '\\': '\\\\',
	            '\b': '\\b',
	            '\f': '\\f',
	            '\n': '\\n',
	            '\r': '\\r',
	            '\t': '\\t',
	            '\v': '\\v',
	            '\0': '\\0',
	            '\u2028': '\\u2028',
	            '\u2029': '\\u2029',
	        };

	        var product = '';

	        for (var i = 0; i < value.length; i++) {
	            var c = value[i];
	            switch (c) {
	            case "'":
	            case '"':
	                quotes[c]++;
	                product += c;
	                continue

	            case '\0':
	                if (util.isDigit(value[i + 1])) {
	                    product += '\\x00';
	                    continue
	                }
	            }

	            if (replacements[c]) {
	                product += replacements[c];
	                continue
	            }

	            if (c < ' ') {
	                var hexString = c.charCodeAt(0).toString(16);
	                product += '\\x' + ('00' + hexString).substring(hexString.length);
	                continue
	            }

	            product += c;
	        }

	        var quoteChar = quote || Object.keys(quotes).reduce(function (a, b) { return (quotes[a] < quotes[b]) ? a : b; });

	        product = product.replace(new RegExp(quoteChar, 'g'), replacements[quoteChar]);

	        return quoteChar + product + quoteChar
	    }

	    function serializeObject (value) {
	        if (stack.indexOf(value) >= 0) {
	            throw TypeError('Converting circular structure to JSON5')
	        }

	        stack.push(value);

	        var stepback = indent;
	        indent = indent + gap;

	        var keys = propertyList || Object.keys(value);
	        var partial = [];
	        for (var i = 0, list = keys; i < list.length; i += 1) {
	            var key = list[i];

	            var propertyString = serializeProperty(key, value);
	            if (propertyString !== undefined) {
	                var member = serializeKey(key) + ':';
	                if (gap !== '') {
	                    member += ' ';
	                }
	                member += propertyString;
	                partial.push(member);
	            }
	        }

	        var final;
	        if (partial.length === 0) {
	            final = '{}';
	        } else {
	            var properties;
	            if (gap === '') {
	                properties = partial.join(',');
	                final = '{' + properties + '}';
	            } else {
	                var separator = ',\n' + indent;
	                properties = partial.join(separator);
	                final = '{\n' + indent + properties + ',\n' + stepback + '}';
	            }
	        }

	        stack.pop();
	        indent = stepback;
	        return final
	    }

	    function serializeKey (key) {
	        if (key.length === 0) {
	            return quoteString(key, true)
	        }

	        var firstChar = String.fromCodePoint(key.codePointAt(0));
	        if (!util.isIdStartChar(firstChar)) {
	            return quoteString(key, true)
	        }

	        for (var i = firstChar.length; i < key.length; i++) {
	            if (!util.isIdContinueChar(String.fromCodePoint(key.codePointAt(i)))) {
	                return quoteString(key, true)
	            }
	        }

	        return key
	    }

	    function serializeArray (value) {
	        if (stack.indexOf(value) >= 0) {
	            throw TypeError('Converting circular structure to JSON5')
	        }

	        stack.push(value);

	        var stepback = indent;
	        indent = indent + gap;

	        var partial = [];
	        for (var i = 0; i < value.length; i++) {
	            var propertyString = serializeProperty(String(i), value);
	            partial.push((propertyString !== undefined) ? propertyString : 'null');
	        }

	        var final;
	        if (partial.length === 0) {
	            final = '[]';
	        } else {
	            if (gap === '') {
	                var properties = partial.join(',');
	                final = '[' + properties + ']';
	            } else {
	                var separator = ',\n' + indent;
	                var properties$1 = partial.join(separator);
	                final = '[\n' + indent + properties$1 + ',\n' + stepback + ']';
	            }
	        }

	        stack.pop();
	        indent = stepback;
	        return final
	    }
	};

	var JSON5 = {
	    parse: parse,
	    stringify: stringify,
	};

	var lib = JSON5;

	var es5 = lib;

	return es5;

})));

},{}],88:[function(require,module,exports){
'use strict';

const w3 = {
  svg: 'http://www.w3.org/2000/svg',
  xlink: 'http://www.w3.org/1999/xlink',
  xmlns: 'http://www.w3.org/XML/1998/namespace'
};

module.exports = (w, h) => ['svg', {
  xmlns: w3.svg, 'xmlns:xlink': w3.xlink,
  width: w, height: h,
  viewBox: '0 0 ' + w + ' ' + h
}];

},{}],89:[function(require,module,exports){
'use strict';

const parse = require('./parse.js');
const stringify = require('./stringify.js');
const traverse = require('./traverse.js');
const renderer = require('./renderer.js');
const tt = require('./tt.js');
const genSvg = require('./gen-svg.js');

exports.renderer = renderer;
exports.parse = parse;
exports.stringify = stringify;
exports.traverse = traverse;
exports.tt = tt;

exports.gen = {
  svg: genSvg
};

exports.p = parse;
exports.s = stringify;
exports.t = traverse;

},{"./gen-svg.js":88,"./parse.js":90,"./renderer.js":91,"./stringify.js":92,"./traverse.js":93,"./tt.js":94}],90:[function(require,module,exports){
'use strict';

const parser = require('sax').parser;

function parse(data, config) {
  const res = [];
  const stack = [];
  let pointer = res;
  let trim = true;

  let strict = true;
  if (config && (config.strict !== undefined)) {
    strict = config.strict;
  }

  if (config !== undefined) {
    if (config.trim !== undefined) {
      trim = config.trim;
    }
  }

  const p = parser(strict);

  p.ontext = function (e) {
    if ((trim === false) || (e.trim() !== '')) {
      pointer.push(e);
    }
  };

  p.onopentag = function (e) {
    const leaf = [e.name, e.attributes];
    stack.push(pointer);
    pointer.push(leaf);
    pointer = leaf;
  };

  p.onclosetag = function () {
    pointer = stack.pop();
  };

  p.oncdata = function (e) {
    if ((trim === false) || (e.trim() !== '')) {
      pointer.push('<![CDATA[' + e + ']]>');
    }
  };

  p.write(data).close();
  return res[0];
}

module.exports = parse;

},{"sax":97}],91:[function(require,module,exports){
'use strict';

const stringify = require('./stringify.js');

const renderer = root => {
  const content = (typeof root === 'string')
    ? document.getElementById(root)
    : root;

  return ml => {
    let str;
    try {
      str = stringify(ml);
      content.innerHTML = str;
    } catch (err) {
      console.log(ml);
    }
  };
};

module.exports = renderer;

/* eslint-env browser */

},{"./stringify.js":92}],92:[function(require,module,exports){
'use strict';

const isObject = o => o && Object.prototype.toString.call(o) === '[object Object]';

function indenter (indentation) {
  if (!(indentation > 0)) {
    return txt => txt;
  }
  var space = ' '.repeat(indentation);
  return txt => {

    if (typeof txt !== 'string') {
      return txt;
    }

    const arr = txt.split('\n');

    if (arr.length === 1) {
      return space + txt;
    }

    return arr
      .map(e => (e.trim() === '') ? e : space + e)
      .join('\n');
  };
}

const clean = txt => txt
  .split('\n')
  .filter(e => e.trim() !== '')
  .join('\n');

function stringify (a, indentation) {
  const cr = (indentation > 0) ? '\n' : '';
  const indent = indenter(indentation);

  function rec(a) {
    let body = '';
    let isFlat = true;

    let res;
    const isEmpty = a.some((e, i, arr) => {
      if (i === 0) {
        res = '<' + e;
        return (arr.length === 1);
      }

      if (i === 1) {
        if (isObject(e)) {
          Object.keys(e).map(key => {
            let val = e[key];
            if (Array.isArray(val)) {
              val = val.join(' ');
            }
            res += ' ' + key + '="' + val + '"';
          });
          if (arr.length === 2) {
            return true;
          }
          res += '>';
          return;
        }
        res += '>';
      }

      switch (typeof e) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'undefined':
        body += e + cr;
        return;
      }

      isFlat = false;
      body += rec(e);
    });

    if (isEmpty) {
      return res + '/>' + cr; // short form
    }

    return isFlat
      ? res + clean(body) + '</' + a[0] + '>' + cr
      : res + cr + indent(body) + '</' + a[0] + '>' + cr;
  }

  return rec(a);
}

module.exports = stringify;

},{}],93:[function(require,module,exports){
'use strict';

function skipFn() {
  this._skip = true;
}

function removeFn() {
  this._remove = true;
}

function nameFn(name) {
  this._name = name;
}

function replaceFn(node) {
  this._replace = node;
}

function traverse(origin, callbacks) {
  const empty = function() {};

  const enter = callbacks && callbacks.enter || empty;
  const leave = callbacks && callbacks.leave || empty;


  function rec(tree, parent) {
    if (tree === undefined) return;
    if (tree === null) return;
    if (tree === true) return;
    if (tree === false) return;

    const node = {
      attr: {},
      full: tree
    };

    const cxt = {
      name: nameFn,
      skip: skipFn,
      // break: breakFn,
      remove: removeFn,
      replace: replaceFn,

      _name: undefined,
      _skip: false,
      // _break: false,
      _remove: false,
      _replace: undefined
    };

    let e1IsNotAnObject = true;

    switch (Object.prototype.toString.call(tree)) {
    case '[object String]':
    case '[object Number]':
      return;

    case '[object Array]':
      tree.some(function(e, i) {
        if (i === 0) {
          node.name = e;
          return false;
        }
        if (i === 1) {
          if (
            Object.prototype.toString.call(e) === '[object Object]'
          ) {
            e1IsNotAnObject = false;
            node.attr = e;
          }
          return true;
        }
      });

      enter.call(cxt, node, parent);

      if (cxt._name) {
        tree[0] = cxt._name;
      }

      if (cxt._replace) {
        return cxt._replace;
      }

      if (cxt._remove) {
        return null;
      }

      if (!cxt._skip) {
        let index = 0;
        let ilen = tree.length;
        while (index < ilen) {
          if ((index > 1) || ((index === 1) && e1IsNotAnObject)) {
            const returnRes = rec(tree[index], node);
            if (returnRes === null) {
              tree.splice(index, 1);
              ilen -= 1;
              continue;
            }
            if (returnRes) {
              tree[index] = returnRes;
            }
          }
          index += 1;
        }

        leave.call(cxt, node, parent);
        if (cxt._name) {
          tree[0] = cxt._name;
        }
        if (cxt._replace) {
          return cxt._replace;
        }
        if (cxt._remove) {
          return null;
        }
      }
    }
  }

  rec(origin, undefined);
}

module.exports = traverse;

/* eslint complexity: 0 */

},{}],94:[function(require,module,exports){
'use strict';

module.exports = (x, y, obj) => {
  let objt = {};
  if (x || y) {
    const tt = [x || 0].concat(y ? [y] : []);
    objt = {transform: 'translate(' + tt.join(',') + ')'};
  }
  obj = (typeof obj === 'object') ? obj : {};
  return Object.assign(objt, obj);
};

},{}],95:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],96:[function(require,module,exports){
/*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
/* eslint-disable node/no-deprecated-api */
var buffer = require('buffer')
var Buffer = buffer.Buffer

// alternative to using Object.keys for old browsers
function copyProps (src, dst) {
  for (var key in src) {
    dst[key] = src[key]
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  module.exports = buffer
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, exports)
  exports.Buffer = SafeBuffer
}

function SafeBuffer (arg, encodingOrOffset, length) {
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.prototype = Object.create(Buffer.prototype)

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer)

SafeBuffer.from = function (arg, encodingOrOffset, length) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.alloc = function (size, fill, encoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size)
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
  } else {
    buf.fill(0)
  }
  return buf
}

SafeBuffer.allocUnsafe = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
}

SafeBuffer.allocUnsafeSlow = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return buffer.SlowBuffer(size)
}

},{"buffer":76}],97:[function(require,module,exports){
(function (Buffer){(function (){
;(function (sax) { // wrapper for non-node envs
  sax.parser = function (strict, opt) { return new SAXParser(strict, opt) }
  sax.SAXParser = SAXParser
  sax.SAXStream = SAXStream
  sax.createStream = createStream

  // When we pass the MAX_BUFFER_LENGTH position, start checking for buffer overruns.
  // When we check, schedule the next check for MAX_BUFFER_LENGTH - (max(buffer lengths)),
  // since that's the earliest that a buffer overrun could occur.  This way, checks are
  // as rare as required, but as often as necessary to ensure never crossing this bound.
  // Furthermore, buffers are only tested at most once per write(), so passing a very
  // large string into write() might have undesirable effects, but this is manageable by
  // the caller, so it is assumed to be safe.  Thus, a call to write() may, in the extreme
  // edge case, result in creating at most one complete copy of the string passed in.
  // Set to Infinity to have unlimited buffers.
  sax.MAX_BUFFER_LENGTH = 64 * 1024

  var buffers = [
    'comment', 'sgmlDecl', 'textNode', 'tagName', 'doctype',
    'procInstName', 'procInstBody', 'entity', 'attribName',
    'attribValue', 'cdata', 'script'
  ]

  sax.EVENTS = [
    'text',
    'processinginstruction',
    'sgmldeclaration',
    'doctype',
    'comment',
    'opentagstart',
    'attribute',
    'opentag',
    'closetag',
    'opencdata',
    'cdata',
    'closecdata',
    'error',
    'end',
    'ready',
    'script',
    'opennamespace',
    'closenamespace'
  ]

  function SAXParser (strict, opt) {
    if (!(this instanceof SAXParser)) {
      return new SAXParser(strict, opt)
    }

    var parser = this
    clearBuffers(parser)
    parser.q = parser.c = ''
    parser.bufferCheckPosition = sax.MAX_BUFFER_LENGTH
    parser.opt = opt || {}
    parser.opt.lowercase = parser.opt.lowercase || parser.opt.lowercasetags
    parser.looseCase = parser.opt.lowercase ? 'toLowerCase' : 'toUpperCase'
    parser.tags = []
    parser.closed = parser.closedRoot = parser.sawRoot = false
    parser.tag = parser.error = null
    parser.strict = !!strict
    parser.noscript = !!(strict || parser.opt.noscript)
    parser.state = S.BEGIN
    parser.strictEntities = parser.opt.strictEntities
    parser.ENTITIES = parser.strictEntities ? Object.create(sax.XML_ENTITIES) : Object.create(sax.ENTITIES)
    parser.attribList = []

    // namespaces form a prototype chain.
    // it always points at the current tag,
    // which protos to its parent tag.
    if (parser.opt.xmlns) {
      parser.ns = Object.create(rootNS)
    }

    // disallow unquoted attribute values if not otherwise configured
    // and strict mode is true
    if (parser.opt.unquotedAttributeValues === undefined) {
      parser.opt.unquotedAttributeValues = !strict;
    }

    // mostly just for error reporting
    parser.trackPosition = parser.opt.position !== false
    if (parser.trackPosition) {
      parser.position = parser.line = parser.column = 0
    }
    emit(parser, 'onready')
  }

  if (!Object.create) {
    Object.create = function (o) {
      function F () {}
      F.prototype = o
      var newf = new F()
      return newf
    }
  }

  if (!Object.keys) {
    Object.keys = function (o) {
      var a = []
      for (var i in o) if (o.hasOwnProperty(i)) a.push(i)
      return a
    }
  }

  function checkBufferLength (parser) {
    var maxAllowed = Math.max(sax.MAX_BUFFER_LENGTH, 10)
    var maxActual = 0
    for (var i = 0, l = buffers.length; i < l; i++) {
      var len = parser[buffers[i]].length
      if (len > maxAllowed) {
        // Text/cdata nodes can get big, and since they're buffered,
        // we can get here under normal conditions.
        // Avoid issues by emitting the text node now,
        // so at least it won't get any bigger.
        switch (buffers[i]) {
          case 'textNode':
            closeText(parser)
            break

          case 'cdata':
            emitNode(parser, 'oncdata', parser.cdata)
            parser.cdata = ''
            break

          case 'script':
            emitNode(parser, 'onscript', parser.script)
            parser.script = ''
            break

          default:
            error(parser, 'Max buffer length exceeded: ' + buffers[i])
        }
      }
      maxActual = Math.max(maxActual, len)
    }
    // schedule the next check for the earliest possible buffer overrun.
    var m = sax.MAX_BUFFER_LENGTH - maxActual
    parser.bufferCheckPosition = m + parser.position
  }

  function clearBuffers (parser) {
    for (var i = 0, l = buffers.length; i < l; i++) {
      parser[buffers[i]] = ''
    }
  }

  function flushBuffers (parser) {
    closeText(parser)
    if (parser.cdata !== '') {
      emitNode(parser, 'oncdata', parser.cdata)
      parser.cdata = ''
    }
    if (parser.script !== '') {
      emitNode(parser, 'onscript', parser.script)
      parser.script = ''
    }
  }

  SAXParser.prototype = {
    end: function () { end(this) },
    write: write,
    resume: function () { this.error = null; return this },
    close: function () { return this.write(null) },
    flush: function () { flushBuffers(this) }
  }

  var Stream
  try {
    Stream = require('stream').Stream
  } catch (ex) {
    Stream = function () {}
  }
  if (!Stream) Stream = function () {}

  var streamWraps = sax.EVENTS.filter(function (ev) {
    return ev !== 'error' && ev !== 'end'
  })

  function createStream (strict, opt) {
    return new SAXStream(strict, opt)
  }

  function SAXStream (strict, opt) {
    if (!(this instanceof SAXStream)) {
      return new SAXStream(strict, opt)
    }

    Stream.apply(this)

    this._parser = new SAXParser(strict, opt)
    this.writable = true
    this.readable = true

    var me = this

    this._parser.onend = function () {
      me.emit('end')
    }

    this._parser.onerror = function (er) {
      me.emit('error', er)

      // if didn't throw, then means error was handled.
      // go ahead and clear error, so we can write again.
      me._parser.error = null
    }

    this._decoder = null

    streamWraps.forEach(function (ev) {
      Object.defineProperty(me, 'on' + ev, {
        get: function () {
          return me._parser['on' + ev]
        },
        set: function (h) {
          if (!h) {
            me.removeAllListeners(ev)
            me._parser['on' + ev] = h
            return h
          }
          me.on(ev, h)
        },
        enumerable: true,
        configurable: false
      })
    })
  }

  SAXStream.prototype = Object.create(Stream.prototype, {
    constructor: {
      value: SAXStream
    }
  })

  SAXStream.prototype.write = function (data) {
    if (typeof Buffer === 'function' &&
      typeof Buffer.isBuffer === 'function' &&
      Buffer.isBuffer(data)) {
      if (!this._decoder) {
        var SD = require('string_decoder').StringDecoder
        this._decoder = new SD('utf8')
      }
      data = this._decoder.write(data)
    }

    this._parser.write(data.toString())
    this.emit('data', data)
    return true
  }

  SAXStream.prototype.end = function (chunk) {
    if (chunk && chunk.length) {
      this.write(chunk)
    }
    this._parser.end()
    return true
  }

  SAXStream.prototype.on = function (ev, handler) {
    var me = this
    if (!me._parser['on' + ev] && streamWraps.indexOf(ev) !== -1) {
      me._parser['on' + ev] = function () {
        var args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments)
        args.splice(0, 0, ev)
        me.emit.apply(me, args)
      }
    }

    return Stream.prototype.on.call(me, ev, handler)
  }

  // this really needs to be replaced with character classes.
  // XML allows all manner of ridiculous numbers and digits.
  var CDATA = '[CDATA['
  var DOCTYPE = 'DOCTYPE'
  var XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace'
  var XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/'
  var rootNS = { xml: XML_NAMESPACE, xmlns: XMLNS_NAMESPACE }

  // http://www.w3.org/TR/REC-xml/#NT-NameStartChar
  // This implementation works on strings, a single character at a time
  // as such, it cannot ever support astral-plane characters (10000-EFFFF)
  // without a significant breaking change to either this  parser, or the
  // JavaScript language.  Implementation of an emoji-capable xml parser
  // is left as an exercise for the reader.
  var nameStart = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/

  var nameBody = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/

  var entityStart = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/
  var entityBody = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/

  function isWhitespace (c) {
    return c === ' ' || c === '\n' || c === '\r' || c === '\t'
  }

  function isQuote (c) {
    return c === '"' || c === '\''
  }

  function isAttribEnd (c) {
    return c === '>' || isWhitespace(c)
  }

  function isMatch (regex, c) {
    return regex.test(c)
  }

  function notMatch (regex, c) {
    return !isMatch(regex, c)
  }

  var S = 0
  sax.STATE = {
    BEGIN: S++, // leading byte order mark or whitespace
    BEGIN_WHITESPACE: S++, // leading whitespace
    TEXT: S++, // general stuff
    TEXT_ENTITY: S++, // &amp and such.
    OPEN_WAKA: S++, // <
    SGML_DECL: S++, // <!BLARG
    SGML_DECL_QUOTED: S++, // <!BLARG foo "bar
    DOCTYPE: S++, // <!DOCTYPE
    DOCTYPE_QUOTED: S++, // <!DOCTYPE "//blah
    DOCTYPE_DTD: S++, // <!DOCTYPE "//blah" [ ...
    DOCTYPE_DTD_QUOTED: S++, // <!DOCTYPE "//blah" [ "foo
    COMMENT_STARTING: S++, // <!-
    COMMENT: S++, // <!--
    COMMENT_ENDING: S++, // <!-- blah -
    COMMENT_ENDED: S++, // <!-- blah --
    CDATA: S++, // <![CDATA[ something
    CDATA_ENDING: S++, // ]
    CDATA_ENDING_2: S++, // ]]
    PROC_INST: S++, // <?hi
    PROC_INST_BODY: S++, // <?hi there
    PROC_INST_ENDING: S++, // <?hi "there" ?
    OPEN_TAG: S++, // <strong
    OPEN_TAG_SLASH: S++, // <strong /
    ATTRIB: S++, // <a
    ATTRIB_NAME: S++, // <a foo
    ATTRIB_NAME_SAW_WHITE: S++, // <a foo _
    ATTRIB_VALUE: S++, // <a foo=
    ATTRIB_VALUE_QUOTED: S++, // <a foo="bar
    ATTRIB_VALUE_CLOSED: S++, // <a foo="bar"
    ATTRIB_VALUE_UNQUOTED: S++, // <a foo=bar
    ATTRIB_VALUE_ENTITY_Q: S++, // <foo bar="&quot;"
    ATTRIB_VALUE_ENTITY_U: S++, // <foo bar=&quot
    CLOSE_TAG: S++, // </a
    CLOSE_TAG_SAW_WHITE: S++, // </a   >
    SCRIPT: S++, // <script> ...
    SCRIPT_ENDING: S++ // <script> ... <
  }

  sax.XML_ENTITIES = {
    'amp': '&',
    'gt': '>',
    'lt': '<',
    'quot': '"',
    'apos': "'"
  }

  sax.ENTITIES = {
    'amp': '&',
    'gt': '>',
    'lt': '<',
    'quot': '"',
    'apos': "'",
    'AElig': 198,
    'Aacute': 193,
    'Acirc': 194,
    'Agrave': 192,
    'Aring': 197,
    'Atilde': 195,
    'Auml': 196,
    'Ccedil': 199,
    'ETH': 208,
    'Eacute': 201,
    'Ecirc': 202,
    'Egrave': 200,
    'Euml': 203,
    'Iacute': 205,
    'Icirc': 206,
    'Igrave': 204,
    'Iuml': 207,
    'Ntilde': 209,
    'Oacute': 211,
    'Ocirc': 212,
    'Ograve': 210,
    'Oslash': 216,
    'Otilde': 213,
    'Ouml': 214,
    'THORN': 222,
    'Uacute': 218,
    'Ucirc': 219,
    'Ugrave': 217,
    'Uuml': 220,
    'Yacute': 221,
    'aacute': 225,
    'acirc': 226,
    'aelig': 230,
    'agrave': 224,
    'aring': 229,
    'atilde': 227,
    'auml': 228,
    'ccedil': 231,
    'eacute': 233,
    'ecirc': 234,
    'egrave': 232,
    'eth': 240,
    'euml': 235,
    'iacute': 237,
    'icirc': 238,
    'igrave': 236,
    'iuml': 239,
    'ntilde': 241,
    'oacute': 243,
    'ocirc': 244,
    'ograve': 242,
    'oslash': 248,
    'otilde': 245,
    'ouml': 246,
    'szlig': 223,
    'thorn': 254,
    'uacute': 250,
    'ucirc': 251,
    'ugrave': 249,
    'uuml': 252,
    'yacute': 253,
    'yuml': 255,
    'copy': 169,
    'reg': 174,
    'nbsp': 160,
    'iexcl': 161,
    'cent': 162,
    'pound': 163,
    'curren': 164,
    'yen': 165,
    'brvbar': 166,
    'sect': 167,
    'uml': 168,
    'ordf': 170,
    'laquo': 171,
    'not': 172,
    'shy': 173,
    'macr': 175,
    'deg': 176,
    'plusmn': 177,
    'sup1': 185,
    'sup2': 178,
    'sup3': 179,
    'acute': 180,
    'micro': 181,
    'para': 182,
    'middot': 183,
    'cedil': 184,
    'ordm': 186,
    'raquo': 187,
    'frac14': 188,
    'frac12': 189,
    'frac34': 190,
    'iquest': 191,
    'times': 215,
    'divide': 247,
    'OElig': 338,
    'oelig': 339,
    'Scaron': 352,
    'scaron': 353,
    'Yuml': 376,
    'fnof': 402,
    'circ': 710,
    'tilde': 732,
    'Alpha': 913,
    'Beta': 914,
    'Gamma': 915,
    'Delta': 916,
    'Epsilon': 917,
    'Zeta': 918,
    'Eta': 919,
    'Theta': 920,
    'Iota': 921,
    'Kappa': 922,
    'Lambda': 923,
    'Mu': 924,
    'Nu': 925,
    'Xi': 926,
    'Omicron': 927,
    'Pi': 928,
    'Rho': 929,
    'Sigma': 931,
    'Tau': 932,
    'Upsilon': 933,
    'Phi': 934,
    'Chi': 935,
    'Psi': 936,
    'Omega': 937,
    'alpha': 945,
    'beta': 946,
    'gamma': 947,
    'delta': 948,
    'epsilon': 949,
    'zeta': 950,
    'eta': 951,
    'theta': 952,
    'iota': 953,
    'kappa': 954,
    'lambda': 955,
    'mu': 956,
    'nu': 957,
    'xi': 958,
    'omicron': 959,
    'pi': 960,
    'rho': 961,
    'sigmaf': 962,
    'sigma': 963,
    'tau': 964,
    'upsilon': 965,
    'phi': 966,
    'chi': 967,
    'psi': 968,
    'omega': 969,
    'thetasym': 977,
    'upsih': 978,
    'piv': 982,
    'ensp': 8194,
    'emsp': 8195,
    'thinsp': 8201,
    'zwnj': 8204,
    'zwj': 8205,
    'lrm': 8206,
    'rlm': 8207,
    'ndash': 8211,
    'mdash': 8212,
    'lsquo': 8216,
    'rsquo': 8217,
    'sbquo': 8218,
    'ldquo': 8220,
    'rdquo': 8221,
    'bdquo': 8222,
    'dagger': 8224,
    'Dagger': 8225,
    'bull': 8226,
    'hellip': 8230,
    'permil': 8240,
    'prime': 8242,
    'Prime': 8243,
    'lsaquo': 8249,
    'rsaquo': 8250,
    'oline': 8254,
    'frasl': 8260,
    'euro': 8364,
    'image': 8465,
    'weierp': 8472,
    'real': 8476,
    'trade': 8482,
    'alefsym': 8501,
    'larr': 8592,
    'uarr': 8593,
    'rarr': 8594,
    'darr': 8595,
    'harr': 8596,
    'crarr': 8629,
    'lArr': 8656,
    'uArr': 8657,
    'rArr': 8658,
    'dArr': 8659,
    'hArr': 8660,
    'forall': 8704,
    'part': 8706,
    'exist': 8707,
    'empty': 8709,
    'nabla': 8711,
    'isin': 8712,
    'notin': 8713,
    'ni': 8715,
    'prod': 8719,
    'sum': 8721,
    'minus': 8722,
    'lowast': 8727,
    'radic': 8730,
    'prop': 8733,
    'infin': 8734,
    'ang': 8736,
    'and': 8743,
    'or': 8744,
    'cap': 8745,
    'cup': 8746,
    'int': 8747,
    'there4': 8756,
    'sim': 8764,
    'cong': 8773,
    'asymp': 8776,
    'ne': 8800,
    'equiv': 8801,
    'le': 8804,
    'ge': 8805,
    'sub': 8834,
    'sup': 8835,
    'nsub': 8836,
    'sube': 8838,
    'supe': 8839,
    'oplus': 8853,
    'otimes': 8855,
    'perp': 8869,
    'sdot': 8901,
    'lceil': 8968,
    'rceil': 8969,
    'lfloor': 8970,
    'rfloor': 8971,
    'lang': 9001,
    'rang': 9002,
    'loz': 9674,
    'spades': 9824,
    'clubs': 9827,
    'hearts': 9829,
    'diams': 9830
  }

  Object.keys(sax.ENTITIES).forEach(function (key) {
    var e = sax.ENTITIES[key]
    var s = typeof e === 'number' ? String.fromCharCode(e) : e
    sax.ENTITIES[key] = s
  })

  for (var s in sax.STATE) {
    sax.STATE[sax.STATE[s]] = s
  }

  // shorthand
  S = sax.STATE

  function emit (parser, event, data) {
    parser[event] && parser[event](data)
  }

  function emitNode (parser, nodeType, data) {
    if (parser.textNode) closeText(parser)
    emit(parser, nodeType, data)
  }

  function closeText (parser) {
    parser.textNode = textopts(parser.opt, parser.textNode)
    if (parser.textNode) emit(parser, 'ontext', parser.textNode)
    parser.textNode = ''
  }

  function textopts (opt, text) {
    if (opt.trim) text = text.trim()
    if (opt.normalize) text = text.replace(/\s+/g, ' ')
    return text
  }

  function error (parser, er) {
    closeText(parser)
    if (parser.trackPosition) {
      er += '\nLine: ' + parser.line +
        '\nColumn: ' + parser.column +
        '\nChar: ' + parser.c
    }
    er = new Error(er)
    parser.error = er
    emit(parser, 'onerror', er)
    return parser
  }

  function end (parser) {
    if (parser.sawRoot && !parser.closedRoot) strictFail(parser, 'Unclosed root tag')
    if ((parser.state !== S.BEGIN) &&
      (parser.state !== S.BEGIN_WHITESPACE) &&
      (parser.state !== S.TEXT)) {
      error(parser, 'Unexpected end')
    }
    closeText(parser)
    parser.c = ''
    parser.closed = true
    emit(parser, 'onend')
    SAXParser.call(parser, parser.strict, parser.opt)
    return parser
  }

  function strictFail (parser, message) {
    if (typeof parser !== 'object' || !(parser instanceof SAXParser)) {
      throw new Error('bad call to strictFail')
    }
    if (parser.strict) {
      error(parser, message)
    }
  }

  function newTag (parser) {
    if (!parser.strict) parser.tagName = parser.tagName[parser.looseCase]()
    var parent = parser.tags[parser.tags.length - 1] || parser
    var tag = parser.tag = { name: parser.tagName, attributes: {} }

    // will be overridden if tag contails an xmlns="foo" or xmlns:foo="bar"
    if (parser.opt.xmlns) {
      tag.ns = parent.ns
    }
    parser.attribList.length = 0
    emitNode(parser, 'onopentagstart', tag)
  }

  function qname (name, attribute) {
    var i = name.indexOf(':')
    var qualName = i < 0 ? [ '', name ] : name.split(':')
    var prefix = qualName[0]
    var local = qualName[1]

    // <x "xmlns"="http://foo">
    if (attribute && name === 'xmlns') {
      prefix = 'xmlns'
      local = ''
    }

    return { prefix: prefix, local: local }
  }

  function attrib (parser) {
    if (!parser.strict) {
      parser.attribName = parser.attribName[parser.looseCase]()
    }

    if (parser.attribList.indexOf(parser.attribName) !== -1 ||
      parser.tag.attributes.hasOwnProperty(parser.attribName)) {
      parser.attribName = parser.attribValue = ''
      return
    }

    if (parser.opt.xmlns) {
      var qn = qname(parser.attribName, true)
      var prefix = qn.prefix
      var local = qn.local

      if (prefix === 'xmlns') {
        // namespace binding attribute. push the binding into scope
        if (local === 'xml' && parser.attribValue !== XML_NAMESPACE) {
          strictFail(parser,
            'xml: prefix must be bound to ' + XML_NAMESPACE + '\n' +
            'Actual: ' + parser.attribValue)
        } else if (local === 'xmlns' && parser.attribValue !== XMLNS_NAMESPACE) {
          strictFail(parser,
            'xmlns: prefix must be bound to ' + XMLNS_NAMESPACE + '\n' +
            'Actual: ' + parser.attribValue)
        } else {
          var tag = parser.tag
          var parent = parser.tags[parser.tags.length - 1] || parser
          if (tag.ns === parent.ns) {
            tag.ns = Object.create(parent.ns)
          }
          tag.ns[local] = parser.attribValue
        }
      }

      // defer onattribute events until all attributes have been seen
      // so any new bindings can take effect. preserve attribute order
      // so deferred events can be emitted in document order
      parser.attribList.push([parser.attribName, parser.attribValue])
    } else {
      // in non-xmlns mode, we can emit the event right away
      parser.tag.attributes[parser.attribName] = parser.attribValue
      emitNode(parser, 'onattribute', {
        name: parser.attribName,
        value: parser.attribValue
      })
    }

    parser.attribName = parser.attribValue = ''
  }

  function openTag (parser, selfClosing) {
    if (parser.opt.xmlns) {
      // emit namespace binding events
      var tag = parser.tag

      // add namespace info to tag
      var qn = qname(parser.tagName)
      tag.prefix = qn.prefix
      tag.local = qn.local
      tag.uri = tag.ns[qn.prefix] || ''

      if (tag.prefix && !tag.uri) {
        strictFail(parser, 'Unbound namespace prefix: ' +
          JSON.stringify(parser.tagName))
        tag.uri = qn.prefix
      }

      var parent = parser.tags[parser.tags.length - 1] || parser
      if (tag.ns && parent.ns !== tag.ns) {
        Object.keys(tag.ns).forEach(function (p) {
          emitNode(parser, 'onopennamespace', {
            prefix: p,
            uri: tag.ns[p]
          })
        })
      }

      // handle deferred onattribute events
      // Note: do not apply default ns to attributes:
      //   http://www.w3.org/TR/REC-xml-names/#defaulting
      for (var i = 0, l = parser.attribList.length; i < l; i++) {
        var nv = parser.attribList[i]
        var name = nv[0]
        var value = nv[1]
        var qualName = qname(name, true)
        var prefix = qualName.prefix
        var local = qualName.local
        var uri = prefix === '' ? '' : (tag.ns[prefix] || '')
        var a = {
          name: name,
          value: value,
          prefix: prefix,
          local: local,
          uri: uri
        }

        // if there's any attributes with an undefined namespace,
        // then fail on them now.
        if (prefix && prefix !== 'xmlns' && !uri) {
          strictFail(parser, 'Unbound namespace prefix: ' +
            JSON.stringify(prefix))
          a.uri = prefix
        }
        parser.tag.attributes[name] = a
        emitNode(parser, 'onattribute', a)
      }
      parser.attribList.length = 0
    }

    parser.tag.isSelfClosing = !!selfClosing

    // process the tag
    parser.sawRoot = true
    parser.tags.push(parser.tag)
    emitNode(parser, 'onopentag', parser.tag)
    if (!selfClosing) {
      // special case for <script> in non-strict mode.
      if (!parser.noscript && parser.tagName.toLowerCase() === 'script') {
        parser.state = S.SCRIPT
      } else {
        parser.state = S.TEXT
      }
      parser.tag = null
      parser.tagName = ''
    }
    parser.attribName = parser.attribValue = ''
    parser.attribList.length = 0
  }

  function closeTag (parser) {
    if (!parser.tagName) {
      strictFail(parser, 'Weird empty close tag.')
      parser.textNode += '</>'
      parser.state = S.TEXT
      return
    }

    if (parser.script) {
      if (parser.tagName !== 'script') {
        parser.script += '</' + parser.tagName + '>'
        parser.tagName = ''
        parser.state = S.SCRIPT
        return
      }
      emitNode(parser, 'onscript', parser.script)
      parser.script = ''
    }

    // first make sure that the closing tag actually exists.
    // <a><b></c></b></a> will close everything, otherwise.
    var t = parser.tags.length
    var tagName = parser.tagName
    if (!parser.strict) {
      tagName = tagName[parser.looseCase]()
    }
    var closeTo = tagName
    while (t--) {
      var close = parser.tags[t]
      if (close.name !== closeTo) {
        // fail the first time in strict mode
        strictFail(parser, 'Unexpected close tag')
      } else {
        break
      }
    }

    // didn't find it.  we already failed for strict, so just abort.
    if (t < 0) {
      strictFail(parser, 'Unmatched closing tag: ' + parser.tagName)
      parser.textNode += '</' + parser.tagName + '>'
      parser.state = S.TEXT
      return
    }
    parser.tagName = tagName
    var s = parser.tags.length
    while (s-- > t) {
      var tag = parser.tag = parser.tags.pop()
      parser.tagName = parser.tag.name
      emitNode(parser, 'onclosetag', parser.tagName)

      var x = {}
      for (var i in tag.ns) {
        x[i] = tag.ns[i]
      }

      var parent = parser.tags[parser.tags.length - 1] || parser
      if (parser.opt.xmlns && tag.ns !== parent.ns) {
        // remove namespace bindings introduced by tag
        Object.keys(tag.ns).forEach(function (p) {
          var n = tag.ns[p]
          emitNode(parser, 'onclosenamespace', { prefix: p, uri: n })
        })
      }
    }
    if (t === 0) parser.closedRoot = true
    parser.tagName = parser.attribValue = parser.attribName = ''
    parser.attribList.length = 0
    parser.state = S.TEXT
  }

  function parseEntity (parser) {
    var entity = parser.entity
    var entityLC = entity.toLowerCase()
    var num
    var numStr = ''

    if (parser.ENTITIES[entity]) {
      return parser.ENTITIES[entity]
    }
    if (parser.ENTITIES[entityLC]) {
      return parser.ENTITIES[entityLC]
    }
    entity = entityLC
    if (entity.charAt(0) === '#') {
      if (entity.charAt(1) === 'x') {
        entity = entity.slice(2)
        num = parseInt(entity, 16)
        numStr = num.toString(16)
      } else {
        entity = entity.slice(1)
        num = parseInt(entity, 10)
        numStr = num.toString(10)
      }
    }
    entity = entity.replace(/^0+/, '')
    if (isNaN(num) || numStr.toLowerCase() !== entity) {
      strictFail(parser, 'Invalid character entity')
      return '&' + parser.entity + ';'
    }

    return String.fromCodePoint(num)
  }

  function beginWhiteSpace (parser, c) {
    if (c === '<') {
      parser.state = S.OPEN_WAKA
      parser.startTagPosition = parser.position
    } else if (!isWhitespace(c)) {
      // have to process this as a text node.
      // weird, but happens.
      strictFail(parser, 'Non-whitespace before first tag.')
      parser.textNode = c
      parser.state = S.TEXT
    }
  }

  function charAt (chunk, i) {
    var result = ''
    if (i < chunk.length) {
      result = chunk.charAt(i)
    }
    return result
  }

  function write (chunk) {
    var parser = this
    if (this.error) {
      throw this.error
    }
    if (parser.closed) {
      return error(parser,
        'Cannot write after close. Assign an onready handler.')
    }
    if (chunk === null) {
      return end(parser)
    }
    if (typeof chunk === 'object') {
      chunk = chunk.toString()
    }
    var i = 0
    var c = ''
    while (true) {
      c = charAt(chunk, i++)
      parser.c = c

      if (!c) {
        break
      }

      if (parser.trackPosition) {
        parser.position++
        if (c === '\n') {
          parser.line++
          parser.column = 0
        } else {
          parser.column++
        }
      }

      switch (parser.state) {
        case S.BEGIN:
          parser.state = S.BEGIN_WHITESPACE
          if (c === '\uFEFF') {
            continue
          }
          beginWhiteSpace(parser, c)
          continue

        case S.BEGIN_WHITESPACE:
          beginWhiteSpace(parser, c)
          continue

        case S.TEXT:
          if (parser.sawRoot && !parser.closedRoot) {
            var starti = i - 1
            while (c && c !== '<' && c !== '&') {
              c = charAt(chunk, i++)
              if (c && parser.trackPosition) {
                parser.position++
                if (c === '\n') {
                  parser.line++
                  parser.column = 0
                } else {
                  parser.column++
                }
              }
            }
            parser.textNode += chunk.substring(starti, i - 1)
          }
          if (c === '<' && !(parser.sawRoot && parser.closedRoot && !parser.strict)) {
            parser.state = S.OPEN_WAKA
            parser.startTagPosition = parser.position
          } else {
            if (!isWhitespace(c) && (!parser.sawRoot || parser.closedRoot)) {
              strictFail(parser, 'Text data outside of root node.')
            }
            if (c === '&') {
              parser.state = S.TEXT_ENTITY
            } else {
              parser.textNode += c
            }
          }
          continue

        case S.SCRIPT:
          // only non-strict
          if (c === '<') {
            parser.state = S.SCRIPT_ENDING
          } else {
            parser.script += c
          }
          continue

        case S.SCRIPT_ENDING:
          if (c === '/') {
            parser.state = S.CLOSE_TAG
          } else {
            parser.script += '<' + c
            parser.state = S.SCRIPT
          }
          continue

        case S.OPEN_WAKA:
          // either a /, ?, !, or text is coming next.
          if (c === '!') {
            parser.state = S.SGML_DECL
            parser.sgmlDecl = ''
          } else if (isWhitespace(c)) {
            // wait for it...
          } else if (isMatch(nameStart, c)) {
            parser.state = S.OPEN_TAG
            parser.tagName = c
          } else if (c === '/') {
            parser.state = S.CLOSE_TAG
            parser.tagName = ''
          } else if (c === '?') {
            parser.state = S.PROC_INST
            parser.procInstName = parser.procInstBody = ''
          } else {
            strictFail(parser, 'Unencoded <')
            // if there was some whitespace, then add that in.
            if (parser.startTagPosition + 1 < parser.position) {
              var pad = parser.position - parser.startTagPosition
              c = new Array(pad).join(' ') + c
            }
            parser.textNode += '<' + c
            parser.state = S.TEXT
          }
          continue

        case S.SGML_DECL:
          if (parser.sgmlDecl + c === '--') {
            parser.state = S.COMMENT
            parser.comment = ''
            parser.sgmlDecl = ''
            continue;
          }

          if (parser.doctype && parser.doctype !== true && parser.sgmlDecl) {
            parser.state = S.DOCTYPE_DTD
            parser.doctype += '<!' + parser.sgmlDecl + c
            parser.sgmlDecl = ''
          } else if ((parser.sgmlDecl + c).toUpperCase() === CDATA) {
            emitNode(parser, 'onopencdata')
            parser.state = S.CDATA
            parser.sgmlDecl = ''
            parser.cdata = ''
          } else if ((parser.sgmlDecl + c).toUpperCase() === DOCTYPE) {
            parser.state = S.DOCTYPE
            if (parser.doctype || parser.sawRoot) {
              strictFail(parser,
                'Inappropriately located doctype declaration')
            }
            parser.doctype = ''
            parser.sgmlDecl = ''
          } else if (c === '>') {
            emitNode(parser, 'onsgmldeclaration', parser.sgmlDecl)
            parser.sgmlDecl = ''
            parser.state = S.TEXT
          } else if (isQuote(c)) {
            parser.state = S.SGML_DECL_QUOTED
            parser.sgmlDecl += c
          } else {
            parser.sgmlDecl += c
          }
          continue

        case S.SGML_DECL_QUOTED:
          if (c === parser.q) {
            parser.state = S.SGML_DECL
            parser.q = ''
          }
          parser.sgmlDecl += c
          continue

        case S.DOCTYPE:
          if (c === '>') {
            parser.state = S.TEXT
            emitNode(parser, 'ondoctype', parser.doctype)
            parser.doctype = true // just remember that we saw it.
          } else {
            parser.doctype += c
            if (c === '[') {
              parser.state = S.DOCTYPE_DTD
            } else if (isQuote(c)) {
              parser.state = S.DOCTYPE_QUOTED
              parser.q = c
            }
          }
          continue

        case S.DOCTYPE_QUOTED:
          parser.doctype += c
          if (c === parser.q) {
            parser.q = ''
            parser.state = S.DOCTYPE
          }
          continue

        case S.DOCTYPE_DTD:
          if (c === ']') {
            parser.doctype += c
            parser.state = S.DOCTYPE
          } else if (c === '<') {
            parser.state = S.OPEN_WAKA
            parser.startTagPosition = parser.position
          } else if (isQuote(c)) {
            parser.doctype += c
            parser.state = S.DOCTYPE_DTD_QUOTED
            parser.q = c
          } else {
            parser.doctype += c
          }
          continue

        case S.DOCTYPE_DTD_QUOTED:
          parser.doctype += c
          if (c === parser.q) {
            parser.state = S.DOCTYPE_DTD
            parser.q = ''
          }
          continue

        case S.COMMENT:
          if (c === '-') {
            parser.state = S.COMMENT_ENDING
          } else {
            parser.comment += c
          }
          continue

        case S.COMMENT_ENDING:
          if (c === '-') {
            parser.state = S.COMMENT_ENDED
            parser.comment = textopts(parser.opt, parser.comment)
            if (parser.comment) {
              emitNode(parser, 'oncomment', parser.comment)
            }
            parser.comment = ''
          } else {
            parser.comment += '-' + c
            parser.state = S.COMMENT
          }
          continue

        case S.COMMENT_ENDED:
          if (c !== '>') {
            strictFail(parser, 'Malformed comment')
            // allow <!-- blah -- bloo --> in non-strict mode,
            // which is a comment of " blah -- bloo "
            parser.comment += '--' + c
            parser.state = S.COMMENT
          } else if (parser.doctype && parser.doctype !== true) {
            parser.state = S.DOCTYPE_DTD
          } else {
            parser.state = S.TEXT
          }
          continue

        case S.CDATA:
          if (c === ']') {
            parser.state = S.CDATA_ENDING
          } else {
            parser.cdata += c
          }
          continue

        case S.CDATA_ENDING:
          if (c === ']') {
            parser.state = S.CDATA_ENDING_2
          } else {
            parser.cdata += ']' + c
            parser.state = S.CDATA
          }
          continue

        case S.CDATA_ENDING_2:
          if (c === '>') {
            if (parser.cdata) {
              emitNode(parser, 'oncdata', parser.cdata)
            }
            emitNode(parser, 'onclosecdata')
            parser.cdata = ''
            parser.state = S.TEXT
          } else if (c === ']') {
            parser.cdata += ']'
          } else {
            parser.cdata += ']]' + c
            parser.state = S.CDATA
          }
          continue

        case S.PROC_INST:
          if (c === '?') {
            parser.state = S.PROC_INST_ENDING
          } else if (isWhitespace(c)) {
            parser.state = S.PROC_INST_BODY
          } else {
            parser.procInstName += c
          }
          continue

        case S.PROC_INST_BODY:
          if (!parser.procInstBody && isWhitespace(c)) {
            continue
          } else if (c === '?') {
            parser.state = S.PROC_INST_ENDING
          } else {
            parser.procInstBody += c
          }
          continue

        case S.PROC_INST_ENDING:
          if (c === '>') {
            emitNode(parser, 'onprocessinginstruction', {
              name: parser.procInstName,
              body: parser.procInstBody
            })
            parser.procInstName = parser.procInstBody = ''
            parser.state = S.TEXT
          } else {
            parser.procInstBody += '?' + c
            parser.state = S.PROC_INST_BODY
          }
          continue

        case S.OPEN_TAG:
          if (isMatch(nameBody, c)) {
            parser.tagName += c
          } else {
            newTag(parser)
            if (c === '>') {
              openTag(parser)
            } else if (c === '/') {
              parser.state = S.OPEN_TAG_SLASH
            } else {
              if (!isWhitespace(c)) {
                strictFail(parser, 'Invalid character in tag name')
              }
              parser.state = S.ATTRIB
            }
          }
          continue

        case S.OPEN_TAG_SLASH:
          if (c === '>') {
            openTag(parser, true)
            closeTag(parser)
          } else {
            strictFail(parser, 'Forward-slash in opening tag not followed by >')
            parser.state = S.ATTRIB
          }
          continue

        case S.ATTRIB:
          // haven't read the attribute name yet.
          if (isWhitespace(c)) {
            continue
          } else if (c === '>') {
            openTag(parser)
          } else if (c === '/') {
            parser.state = S.OPEN_TAG_SLASH
          } else if (isMatch(nameStart, c)) {
            parser.attribName = c
            parser.attribValue = ''
            parser.state = S.ATTRIB_NAME
          } else {
            strictFail(parser, 'Invalid attribute name')
          }
          continue

        case S.ATTRIB_NAME:
          if (c === '=') {
            parser.state = S.ATTRIB_VALUE
          } else if (c === '>') {
            strictFail(parser, 'Attribute without value')
            parser.attribValue = parser.attribName
            attrib(parser)
            openTag(parser)
          } else if (isWhitespace(c)) {
            parser.state = S.ATTRIB_NAME_SAW_WHITE
          } else if (isMatch(nameBody, c)) {
            parser.attribName += c
          } else {
            strictFail(parser, 'Invalid attribute name')
          }
          continue

        case S.ATTRIB_NAME_SAW_WHITE:
          if (c === '=') {
            parser.state = S.ATTRIB_VALUE
          } else if (isWhitespace(c)) {
            continue
          } else {
            strictFail(parser, 'Attribute without value')
            parser.tag.attributes[parser.attribName] = ''
            parser.attribValue = ''
            emitNode(parser, 'onattribute', {
              name: parser.attribName,
              value: ''
            })
            parser.attribName = ''
            if (c === '>') {
              openTag(parser)
            } else if (isMatch(nameStart, c)) {
              parser.attribName = c
              parser.state = S.ATTRIB_NAME
            } else {
              strictFail(parser, 'Invalid attribute name')
              parser.state = S.ATTRIB
            }
          }
          continue

        case S.ATTRIB_VALUE:
          if (isWhitespace(c)) {
            continue
          } else if (isQuote(c)) {
            parser.q = c
            parser.state = S.ATTRIB_VALUE_QUOTED
          } else {
            if (!parser.opt.unquotedAttributeValues) {
              error(parser, 'Unquoted attribute value')
            }
            parser.state = S.ATTRIB_VALUE_UNQUOTED
            parser.attribValue = c
          }
          continue

        case S.ATTRIB_VALUE_QUOTED:
          if (c !== parser.q) {
            if (c === '&') {
              parser.state = S.ATTRIB_VALUE_ENTITY_Q
            } else {
              parser.attribValue += c
            }
            continue
          }
          attrib(parser)
          parser.q = ''
          parser.state = S.ATTRIB_VALUE_CLOSED
          continue

        case S.ATTRIB_VALUE_CLOSED:
          if (isWhitespace(c)) {
            parser.state = S.ATTRIB
          } else if (c === '>') {
            openTag(parser)
          } else if (c === '/') {
            parser.state = S.OPEN_TAG_SLASH
          } else if (isMatch(nameStart, c)) {
            strictFail(parser, 'No whitespace between attributes')
            parser.attribName = c
            parser.attribValue = ''
            parser.state = S.ATTRIB_NAME
          } else {
            strictFail(parser, 'Invalid attribute name')
          }
          continue

        case S.ATTRIB_VALUE_UNQUOTED:
          if (!isAttribEnd(c)) {
            if (c === '&') {
              parser.state = S.ATTRIB_VALUE_ENTITY_U
            } else {
              parser.attribValue += c
            }
            continue
          }
          attrib(parser)
          if (c === '>') {
            openTag(parser)
          } else {
            parser.state = S.ATTRIB
          }
          continue

        case S.CLOSE_TAG:
          if (!parser.tagName) {
            if (isWhitespace(c)) {
              continue
            } else if (notMatch(nameStart, c)) {
              if (parser.script) {
                parser.script += '</' + c
                parser.state = S.SCRIPT
              } else {
                strictFail(parser, 'Invalid tagname in closing tag.')
              }
            } else {
              parser.tagName = c
            }
          } else if (c === '>') {
            closeTag(parser)
          } else if (isMatch(nameBody, c)) {
            parser.tagName += c
          } else if (parser.script) {
            parser.script += '</' + parser.tagName
            parser.tagName = ''
            parser.state = S.SCRIPT
          } else {
            if (!isWhitespace(c)) {
              strictFail(parser, 'Invalid tagname in closing tag')
            }
            parser.state = S.CLOSE_TAG_SAW_WHITE
          }
          continue

        case S.CLOSE_TAG_SAW_WHITE:
          if (isWhitespace(c)) {
            continue
          }
          if (c === '>') {
            closeTag(parser)
          } else {
            strictFail(parser, 'Invalid characters in closing tag')
          }
          continue

        case S.TEXT_ENTITY:
        case S.ATTRIB_VALUE_ENTITY_Q:
        case S.ATTRIB_VALUE_ENTITY_U:
          var returnState
          var buffer
          switch (parser.state) {
            case S.TEXT_ENTITY:
              returnState = S.TEXT
              buffer = 'textNode'
              break

            case S.ATTRIB_VALUE_ENTITY_Q:
              returnState = S.ATTRIB_VALUE_QUOTED
              buffer = 'attribValue'
              break

            case S.ATTRIB_VALUE_ENTITY_U:
              returnState = S.ATTRIB_VALUE_UNQUOTED
              buffer = 'attribValue'
              break
          }

          if (c === ';') {
            var parsedEntity = parseEntity(parser)
            if (parser.opt.unparsedEntities && !Object.values(sax.XML_ENTITIES).includes(parsedEntity)) {
              parser.entity = ''
              parser.state = returnState
              parser.write(parsedEntity)
            } else {
              parser[buffer] += parsedEntity
              parser.entity = ''
              parser.state = returnState
            }
          } else if (isMatch(parser.entity.length ? entityBody : entityStart, c)) {
            parser.entity += c
          } else {
            strictFail(parser, 'Invalid character in entity name')
            parser[buffer] += '&' + parser.entity + c
            parser.entity = ''
            parser.state = returnState
          }

          continue

        default: /* istanbul ignore next */ {
          throw new Error(parser, 'Unknown state: ' + parser.state)
        }
      }
    } // while

    if (parser.position >= parser.bufferCheckPosition) {
      checkBufferLength(parser)
    }
    return parser
  }

  /*! http://mths.be/fromcodepoint v0.1.0 by @mathias */
  /* istanbul ignore next */
  if (!String.fromCodePoint) {
    (function () {
      var stringFromCharCode = String.fromCharCode
      var floor = Math.floor
      var fromCodePoint = function () {
        var MAX_SIZE = 0x4000
        var codeUnits = []
        var highSurrogate
        var lowSurrogate
        var index = -1
        var length = arguments.length
        if (!length) {
          return ''
        }
        var result = ''
        while (++index < length) {
          var codePoint = Number(arguments[index])
          if (
            !isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
            codePoint < 0 || // not a valid Unicode code point
            codePoint > 0x10FFFF || // not a valid Unicode code point
            floor(codePoint) !== codePoint // not an integer
          ) {
            throw RangeError('Invalid code point: ' + codePoint)
          }
          if (codePoint <= 0xFFFF) { // BMP code point
            codeUnits.push(codePoint)
          } else { // Astral code point; split in surrogate halves
            // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
            codePoint -= 0x10000
            highSurrogate = (codePoint >> 10) + 0xD800
            lowSurrogate = (codePoint % 0x400) + 0xDC00
            codeUnits.push(highSurrogate, lowSurrogate)
          }
          if (index + 1 === length || codeUnits.length > MAX_SIZE) {
            result += stringFromCharCode.apply(null, codeUnits)
            codeUnits.length = 0
          }
        }
        return result
      }
      /* istanbul ignore next */
      if (Object.defineProperty) {
        Object.defineProperty(String, 'fromCodePoint', {
          value: fromCodePoint,
          configurable: true,
          writable: true
        })
      } else {
        String.fromCodePoint = fromCodePoint
      }
    }())
  }
})(typeof exports === 'undefined' ? this.sax = {} : exports)

}).call(this)}).call(this,require("buffer").Buffer)
},{"buffer":76,"stream":98,"string_decoder":113}],98:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/lib/_stream_readable.js');
Stream.Writable = require('readable-stream/lib/_stream_writable.js');
Stream.Duplex = require('readable-stream/lib/_stream_duplex.js');
Stream.Transform = require('readable-stream/lib/_stream_transform.js');
Stream.PassThrough = require('readable-stream/lib/_stream_passthrough.js');
Stream.finished = require('readable-stream/lib/internal/streams/end-of-stream.js')
Stream.pipeline = require('readable-stream/lib/internal/streams/pipeline.js')

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":78,"inherits":85,"readable-stream/lib/_stream_duplex.js":100,"readable-stream/lib/_stream_passthrough.js":101,"readable-stream/lib/_stream_readable.js":102,"readable-stream/lib/_stream_transform.js":103,"readable-stream/lib/_stream_writable.js":104,"readable-stream/lib/internal/streams/end-of-stream.js":108,"readable-stream/lib/internal/streams/pipeline.js":110}],99:[function(require,module,exports){
'use strict';

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; subClass.__proto__ = superClass; }

var codes = {};

function createErrorType(code, message, Base) {
  if (!Base) {
    Base = Error;
  }

  function getMessage(arg1, arg2, arg3) {
    if (typeof message === 'string') {
      return message;
    } else {
      return message(arg1, arg2, arg3);
    }
  }

  var NodeError =
  /*#__PURE__*/
  function (_Base) {
    _inheritsLoose(NodeError, _Base);

    function NodeError(arg1, arg2, arg3) {
      return _Base.call(this, getMessage(arg1, arg2, arg3)) || this;
    }

    return NodeError;
  }(Base);

  NodeError.prototype.name = Base.name;
  NodeError.prototype.code = code;
  codes[code] = NodeError;
} // https://github.com/nodejs/node/blob/v10.8.0/lib/internal/errors.js


function oneOf(expected, thing) {
  if (Array.isArray(expected)) {
    var len = expected.length;
    expected = expected.map(function (i) {
      return String(i);
    });

    if (len > 2) {
      return "one of ".concat(thing, " ").concat(expected.slice(0, len - 1).join(', '), ", or ") + expected[len - 1];
    } else if (len === 2) {
      return "one of ".concat(thing, " ").concat(expected[0], " or ").concat(expected[1]);
    } else {
      return "of ".concat(thing, " ").concat(expected[0]);
    }
  } else {
    return "of ".concat(thing, " ").concat(String(expected));
  }
} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith


function startsWith(str, search, pos) {
  return str.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith


function endsWith(str, search, this_len) {
  if (this_len === undefined || this_len > str.length) {
    this_len = str.length;
  }

  return str.substring(this_len - search.length, this_len) === search;
} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes


function includes(str, search, start) {
  if (typeof start !== 'number') {
    start = 0;
  }

  if (start + search.length > str.length) {
    return false;
  } else {
    return str.indexOf(search, start) !== -1;
  }
}

createErrorType('ERR_INVALID_OPT_VALUE', function (name, value) {
  return 'The value "' + value + '" is invalid for option "' + name + '"';
}, TypeError);
createErrorType('ERR_INVALID_ARG_TYPE', function (name, expected, actual) {
  // determiner: 'must be' or 'must not be'
  var determiner;

  if (typeof expected === 'string' && startsWith(expected, 'not ')) {
    determiner = 'must not be';
    expected = expected.replace(/^not /, '');
  } else {
    determiner = 'must be';
  }

  var msg;

  if (endsWith(name, ' argument')) {
    // For cases like 'first argument'
    msg = "The ".concat(name, " ").concat(determiner, " ").concat(oneOf(expected, 'type'));
  } else {
    var type = includes(name, '.') ? 'property' : 'argument';
    msg = "The \"".concat(name, "\" ").concat(type, " ").concat(determiner, " ").concat(oneOf(expected, 'type'));
  }

  msg += ". Received type ".concat(typeof actual);
  return msg;
}, TypeError);
createErrorType('ERR_STREAM_PUSH_AFTER_EOF', 'stream.push() after EOF');
createErrorType('ERR_METHOD_NOT_IMPLEMENTED', function (name) {
  return 'The ' + name + ' method is not implemented';
});
createErrorType('ERR_STREAM_PREMATURE_CLOSE', 'Premature close');
createErrorType('ERR_STREAM_DESTROYED', function (name) {
  return 'Cannot call ' + name + ' after a stream was destroyed';
});
createErrorType('ERR_MULTIPLE_CALLBACK', 'Callback called multiple times');
createErrorType('ERR_STREAM_CANNOT_PIPE', 'Cannot pipe, not readable');
createErrorType('ERR_STREAM_WRITE_AFTER_END', 'write after end');
createErrorType('ERR_STREAM_NULL_VALUES', 'May not write null values to stream', TypeError);
createErrorType('ERR_UNKNOWN_ENCODING', function (arg) {
  return 'Unknown encoding: ' + arg;
}, TypeError);
createErrorType('ERR_STREAM_UNSHIFT_AFTER_END_EVENT', 'stream.unshift() after end event');
module.exports.codes = codes;

},{}],100:[function(require,module,exports){
(function (process){(function (){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
};
/*</replacement>*/

module.exports = Duplex;
var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');
require('inherits')(Duplex, Readable);
{
  // Allow the keys array to be GC'ed.
  var keys = objectKeys(Writable.prototype);
  for (var v = 0; v < keys.length; v++) {
    var method = keys[v];
    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
  }
}
function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);
  Readable.call(this, options);
  Writable.call(this, options);
  this.allowHalfOpen = true;
  if (options) {
    if (options.readable === false) this.readable = false;
    if (options.writable === false) this.writable = false;
    if (options.allowHalfOpen === false) {
      this.allowHalfOpen = false;
      this.once('end', onend);
    }
  }
}
Object.defineProperty(Duplex.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState.highWaterMark;
  }
});
Object.defineProperty(Duplex.prototype, 'writableBuffer', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState && this._writableState.getBuffer();
  }
});
Object.defineProperty(Duplex.prototype, 'writableLength', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState.length;
  }
});

// the no-half-open enforcer
function onend() {
  // If the writable side ended, then we're ok.
  if (this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  process.nextTick(onEndNT, this);
}
function onEndNT(self) {
  self.end();
}
Object.defineProperty(Duplex.prototype, 'destroyed', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    if (this._readableState === undefined || this._writableState === undefined) {
      return false;
    }
    return this._readableState.destroyed && this._writableState.destroyed;
  },
  set: function set(value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (this._readableState === undefined || this._writableState === undefined) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
    this._writableState.destroyed = value;
  }
});
}).call(this)}).call(this,require('_process'))
},{"./_stream_readable":102,"./_stream_writable":104,"_process":95,"inherits":85}],101:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;
var Transform = require('./_stream_transform');
require('inherits')(PassThrough, Transform);
function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);
  Transform.call(this, options);
}
PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};
},{"./_stream_transform":103,"inherits":85}],102:[function(require,module,exports){
(function (process,global){(function (){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

module.exports = Readable;

/*<replacement>*/
var Duplex;
/*</replacement>*/

Readable.ReadableState = ReadableState;

/*<replacement>*/
var EE = require('events').EventEmitter;
var EElistenerCount = function EElistenerCount(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

var Buffer = require('buffer').Buffer;
var OurUint8Array = (typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {}).Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}

/*<replacement>*/
var debugUtil = require('util');
var debug;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function debug() {};
}
/*</replacement>*/

var BufferList = require('./internal/streams/buffer_list');
var destroyImpl = require('./internal/streams/destroy');
var _require = require('./internal/streams/state'),
  getHighWaterMark = _require.getHighWaterMark;
var _require$codes = require('../errors').codes,
  ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE,
  ERR_STREAM_PUSH_AFTER_EOF = _require$codes.ERR_STREAM_PUSH_AFTER_EOF,
  ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
  ERR_STREAM_UNSHIFT_AFTER_END_EVENT = _require$codes.ERR_STREAM_UNSHIFT_AFTER_END_EVENT;

// Lazy loaded to improve the startup performance.
var StringDecoder;
var createReadableStreamAsyncIterator;
var from;
require('inherits')(Readable, Stream);
var errorOrDestroy = destroyImpl.errorOrDestroy;
var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];
function prependListener(emitter, event, fn) {
  // Sadly this is not cacheable as some libraries bundle their own
  // event emitter implementation with them.
  if (typeof emitter.prependListener === 'function') return emitter.prependListener(event, fn);

  // This is a hack to make sure that our error handler is attached before any
  // userland ones.  NEVER DO THIS. This is here only because this code needs
  // to continue to work with older versions of Node.js that do not include
  // the prependListener() method. The goal is to eventually remove this hack.
  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (Array.isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
}
function ReadableState(options, stream, isDuplex) {
  Duplex = Duplex || require('./_stream_duplex');
  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  if (typeof isDuplex !== 'boolean') isDuplex = stream instanceof Duplex;

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;
  if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  this.highWaterMark = getHighWaterMark(this, options, 'readableHighWaterMark', isDuplex);

  // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()
  this.buffer = new BufferList();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the event 'readable'/'data' is emitted
  // immediately, or on a later tick.  We set this to true at first, because
  // any actions that shouldn't happen until "later" should generally also
  // not happen before the first read call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;
  this.paused = true;

  // Should close be emitted on destroy. Defaults to true.
  this.emitClose = options.emitClose !== false;

  // Should .destroy() be called after 'end' (and potentially 'finish')
  this.autoDestroy = !!options.autoDestroy;

  // has it been destroyed
  this.destroyed = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;
  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}
function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');
  if (!(this instanceof Readable)) return new Readable(options);

  // Checking for a Stream.Duplex instance is faster here instead of inside
  // the ReadableState constructor, at least with V8 6.5
  var isDuplex = this instanceof Duplex;
  this._readableState = new ReadableState(options, this, isDuplex);

  // legacy
  this.readable = true;
  if (options) {
    if (typeof options.read === 'function') this._read = options.read;
    if (typeof options.destroy === 'function') this._destroy = options.destroy;
  }
  Stream.call(this);
}
Object.defineProperty(Readable.prototype, 'destroyed', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    if (this._readableState === undefined) {
      return false;
    }
    return this._readableState.destroyed;
  },
  set: function set(value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._readableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
  }
});
Readable.prototype.destroy = destroyImpl.destroy;
Readable.prototype._undestroy = destroyImpl.undestroy;
Readable.prototype._destroy = function (err, cb) {
  cb(err);
};

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;
  var skipChunkCheck;
  if (!state.objectMode) {
    if (typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer.from(chunk, encoding);
        encoding = '';
      }
      skipChunkCheck = true;
    }
  } else {
    skipChunkCheck = true;
  }
  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  return readableAddChunk(this, chunk, null, true, false);
};
function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
  debug('readableAddChunk', chunk);
  var state = stream._readableState;
  if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else {
    var er;
    if (!skipChunkCheck) er = chunkInvalid(state, chunk);
    if (er) {
      errorOrDestroy(stream, er);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
        chunk = _uint8ArrayToBuffer(chunk);
      }
      if (addToFront) {
        if (state.endEmitted) errorOrDestroy(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT());else addChunk(stream, state, chunk, true);
      } else if (state.ended) {
        errorOrDestroy(stream, new ERR_STREAM_PUSH_AFTER_EOF());
      } else if (state.destroyed) {
        return false;
      } else {
        state.reading = false;
        if (state.decoder && !encoding) {
          chunk = state.decoder.write(chunk);
          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
        } else {
          addChunk(stream, state, chunk, false);
        }
      }
    } else if (!addToFront) {
      state.reading = false;
      maybeReadMore(stream, state);
    }
  }

  // We can push more data if we are below the highWaterMark.
  // Also, if we have no data yet, we can stand some more bytes.
  // This is to work around cases where hwm=0, such as the repl.
  return !state.ended && (state.length < state.highWaterMark || state.length === 0);
}
function addChunk(stream, state, chunk, addToFront) {
  if (state.flowing && state.length === 0 && !state.sync) {
    state.awaitDrain = 0;
    stream.emit('data', chunk);
  } else {
    // update the buffer info.
    state.length += state.objectMode ? 1 : chunk.length;
    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);
    if (state.needReadable) emitReadable(stream);
  }
  maybeReadMore(stream, state);
}
function chunkInvalid(state, chunk) {
  var er;
  if (!_isUint8Array(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new ERR_INVALID_ARG_TYPE('chunk', ['string', 'Buffer', 'Uint8Array'], chunk);
  }
  return er;
}
Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
  var decoder = new StringDecoder(enc);
  this._readableState.decoder = decoder;
  // If setEncoding(null), decoder.encoding equals utf8
  this._readableState.encoding = this._readableState.decoder.encoding;

  // Iterate over current buffer to convert already stored Buffers:
  var p = this._readableState.buffer.head;
  var content = '';
  while (p !== null) {
    content += decoder.write(p.data);
    p = p.next;
  }
  this._readableState.buffer.clear();
  if (content !== '') this._readableState.buffer.push(content);
  this._readableState.length = content.length;
  return this;
};

// Don't raise the hwm > 1GB
var MAX_HWM = 0x40000000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    // TODO(ronag): Throw ERR_VALUE_OUT_OF_RANGE.
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    // Only flow one buffer at a time
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  }
  // If we're asking for more than the current hwm, then raise the hwm.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n;
  // Don't have enough
  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;
  if (n !== 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }
  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
    // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.
    if (!state.reading) n = howMuchToRead(nOrig, state);
  }
  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;
  if (ret === null) {
    state.needReadable = state.length <= state.highWaterMark;
    n = 0;
  } else {
    state.length -= n;
    state.awaitDrain = 0;
  }
  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true;

    // If we tried to read() past the EOF, then emit end on the next tick.
    if (nOrig !== n && state.ended) endReadable(this);
  }
  if (ret !== null) this.emit('data', ret);
  return ret;
};
function onEofChunk(stream, state) {
  debug('onEofChunk');
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;
  if (state.sync) {
    // if we are sync, wait until next tick to emit the data.
    // Otherwise we risk emitting data in the flow()
    // the readable code triggers during a read() call
    emitReadable(stream);
  } else {
    // emit 'readable' now to make sure it gets picked up.
    state.needReadable = false;
    if (!state.emittedReadable) {
      state.emittedReadable = true;
      emitReadable_(stream);
    }
  }
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  debug('emitReadable', state.needReadable, state.emittedReadable);
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    process.nextTick(emitReadable_, stream);
  }
}
function emitReadable_(stream) {
  var state = stream._readableState;
  debug('emitReadable_', state.destroyed, state.length, state.ended);
  if (!state.destroyed && (state.length || state.ended)) {
    stream.emit('readable');
    state.emittedReadable = false;
  }

  // The stream needs another readable event if
  // 1. It is not flowing, as the flow mechanism will take
  //    care of it.
  // 2. It is not ended.
  // 3. It is below the highWaterMark, so we can schedule
  //    another readable later.
  state.needReadable = !state.flowing && !state.ended && state.length <= state.highWaterMark;
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(maybeReadMore_, stream, state);
  }
}
function maybeReadMore_(stream, state) {
  // Attempt to read more data if we should.
  //
  // The conditions for reading more data are (one of):
  // - Not enough data buffered (state.length < state.highWaterMark). The loop
  //   is responsible for filling the buffer with enough data if such data
  //   is available. If highWaterMark is 0 and we are not in the flowing mode
  //   we should _not_ attempt to buffer any extra data. We'll get more data
  //   when the stream consumer calls read() instead.
  // - No data in the buffer, and the stream is in flowing mode. In this mode
  //   the loop below is responsible for ensuring read() is called. Failing to
  //   call read here would abort the flow and there's no other mechanism for
  //   continuing the flow if the stream consumer has just subscribed to the
  //   'data' event.
  //
  // In addition to the above conditions to keep reading data, the following
  // conditions prevent the data from being read:
  // - The stream has ended (state.ended).
  // - There is already a pending 'read' operation (state.reading). This is a
  //   case where the the stream has called the implementation defined _read()
  //   method, but they are processing the call asynchronously and have _not_
  //   called push() with new data. In this case we skip performing more
  //   read()s. The execution ends in this method again after the _read() ends
  //   up calling push() with more data.
  while (!state.reading && !state.ended && (state.length < state.highWaterMark || state.flowing && state.length === 0)) {
    var len = state.length;
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  errorOrDestroy(this, new ERR_METHOD_NOT_IMPLEMENTED('_read()'));
};
Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;
  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);
  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;
  var endFn = doEnd ? onend : unpipe;
  if (state.endEmitted) process.nextTick(endFn);else src.once('end', endFn);
  dest.on('unpipe', onunpipe);
  function onunpipe(readable, unpipeInfo) {
    debug('onunpipe');
    if (readable === src) {
      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
        unpipeInfo.hasUnpiped = true;
        cleanup();
      }
    }
  }
  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);
  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', unpipe);
    src.removeListener('data', ondata);
    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    debug('dest.write', ret);
    if (ret === false) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', state.awaitDrain);
        state.awaitDrain++;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) errorOrDestroy(dest, er);
  }

  // Make sure our error handler is attached before userland ones.
  prependListener(dest, 'error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);
  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }
  return dest;
};
function pipeOnDrain(src) {
  return function pipeOnDrainFunctionResult() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}
Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;
  var unpipeInfo = {
    hasUnpiped: false
  };

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;
    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this, unpipeInfo);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    for (var i = 0; i < len; i++) dests[i].emit('unpipe', this, {
      hasUnpiped: false
    });
    return this;
  }

  // try to find the right one.
  var index = indexOf(state.pipes, dest);
  if (index === -1) return this;
  state.pipes.splice(index, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];
  dest.emit('unpipe', this, unpipeInfo);
  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);
  var state = this._readableState;
  if (ev === 'data') {
    // update readableListening so that resume() may be a no-op
    // a few lines down. This is needed to support once('readable').
    state.readableListening = this.listenerCount('readable') > 0;

    // Try start flowing on next tick if stream isn't explicitly paused
    if (state.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.flowing = false;
      state.emittedReadable = false;
      debug('on readable', state.length, state.reading);
      if (state.length) {
        emitReadable(this);
      } else if (!state.reading) {
        process.nextTick(nReadingNextTick, this);
      }
    }
  }
  return res;
};
Readable.prototype.addListener = Readable.prototype.on;
Readable.prototype.removeListener = function (ev, fn) {
  var res = Stream.prototype.removeListener.call(this, ev, fn);
  if (ev === 'readable') {
    // We need to check if there is someone still listening to
    // readable and reset the state. However this needs to happen
    // after readable has been emitted but before I/O (nextTick) to
    // support once('readable', fn) cycles. This means that calling
    // resume within the same tick will have no
    // effect.
    process.nextTick(updateReadableListening, this);
  }
  return res;
};
Readable.prototype.removeAllListeners = function (ev) {
  var res = Stream.prototype.removeAllListeners.apply(this, arguments);
  if (ev === 'readable' || ev === undefined) {
    // We need to check if there is someone still listening to
    // readable and reset the state. However this needs to happen
    // after readable has been emitted but before I/O (nextTick) to
    // support once('readable', fn) cycles. This means that calling
    // resume within the same tick will have no
    // effect.
    process.nextTick(updateReadableListening, this);
  }
  return res;
};
function updateReadableListening(self) {
  var state = self._readableState;
  state.readableListening = self.listenerCount('readable') > 0;
  if (state.resumeScheduled && !state.paused) {
    // flowing needs to be set to true now, otherwise
    // the upcoming resume will not flow.
    state.flowing = true;

    // crude way to check if we should resume
  } else if (self.listenerCount('data') > 0) {
    self.resume();
  }
}
function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    // we flow only if there is no one listening
    // for readable, but we still have to call
    // resume()
    state.flowing = !state.readableListening;
    resume(this, state);
  }
  state.paused = false;
  return this;
};
function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    process.nextTick(resume_, stream, state);
  }
}
function resume_(stream, state) {
  debug('resume', state.reading);
  if (!state.reading) {
    stream.read(0);
  }
  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}
Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (this._readableState.flowing !== false) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  this._readableState.paused = true;
  return this;
};
function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null);
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var _this = this;
  var state = this._readableState;
  var paused = false;
  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) _this.push(chunk);
    }
    _this.push(null);
  });
  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;
    var ret = _this.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function methodWrap(method) {
        return function methodWrapReturnFunction() {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  for (var n = 0; n < kProxyEvents.length; n++) {
    stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
  }

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  this._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };
  return this;
};
if (typeof Symbol === 'function') {
  Readable.prototype[Symbol.asyncIterator] = function () {
    if (createReadableStreamAsyncIterator === undefined) {
      createReadableStreamAsyncIterator = require('./internal/streams/async_iterator');
    }
    return createReadableStreamAsyncIterator(this);
  };
}
Object.defineProperty(Readable.prototype, 'readableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._readableState.highWaterMark;
  }
});
Object.defineProperty(Readable.prototype, 'readableBuffer', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._readableState && this._readableState.buffer;
  }
});
Object.defineProperty(Readable.prototype, 'readableFlowing', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._readableState.flowing;
  },
  set: function set(state) {
    if (this._readableState) {
      this._readableState.flowing = state;
    }
  }
});

// exposed for testing purposes only.
Readable._fromList = fromList;
Object.defineProperty(Readable.prototype, 'readableLength', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._readableState.length;
  }
});

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromList(n, state) {
  // nothing buffered
  if (state.length === 0) return null;
  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    // read it all, truncate the list
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.first();else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    // read part of list
    ret = state.buffer.consume(n, state.decoder);
  }
  return ret;
}
function endReadable(stream) {
  var state = stream._readableState;
  debug('endReadable', state.endEmitted);
  if (!state.endEmitted) {
    state.ended = true;
    process.nextTick(endReadableNT, state, stream);
  }
}
function endReadableNT(state, stream) {
  debug('endReadableNT', state.endEmitted, state.length);

  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
    if (state.autoDestroy) {
      // In case of duplex streams we need a way to detect
      // if the writable side is ready for autoDestroy as well
      var wState = stream._writableState;
      if (!wState || wState.autoDestroy && wState.finished) {
        stream.destroy();
      }
    }
  }
}
if (typeof Symbol === 'function') {
  Readable.from = function (iterable, opts) {
    if (from === undefined) {
      from = require('./internal/streams/from');
    }
    return from(Readable, iterable, opts);
  };
}
function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../errors":99,"./_stream_duplex":100,"./internal/streams/async_iterator":105,"./internal/streams/buffer_list":106,"./internal/streams/destroy":107,"./internal/streams/from":109,"./internal/streams/state":111,"./internal/streams/stream":112,"_process":95,"buffer":76,"events":78,"inherits":85,"string_decoder/":113,"util":75}],103:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;
var _require$codes = require('../errors').codes,
  ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
  ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK,
  ERR_TRANSFORM_ALREADY_TRANSFORMING = _require$codes.ERR_TRANSFORM_ALREADY_TRANSFORMING,
  ERR_TRANSFORM_WITH_LENGTH_0 = _require$codes.ERR_TRANSFORM_WITH_LENGTH_0;
var Duplex = require('./_stream_duplex');
require('inherits')(Transform, Duplex);
function afterTransform(er, data) {
  var ts = this._transformState;
  ts.transforming = false;
  var cb = ts.writecb;
  if (cb === null) {
    return this.emit('error', new ERR_MULTIPLE_CALLBACK());
  }
  ts.writechunk = null;
  ts.writecb = null;
  if (data != null)
    // single equals check for both `null` and `undefined`
    this.push(data);
  cb(er);
  var rs = this._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    this._read(rs.highWaterMark);
  }
}
function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);
  Duplex.call(this, options);
  this._transformState = {
    afterTransform: afterTransform.bind(this),
    needTransform: false,
    transforming: false,
    writecb: null,
    writechunk: null,
    writeencoding: null
  };

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;
  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;
    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  // When the writable side finishes, then flush out anything remaining.
  this.on('prefinish', prefinish);
}
function prefinish() {
  var _this = this;
  if (typeof this._flush === 'function' && !this._readableState.destroyed) {
    this._flush(function (er, data) {
      done(_this, er, data);
    });
  } else {
    done(this, null, null);
  }
}
Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  cb(new ERR_METHOD_NOT_IMPLEMENTED('_transform()'));
};
Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;
  if (ts.writechunk !== null && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};
Transform.prototype._destroy = function (err, cb) {
  Duplex.prototype._destroy.call(this, err, function (err2) {
    cb(err2);
  });
};
function done(stream, er, data) {
  if (er) return stream.emit('error', er);
  if (data != null)
    // single equals check for both `null` and `undefined`
    stream.push(data);

  // TODO(BridgeAR): Write a test for these two error cases
  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  if (stream._writableState.length) throw new ERR_TRANSFORM_WITH_LENGTH_0();
  if (stream._transformState.transforming) throw new ERR_TRANSFORM_ALREADY_TRANSFORMING();
  return stream.push(null);
}
},{"../errors":99,"./_stream_duplex":100,"inherits":85}],104:[function(require,module,exports){
(function (process,global){(function (){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

module.exports = Writable;

/* <replacement> */
function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;
  this.next = null;
  this.entry = null;
  this.finish = function () {
    onCorkedFinish(_this, state);
  };
}
/* </replacement> */

/*<replacement>*/
var Duplex;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

var Buffer = require('buffer').Buffer;
var OurUint8Array = (typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {}).Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}
var destroyImpl = require('./internal/streams/destroy');
var _require = require('./internal/streams/state'),
  getHighWaterMark = _require.getHighWaterMark;
var _require$codes = require('../errors').codes,
  ERR_INVALID_ARG_TYPE = _require$codes.ERR_INVALID_ARG_TYPE,
  ERR_METHOD_NOT_IMPLEMENTED = _require$codes.ERR_METHOD_NOT_IMPLEMENTED,
  ERR_MULTIPLE_CALLBACK = _require$codes.ERR_MULTIPLE_CALLBACK,
  ERR_STREAM_CANNOT_PIPE = _require$codes.ERR_STREAM_CANNOT_PIPE,
  ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED,
  ERR_STREAM_NULL_VALUES = _require$codes.ERR_STREAM_NULL_VALUES,
  ERR_STREAM_WRITE_AFTER_END = _require$codes.ERR_STREAM_WRITE_AFTER_END,
  ERR_UNKNOWN_ENCODING = _require$codes.ERR_UNKNOWN_ENCODING;
var errorOrDestroy = destroyImpl.errorOrDestroy;
require('inherits')(Writable, Stream);
function nop() {}
function WritableState(options, stream, isDuplex) {
  Duplex = Duplex || require('./_stream_duplex');
  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream,
  // e.g. options.readableObjectMode vs. options.writableObjectMode, etc.
  if (typeof isDuplex !== 'boolean') isDuplex = stream instanceof Duplex;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;
  if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  this.highWaterMark = getHighWaterMark(this, options, 'writableHighWaterMark', isDuplex);

  // if _final has been called
  this.finalCalled = false;

  // drain event flag.
  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // has it been destroyed
  this.destroyed = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;
  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // Should close be emitted on destroy. Defaults to true.
  this.emitClose = options.emitClose !== false;

  // Should .destroy() be called after 'finish' (and potentially 'end')
  this.autoDestroy = !!options.autoDestroy;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  this.corkedRequestsFree = new CorkedRequest(this);
}
WritableState.prototype.getBuffer = function getBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};
(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function writableStateBufferGetter() {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
    });
  } catch (_) {}
})();

// Test _writableState for inheritance to account for Duplex streams,
// whose prototype chain only points to Readable.
var realHasInstance;
if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
  realHasInstance = Function.prototype[Symbol.hasInstance];
  Object.defineProperty(Writable, Symbol.hasInstance, {
    value: function value(object) {
      if (realHasInstance.call(this, object)) return true;
      if (this !== Writable) return false;
      return object && object._writableState instanceof WritableState;
    }
  });
} else {
  realHasInstance = function realHasInstance(object) {
    return object instanceof this;
  };
}
function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, too.
  // `realHasInstance` is necessary because using plain `instanceof`
  // would return false, as no `_writableState` property is attached.

  // Trying to use the custom `instanceof` for Writable here will also break the
  // Node.js LazyTransform implementation, which has a non-trivial getter for
  // `_writableState` that would lead to infinite recursion.

  // Checking for a Stream.Duplex instance is faster here instead of inside
  // the WritableState constructor, at least with V8 6.5
  var isDuplex = this instanceof Duplex;
  if (!isDuplex && !realHasInstance.call(Writable, this)) return new Writable(options);
  this._writableState = new WritableState(options, this, isDuplex);

  // legacy.
  this.writable = true;
  if (options) {
    if (typeof options.write === 'function') this._write = options.write;
    if (typeof options.writev === 'function') this._writev = options.writev;
    if (typeof options.destroy === 'function') this._destroy = options.destroy;
    if (typeof options.final === 'function') this._final = options.final;
  }
  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  errorOrDestroy(this, new ERR_STREAM_CANNOT_PIPE());
};
function writeAfterEnd(stream, cb) {
  var er = new ERR_STREAM_WRITE_AFTER_END();
  // TODO: defer error events consistently everywhere, not just the cb
  errorOrDestroy(stream, er);
  process.nextTick(cb, er);
}

// Checks that a user-supplied chunk is valid, especially for the particular
// mode the stream is in. Currently this means that `null` is never accepted
// and undefined/non-string values are only allowed in object mode.
function validChunk(stream, state, chunk, cb) {
  var er;
  if (chunk === null) {
    er = new ERR_STREAM_NULL_VALUES();
  } else if (typeof chunk !== 'string' && !state.objectMode) {
    er = new ERR_INVALID_ARG_TYPE('chunk', ['string', 'Buffer'], chunk);
  }
  if (er) {
    errorOrDestroy(stream, er);
    process.nextTick(cb, er);
    return false;
  }
  return true;
}
Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;
  var isBuf = !state.objectMode && _isUint8Array(chunk);
  if (isBuf && !Buffer.isBuffer(chunk)) {
    chunk = _uint8ArrayToBuffer(chunk);
  }
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }
  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;
  if (typeof cb !== 'function') cb = nop;
  if (state.ending) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
  }
  return ret;
};
Writable.prototype.cork = function () {
  this._writableState.corked++;
};
Writable.prototype.uncork = function () {
  var state = this._writableState;
  if (state.corked) {
    state.corked--;
    if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};
Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new ERR_UNKNOWN_ENCODING(encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};
Object.defineProperty(Writable.prototype, 'writableBuffer', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState && this._writableState.getBuffer();
  }
});
function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = Buffer.from(chunk, encoding);
  }
  return chunk;
}
Object.defineProperty(Writable.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState.highWaterMark;
  }
});

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
  if (!isBuf) {
    var newChunk = decodeChunk(state, chunk, encoding);
    if (chunk !== newChunk) {
      isBuf = true;
      encoding = 'buffer';
      chunk = newChunk;
    }
  }
  var len = state.objectMode ? 1 : chunk.length;
  state.length += len;
  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;
  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = {
      chunk: chunk,
      encoding: encoding,
      isBuf: isBuf,
      callback: cb,
      next: null
    };
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }
  return ret;
}
function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (state.destroyed) state.onwrite(new ERR_STREAM_DESTROYED('write'));else if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}
function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync) {
    // defer the callback if we are being called synchronously
    // to avoid piling up things on the stack
    process.nextTick(cb, er);
    // this can emit finish, and it will always happen
    // after error
    process.nextTick(finishMaybe, stream, state);
    stream._writableState.errorEmitted = true;
    errorOrDestroy(stream, er);
  } else {
    // the caller expect this to happen before if
    // it is async
    cb(er);
    stream._writableState.errorEmitted = true;
    errorOrDestroy(stream, er);
    // this can emit finish, but finish must
    // always follow error
    finishMaybe(stream, state);
  }
}
function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}
function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;
  if (typeof cb !== 'function') throw new ERR_MULTIPLE_CALLBACK();
  onwriteStateUpdate(state);
  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state) || stream.destroyed;
    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }
    if (sync) {
      process.nextTick(afterWrite, stream, state, finished, cb);
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}
function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;
  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;
    var count = 0;
    var allBuffers = true;
    while (entry) {
      buffer[count] = entry;
      if (!entry.isBuf) allBuffers = false;
      entry = entry.next;
      count += 1;
    }
    buffer.allBuffers = allBuffers;
    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
    state.bufferedRequestCount = 0;
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;
      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      state.bufferedRequestCount--;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }
    if (entry === null) state.lastBufferedRequest = null;
  }
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}
Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new ERR_METHOD_NOT_IMPLEMENTED('_write()'));
};
Writable.prototype._writev = null;
Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;
  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }
  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending) endWritable(this, state, cb);
  return this;
};
Object.defineProperty(Writable.prototype, 'writableLength', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState.length;
  }
});
function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}
function callFinal(stream, state) {
  stream._final(function (err) {
    state.pendingcb--;
    if (err) {
      errorOrDestroy(stream, err);
    }
    state.prefinished = true;
    stream.emit('prefinish');
    finishMaybe(stream, state);
  });
}
function prefinish(stream, state) {
  if (!state.prefinished && !state.finalCalled) {
    if (typeof stream._final === 'function' && !state.destroyed) {
      state.pendingcb++;
      state.finalCalled = true;
      process.nextTick(callFinal, stream, state);
    } else {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }
}
function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    prefinish(stream, state);
    if (state.pendingcb === 0) {
      state.finished = true;
      stream.emit('finish');
      if (state.autoDestroy) {
        // In case of duplex streams we need a way to detect
        // if the readable side is ready for autoDestroy as well
        var rState = stream._readableState;
        if (!rState || rState.autoDestroy && rState.endEmitted) {
          stream.destroy();
        }
      }
    }
  }
  return need;
}
function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) process.nextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}
function onCorkedFinish(corkReq, state, err) {
  var entry = corkReq.entry;
  corkReq.entry = null;
  while (entry) {
    var cb = entry.callback;
    state.pendingcb--;
    cb(err);
    entry = entry.next;
  }

  // reuse the free corkReq.
  state.corkedRequestsFree.next = corkReq;
}
Object.defineProperty(Writable.prototype, 'destroyed', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    if (this._writableState === undefined) {
      return false;
    }
    return this._writableState.destroyed;
  },
  set: function set(value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._writableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._writableState.destroyed = value;
  }
});
Writable.prototype.destroy = destroyImpl.destroy;
Writable.prototype._undestroy = destroyImpl.undestroy;
Writable.prototype._destroy = function (err, cb) {
  cb(err);
};
}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../errors":99,"./_stream_duplex":100,"./internal/streams/destroy":107,"./internal/streams/state":111,"./internal/streams/stream":112,"_process":95,"buffer":76,"inherits":85,"util-deprecate":114}],105:[function(require,module,exports){
(function (process){(function (){
'use strict';

var _Object$setPrototypeO;
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
var finished = require('./end-of-stream');
var kLastResolve = Symbol('lastResolve');
var kLastReject = Symbol('lastReject');
var kError = Symbol('error');
var kEnded = Symbol('ended');
var kLastPromise = Symbol('lastPromise');
var kHandlePromise = Symbol('handlePromise');
var kStream = Symbol('stream');
function createIterResult(value, done) {
  return {
    value: value,
    done: done
  };
}
function readAndResolve(iter) {
  var resolve = iter[kLastResolve];
  if (resolve !== null) {
    var data = iter[kStream].read();
    // we defer if data is null
    // we can be expecting either 'end' or
    // 'error'
    if (data !== null) {
      iter[kLastPromise] = null;
      iter[kLastResolve] = null;
      iter[kLastReject] = null;
      resolve(createIterResult(data, false));
    }
  }
}
function onReadable(iter) {
  // we wait for the next tick, because it might
  // emit an error with process.nextTick
  process.nextTick(readAndResolve, iter);
}
function wrapForNext(lastPromise, iter) {
  return function (resolve, reject) {
    lastPromise.then(function () {
      if (iter[kEnded]) {
        resolve(createIterResult(undefined, true));
        return;
      }
      iter[kHandlePromise](resolve, reject);
    }, reject);
  };
}
var AsyncIteratorPrototype = Object.getPrototypeOf(function () {});
var ReadableStreamAsyncIteratorPrototype = Object.setPrototypeOf((_Object$setPrototypeO = {
  get stream() {
    return this[kStream];
  },
  next: function next() {
    var _this = this;
    // if we have detected an error in the meanwhile
    // reject straight away
    var error = this[kError];
    if (error !== null) {
      return Promise.reject(error);
    }
    if (this[kEnded]) {
      return Promise.resolve(createIterResult(undefined, true));
    }
    if (this[kStream].destroyed) {
      // We need to defer via nextTick because if .destroy(err) is
      // called, the error will be emitted via nextTick, and
      // we cannot guarantee that there is no error lingering around
      // waiting to be emitted.
      return new Promise(function (resolve, reject) {
        process.nextTick(function () {
          if (_this[kError]) {
            reject(_this[kError]);
          } else {
            resolve(createIterResult(undefined, true));
          }
        });
      });
    }

    // if we have multiple next() calls
    // we will wait for the previous Promise to finish
    // this logic is optimized to support for await loops,
    // where next() is only called once at a time
    var lastPromise = this[kLastPromise];
    var promise;
    if (lastPromise) {
      promise = new Promise(wrapForNext(lastPromise, this));
    } else {
      // fast path needed to support multiple this.push()
      // without triggering the next() queue
      var data = this[kStream].read();
      if (data !== null) {
        return Promise.resolve(createIterResult(data, false));
      }
      promise = new Promise(this[kHandlePromise]);
    }
    this[kLastPromise] = promise;
    return promise;
  }
}, _defineProperty(_Object$setPrototypeO, Symbol.asyncIterator, function () {
  return this;
}), _defineProperty(_Object$setPrototypeO, "return", function _return() {
  var _this2 = this;
  // destroy(err, cb) is a private API
  // we can guarantee we have that here, because we control the
  // Readable class this is attached to
  return new Promise(function (resolve, reject) {
    _this2[kStream].destroy(null, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(createIterResult(undefined, true));
    });
  });
}), _Object$setPrototypeO), AsyncIteratorPrototype);
var createReadableStreamAsyncIterator = function createReadableStreamAsyncIterator(stream) {
  var _Object$create;
  var iterator = Object.create(ReadableStreamAsyncIteratorPrototype, (_Object$create = {}, _defineProperty(_Object$create, kStream, {
    value: stream,
    writable: true
  }), _defineProperty(_Object$create, kLastResolve, {
    value: null,
    writable: true
  }), _defineProperty(_Object$create, kLastReject, {
    value: null,
    writable: true
  }), _defineProperty(_Object$create, kError, {
    value: null,
    writable: true
  }), _defineProperty(_Object$create, kEnded, {
    value: stream._readableState.endEmitted,
    writable: true
  }), _defineProperty(_Object$create, kHandlePromise, {
    value: function value(resolve, reject) {
      var data = iterator[kStream].read();
      if (data) {
        iterator[kLastPromise] = null;
        iterator[kLastResolve] = null;
        iterator[kLastReject] = null;
        resolve(createIterResult(data, false));
      } else {
        iterator[kLastResolve] = resolve;
        iterator[kLastReject] = reject;
      }
    },
    writable: true
  }), _Object$create));
  iterator[kLastPromise] = null;
  finished(stream, function (err) {
    if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      var reject = iterator[kLastReject];
      // reject if we are waiting for data in the Promise
      // returned by next() and store the error
      if (reject !== null) {
        iterator[kLastPromise] = null;
        iterator[kLastResolve] = null;
        iterator[kLastReject] = null;
        reject(err);
      }
      iterator[kError] = err;
      return;
    }
    var resolve = iterator[kLastResolve];
    if (resolve !== null) {
      iterator[kLastPromise] = null;
      iterator[kLastResolve] = null;
      iterator[kLastReject] = null;
      resolve(createIterResult(undefined, true));
    }
    iterator[kEnded] = true;
  });
  stream.on('readable', onReadable.bind(null, iterator));
  return iterator;
};
module.exports = createReadableStreamAsyncIterator;
}).call(this)}).call(this,require('_process'))
},{"./end-of-stream":108,"_process":95}],106:[function(require,module,exports){
'use strict';

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
var _require = require('buffer'),
  Buffer = _require.Buffer;
var _require2 = require('util'),
  inspect = _require2.inspect;
var custom = inspect && inspect.custom || 'inspect';
function copyBuffer(src, target, offset) {
  Buffer.prototype.copy.call(src, target, offset);
}
module.exports = /*#__PURE__*/function () {
  function BufferList() {
    _classCallCheck(this, BufferList);
    this.head = null;
    this.tail = null;
    this.length = 0;
  }
  _createClass(BufferList, [{
    key: "push",
    value: function push(v) {
      var entry = {
        data: v,
        next: null
      };
      if (this.length > 0) this.tail.next = entry;else this.head = entry;
      this.tail = entry;
      ++this.length;
    }
  }, {
    key: "unshift",
    value: function unshift(v) {
      var entry = {
        data: v,
        next: this.head
      };
      if (this.length === 0) this.tail = entry;
      this.head = entry;
      ++this.length;
    }
  }, {
    key: "shift",
    value: function shift() {
      if (this.length === 0) return;
      var ret = this.head.data;
      if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
      --this.length;
      return ret;
    }
  }, {
    key: "clear",
    value: function clear() {
      this.head = this.tail = null;
      this.length = 0;
    }
  }, {
    key: "join",
    value: function join(s) {
      if (this.length === 0) return '';
      var p = this.head;
      var ret = '' + p.data;
      while (p = p.next) ret += s + p.data;
      return ret;
    }
  }, {
    key: "concat",
    value: function concat(n) {
      if (this.length === 0) return Buffer.alloc(0);
      var ret = Buffer.allocUnsafe(n >>> 0);
      var p = this.head;
      var i = 0;
      while (p) {
        copyBuffer(p.data, ret, i);
        i += p.data.length;
        p = p.next;
      }
      return ret;
    }

    // Consumes a specified amount of bytes or characters from the buffered data.
  }, {
    key: "consume",
    value: function consume(n, hasStrings) {
      var ret;
      if (n < this.head.data.length) {
        // `slice` is the same for buffers and strings.
        ret = this.head.data.slice(0, n);
        this.head.data = this.head.data.slice(n);
      } else if (n === this.head.data.length) {
        // First chunk is a perfect match.
        ret = this.shift();
      } else {
        // Result spans more than one buffer.
        ret = hasStrings ? this._getString(n) : this._getBuffer(n);
      }
      return ret;
    }
  }, {
    key: "first",
    value: function first() {
      return this.head.data;
    }

    // Consumes a specified amount of characters from the buffered data.
  }, {
    key: "_getString",
    value: function _getString(n) {
      var p = this.head;
      var c = 1;
      var ret = p.data;
      n -= ret.length;
      while (p = p.next) {
        var str = p.data;
        var nb = n > str.length ? str.length : n;
        if (nb === str.length) ret += str;else ret += str.slice(0, n);
        n -= nb;
        if (n === 0) {
          if (nb === str.length) {
            ++c;
            if (p.next) this.head = p.next;else this.head = this.tail = null;
          } else {
            this.head = p;
            p.data = str.slice(nb);
          }
          break;
        }
        ++c;
      }
      this.length -= c;
      return ret;
    }

    // Consumes a specified amount of bytes from the buffered data.
  }, {
    key: "_getBuffer",
    value: function _getBuffer(n) {
      var ret = Buffer.allocUnsafe(n);
      var p = this.head;
      var c = 1;
      p.data.copy(ret);
      n -= p.data.length;
      while (p = p.next) {
        var buf = p.data;
        var nb = n > buf.length ? buf.length : n;
        buf.copy(ret, ret.length - n, 0, nb);
        n -= nb;
        if (n === 0) {
          if (nb === buf.length) {
            ++c;
            if (p.next) this.head = p.next;else this.head = this.tail = null;
          } else {
            this.head = p;
            p.data = buf.slice(nb);
          }
          break;
        }
        ++c;
      }
      this.length -= c;
      return ret;
    }

    // Make sure the linked list only shows the minimal necessary information.
  }, {
    key: custom,
    value: function value(_, options) {
      return inspect(this, _objectSpread(_objectSpread({}, options), {}, {
        // Only inspect one level.
        depth: 0,
        // It should not recurse.
        customInspect: false
      }));
    }
  }]);
  return BufferList;
}();
},{"buffer":76,"util":75}],107:[function(require,module,exports){
(function (process){(function (){
'use strict';

// undocumented cb() API, needed for core, not for public API
function destroy(err, cb) {
  var _this = this;
  var readableDestroyed = this._readableState && this._readableState.destroyed;
  var writableDestroyed = this._writableState && this._writableState.destroyed;
  if (readableDestroyed || writableDestroyed) {
    if (cb) {
      cb(err);
    } else if (err) {
      if (!this._writableState) {
        process.nextTick(emitErrorNT, this, err);
      } else if (!this._writableState.errorEmitted) {
        this._writableState.errorEmitted = true;
        process.nextTick(emitErrorNT, this, err);
      }
    }
    return this;
  }

  // we set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks

  if (this._readableState) {
    this._readableState.destroyed = true;
  }

  // if this is a duplex stream mark the writable part as destroyed as well
  if (this._writableState) {
    this._writableState.destroyed = true;
  }
  this._destroy(err || null, function (err) {
    if (!cb && err) {
      if (!_this._writableState) {
        process.nextTick(emitErrorAndCloseNT, _this, err);
      } else if (!_this._writableState.errorEmitted) {
        _this._writableState.errorEmitted = true;
        process.nextTick(emitErrorAndCloseNT, _this, err);
      } else {
        process.nextTick(emitCloseNT, _this);
      }
    } else if (cb) {
      process.nextTick(emitCloseNT, _this);
      cb(err);
    } else {
      process.nextTick(emitCloseNT, _this);
    }
  });
  return this;
}
function emitErrorAndCloseNT(self, err) {
  emitErrorNT(self, err);
  emitCloseNT(self);
}
function emitCloseNT(self) {
  if (self._writableState && !self._writableState.emitClose) return;
  if (self._readableState && !self._readableState.emitClose) return;
  self.emit('close');
}
function undestroy() {
  if (this._readableState) {
    this._readableState.destroyed = false;
    this._readableState.reading = false;
    this._readableState.ended = false;
    this._readableState.endEmitted = false;
  }
  if (this._writableState) {
    this._writableState.destroyed = false;
    this._writableState.ended = false;
    this._writableState.ending = false;
    this._writableState.finalCalled = false;
    this._writableState.prefinished = false;
    this._writableState.finished = false;
    this._writableState.errorEmitted = false;
  }
}
function emitErrorNT(self, err) {
  self.emit('error', err);
}
function errorOrDestroy(stream, err) {
  // We have tests that rely on errors being emitted
  // in the same tick, so changing this is semver major.
  // For now when you opt-in to autoDestroy we allow
  // the error to be emitted nextTick. In a future
  // semver major update we should change the default to this.

  var rState = stream._readableState;
  var wState = stream._writableState;
  if (rState && rState.autoDestroy || wState && wState.autoDestroy) stream.destroy(err);else stream.emit('error', err);
}
module.exports = {
  destroy: destroy,
  undestroy: undestroy,
  errorOrDestroy: errorOrDestroy
};
}).call(this)}).call(this,require('_process'))
},{"_process":95}],108:[function(require,module,exports){
// Ported from https://github.com/mafintosh/end-of-stream with
// permission from the author, Mathias Buus (@mafintosh).

'use strict';

var ERR_STREAM_PREMATURE_CLOSE = require('../../../errors').codes.ERR_STREAM_PREMATURE_CLOSE;
function once(callback) {
  var called = false;
  return function () {
    if (called) return;
    called = true;
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    callback.apply(this, args);
  };
}
function noop() {}
function isRequest(stream) {
  return stream.setHeader && typeof stream.abort === 'function';
}
function eos(stream, opts, callback) {
  if (typeof opts === 'function') return eos(stream, null, opts);
  if (!opts) opts = {};
  callback = once(callback || noop);
  var readable = opts.readable || opts.readable !== false && stream.readable;
  var writable = opts.writable || opts.writable !== false && stream.writable;
  var onlegacyfinish = function onlegacyfinish() {
    if (!stream.writable) onfinish();
  };
  var writableEnded = stream._writableState && stream._writableState.finished;
  var onfinish = function onfinish() {
    writable = false;
    writableEnded = true;
    if (!readable) callback.call(stream);
  };
  var readableEnded = stream._readableState && stream._readableState.endEmitted;
  var onend = function onend() {
    readable = false;
    readableEnded = true;
    if (!writable) callback.call(stream);
  };
  var onerror = function onerror(err) {
    callback.call(stream, err);
  };
  var onclose = function onclose() {
    var err;
    if (readable && !readableEnded) {
      if (!stream._readableState || !stream._readableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
      return callback.call(stream, err);
    }
    if (writable && !writableEnded) {
      if (!stream._writableState || !stream._writableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
      return callback.call(stream, err);
    }
  };
  var onrequest = function onrequest() {
    stream.req.on('finish', onfinish);
  };
  if (isRequest(stream)) {
    stream.on('complete', onfinish);
    stream.on('abort', onclose);
    if (stream.req) onrequest();else stream.on('request', onrequest);
  } else if (writable && !stream._writableState) {
    // legacy streams
    stream.on('end', onlegacyfinish);
    stream.on('close', onlegacyfinish);
  }
  stream.on('end', onend);
  stream.on('finish', onfinish);
  if (opts.error !== false) stream.on('error', onerror);
  stream.on('close', onclose);
  return function () {
    stream.removeListener('complete', onfinish);
    stream.removeListener('abort', onclose);
    stream.removeListener('request', onrequest);
    if (stream.req) stream.req.removeListener('finish', onfinish);
    stream.removeListener('end', onlegacyfinish);
    stream.removeListener('close', onlegacyfinish);
    stream.removeListener('finish', onfinish);
    stream.removeListener('end', onend);
    stream.removeListener('error', onerror);
    stream.removeListener('close', onclose);
  };
}
module.exports = eos;
},{"../../../errors":99}],109:[function(require,module,exports){
module.exports = function () {
  throw new Error('Readable.from is not available in the browser')
};

},{}],110:[function(require,module,exports){
// Ported from https://github.com/mafintosh/pump with
// permission from the author, Mathias Buus (@mafintosh).

'use strict';

var eos;
function once(callback) {
  var called = false;
  return function () {
    if (called) return;
    called = true;
    callback.apply(void 0, arguments);
  };
}
var _require$codes = require('../../../errors').codes,
  ERR_MISSING_ARGS = _require$codes.ERR_MISSING_ARGS,
  ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED;
function noop(err) {
  // Rethrow the error if it exists to avoid swallowing it
  if (err) throw err;
}
function isRequest(stream) {
  return stream.setHeader && typeof stream.abort === 'function';
}
function destroyer(stream, reading, writing, callback) {
  callback = once(callback);
  var closed = false;
  stream.on('close', function () {
    closed = true;
  });
  if (eos === undefined) eos = require('./end-of-stream');
  eos(stream, {
    readable: reading,
    writable: writing
  }, function (err) {
    if (err) return callback(err);
    closed = true;
    callback();
  });
  var destroyed = false;
  return function (err) {
    if (closed) return;
    if (destroyed) return;
    destroyed = true;

    // request.destroy just do .end - .abort is what we want
    if (isRequest(stream)) return stream.abort();
    if (typeof stream.destroy === 'function') return stream.destroy();
    callback(err || new ERR_STREAM_DESTROYED('pipe'));
  };
}
function call(fn) {
  fn();
}
function pipe(from, to) {
  return from.pipe(to);
}
function popCallback(streams) {
  if (!streams.length) return noop;
  if (typeof streams[streams.length - 1] !== 'function') return noop;
  return streams.pop();
}
function pipeline() {
  for (var _len = arguments.length, streams = new Array(_len), _key = 0; _key < _len; _key++) {
    streams[_key] = arguments[_key];
  }
  var callback = popCallback(streams);
  if (Array.isArray(streams[0])) streams = streams[0];
  if (streams.length < 2) {
    throw new ERR_MISSING_ARGS('streams');
  }
  var error;
  var destroys = streams.map(function (stream, i) {
    var reading = i < streams.length - 1;
    var writing = i > 0;
    return destroyer(stream, reading, writing, function (err) {
      if (!error) error = err;
      if (err) destroys.forEach(call);
      if (reading) return;
      destroys.forEach(call);
      callback(error);
    });
  });
  return streams.reduce(pipe);
}
module.exports = pipeline;
},{"../../../errors":99,"./end-of-stream":108}],111:[function(require,module,exports){
'use strict';

var ERR_INVALID_OPT_VALUE = require('../../../errors').codes.ERR_INVALID_OPT_VALUE;
function highWaterMarkFrom(options, isDuplex, duplexKey) {
  return options.highWaterMark != null ? options.highWaterMark : isDuplex ? options[duplexKey] : null;
}
function getHighWaterMark(state, options, duplexKey, isDuplex) {
  var hwm = highWaterMarkFrom(options, isDuplex, duplexKey);
  if (hwm != null) {
    if (!(isFinite(hwm) && Math.floor(hwm) === hwm) || hwm < 0) {
      var name = isDuplex ? duplexKey : 'highWaterMark';
      throw new ERR_INVALID_OPT_VALUE(name, hwm);
    }
    return Math.floor(hwm);
  }

  // Default value
  return state.objectMode ? 16 : 16 * 1024;
}
module.exports = {
  getHighWaterMark: getHighWaterMark
};
},{"../../../errors":99}],112:[function(require,module,exports){
module.exports = require('events').EventEmitter;

},{"events":78}],113:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
/*</replacement>*/

var isEncoding = Buffer.isEncoding || function (encoding) {
  encoding = '' + encoding;
  switch (encoding && encoding.toLowerCase()) {
    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
      return true;
    default:
      return false;
  }
};

function _normalizeEncoding(enc) {
  if (!enc) return 'utf8';
  var retried;
  while (true) {
    switch (enc) {
      case 'utf8':
      case 'utf-8':
        return 'utf8';
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return 'utf16le';
      case 'latin1':
      case 'binary':
        return 'latin1';
      case 'base64':
      case 'ascii':
      case 'hex':
        return enc;
      default:
        if (retried) return; // undefined
        enc = ('' + enc).toLowerCase();
        retried = true;
    }
  }
};

// Do not cache `Buffer.isEncoding` when checking encoding names as some
// modules monkey-patch it to support additional encodings
function normalizeEncoding(enc) {
  var nenc = _normalizeEncoding(enc);
  if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
  return nenc || enc;
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters.
exports.StringDecoder = StringDecoder;
function StringDecoder(encoding) {
  this.encoding = normalizeEncoding(encoding);
  var nb;
  switch (this.encoding) {
    case 'utf16le':
      this.text = utf16Text;
      this.end = utf16End;
      nb = 4;
      break;
    case 'utf8':
      this.fillLast = utf8FillLast;
      nb = 4;
      break;
    case 'base64':
      this.text = base64Text;
      this.end = base64End;
      nb = 3;
      break;
    default:
      this.write = simpleWrite;
      this.end = simpleEnd;
      return;
  }
  this.lastNeed = 0;
  this.lastTotal = 0;
  this.lastChar = Buffer.allocUnsafe(nb);
}

StringDecoder.prototype.write = function (buf) {
  if (buf.length === 0) return '';
  var r;
  var i;
  if (this.lastNeed) {
    r = this.fillLast(buf);
    if (r === undefined) return '';
    i = this.lastNeed;
    this.lastNeed = 0;
  } else {
    i = 0;
  }
  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
  return r || '';
};

StringDecoder.prototype.end = utf8End;

// Returns only complete characters in a Buffer
StringDecoder.prototype.text = utf8Text;

// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
StringDecoder.prototype.fillLast = function (buf) {
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
  this.lastNeed -= buf.length;
};

// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
// continuation byte. If an invalid byte is detected, -2 is returned.
function utf8CheckByte(byte) {
  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
  return byte >> 6 === 0x02 ? -1 : -2;
}

// Checks at most 3 bytes at the end of a Buffer in order to detect an
// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
// needed to complete the UTF-8 character (if applicable) are returned.
function utf8CheckIncomplete(self, buf, i) {
  var j = buf.length - 1;
  if (j < i) return 0;
  var nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 1;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 2;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) {
      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
    }
    return nb;
  }
  return 0;
}

// Validates as many continuation bytes for a multi-byte UTF-8 character as
// needed or are available. If we see a non-continuation byte where we expect
// one, we "replace" the validated continuation bytes we've seen so far with
// a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
// behavior. The continuation byte check is included three times in the case
// where all of the continuation bytes for a character exist in the same buffer.
// It is also done this way as a slight performance increase instead of using a
// loop.
function utf8CheckExtraBytes(self, buf, p) {
  if ((buf[0] & 0xC0) !== 0x80) {
    self.lastNeed = 0;
    return '\ufffd';
  }
  if (self.lastNeed > 1 && buf.length > 1) {
    if ((buf[1] & 0xC0) !== 0x80) {
      self.lastNeed = 1;
      return '\ufffd';
    }
    if (self.lastNeed > 2 && buf.length > 2) {
      if ((buf[2] & 0xC0) !== 0x80) {
        self.lastNeed = 2;
        return '\ufffd';
      }
    }
  }
}

// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
function utf8FillLast(buf) {
  var p = this.lastTotal - this.lastNeed;
  var r = utf8CheckExtraBytes(this, buf, p);
  if (r !== undefined) return r;
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, p, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, p, 0, buf.length);
  this.lastNeed -= buf.length;
}

// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
// partial character, the character's bytes are buffered until the required
// number of bytes are available.
function utf8Text(buf, i) {
  var total = utf8CheckIncomplete(this, buf, i);
  if (!this.lastNeed) return buf.toString('utf8', i);
  this.lastTotal = total;
  var end = buf.length - (total - this.lastNeed);
  buf.copy(this.lastChar, 0, end);
  return buf.toString('utf8', i, end);
}

// For UTF-8, a replacement character is added when ending on a partial
// character.
function utf8End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + '\ufffd';
  return r;
}

// UTF-16LE typically needs two bytes per character, but even if we have an even
// number of bytes available, we need to check if we end on a leading/high
// surrogate. In that case, we need to wait for the next two bytes in order to
// decode the last character properly.
function utf16Text(buf, i) {
  if ((buf.length - i) % 2 === 0) {
    var r = buf.toString('utf16le', i);
    if (r) {
      var c = r.charCodeAt(r.length - 1);
      if (c >= 0xD800 && c <= 0xDBFF) {
        this.lastNeed = 2;
        this.lastTotal = 4;
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
        return r.slice(0, -1);
      }
    }
    return r;
  }
  this.lastNeed = 1;
  this.lastTotal = 2;
  this.lastChar[0] = buf[buf.length - 1];
  return buf.toString('utf16le', i, buf.length - 1);
}

// For UTF-16LE we do not explicitly append special replacement characters if we
// end on a partial character, we simply let v8 handle that.
function utf16End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) {
    var end = this.lastTotal - this.lastNeed;
    return r + this.lastChar.toString('utf16le', 0, end);
  }
  return r;
}

function base64Text(buf, i) {
  var n = (buf.length - i) % 3;
  if (n === 0) return buf.toString('base64', i);
  this.lastNeed = 3 - n;
  this.lastTotal = 3;
  if (n === 1) {
    this.lastChar[0] = buf[buf.length - 1];
  } else {
    this.lastChar[0] = buf[buf.length - 2];
    this.lastChar[1] = buf[buf.length - 1];
  }
  return buf.toString('base64', i, buf.length - n);
}

function base64End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
  return r;
}

// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
function simpleWrite(buf) {
  return buf.toString(this.encoding);
}

function simpleEnd(buf) {
  return buf && buf.length ? this.write(buf) : '';
}
},{"safe-buffer":96}],114:[function(require,module,exports){
(function (global){(function (){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[9])(9)
});
