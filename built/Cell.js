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
                (0, FlatModule_1.addToCollection)(lateralsByNet, port.valString(), port);
            }
            else {
                (0, FlatModule_1.addToCollection)(ridersByNet, port.valString(), port);
            }
        });
        this.outputPorts.forEach((port) => {
            const isLateral = port.keyIn(lateralPids);
            if (isLateral || (template[1]['s:type'] === 'generic' && genericsLaterals)) {
                (0, FlatModule_1.addToCollection)(lateralsByNet, port.valString(), port);
            }
            else {
                (0, FlatModule_1.addToCollection)(driversByNet, port.valString(), port);
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
//# sourceMappingURL=Cell.js.map