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
        return Math.max(...this.value.map(Number));
    }
    valString() {
        return ',' + this.value.join() + ',';
    }
    findConstants(sigsByConstantName, maxNum, constantCollector, parent) {
        let constName = '';
        let constNums = [];
        for (let i = 0; i < this.value.length; i++) {
            const portSig = this.value[i];
            if (portSig === '0' || portSig === '1' || portSig === 'x') {
                maxNum += 1;
                constName += portSig;
                this.value[i] = maxNum;
                constNums.push(maxNum);
            }
            else if (constName.length > 0) {
                this.assignConstant(constName, constNums, sigsByConstantName, constantCollector, parent);
                constName = '';
                constNums = [];
            }
        }
        if (constName.length > 0) {
            this.assignConstant(constName, constNums, sigsByConstantName, constantCollector, parent);
        }
        return maxNum;
    }
    getGenericElkPort(index, templatePorts, dir) {
        if (!this.parentNode) {
            throw new Error('Port has no parentNode');
        }
        // Namespace the port id with the module that owns the parent cell so
        // that cells of different (recursively expanded) modules never collide.
        const nodeKey = `${this.parentNode.parent}.${this.parentNode.Key}`;
        const type = this.parentNode.getTemplate()[1]['s:type'];
        const isSub = type === 'sub_odd' || type === 'sub_even';
        const x = Number(templatePorts[0][1]['s:x']);
        const y = Number(templatePorts[0][1]['s:y']);
        const portId = `${nodeKey}.${this.key}`;
        const portY = index === 0 ? y :
            index * (Number(templatePorts[1][1]['s:y']) - y) + y;
        const elkPort = {
            id: portId,
            width: 1,
            height: 1,
            x,
            y: portY,
        };
        const needsLabel = (type === 'generic' || isSub ||
            (type === 'join' && dir === 'in') ||
            (type === 'split' && dir === 'out'));
        if (needsLabel) {
            elkPort.labels = [{
                    id: `${portId}.label`,
                    text: this.key,
                    x: Number(templatePorts[0][2][1].x) - 10,
                    y: Number(templatePorts[0][2][1].y) - 6,
                    width: 6 * this.key.length,
                    height: 11,
                }];
        }
        // Expanded submodules use fixed-side ports laid out by ELK, so they are
        // pinned to a side rather than an explicit (x, y) position.
        if (isSub) {
            elkPort.layoutOptions = {
                'org.eclipse.elk.port.side': dir === 'in' ? 'WEST' : 'EAST',
            };
            delete elkPort.x;
            delete elkPort.y;
        }
        return elkPort;
    }
    assignConstant(name, constants, signalsByConstantName, constantCollector, parent) {
        const reversedName = name.split('').reverse().join('');
        if (signalsByConstantName[reversedName]) {
            const constSigs = signalsByConstantName[reversedName];
            const firstConstIndex = this.value.indexOf(constants[0]);
            if (firstConstIndex >= 0) {
                for (let i = 0; i < constSigs.length; i++) {
                    this.value[firstConstIndex + i] = constSigs[i];
                }
            }
        }
        else {
            constantCollector.push(Cell_1.default.fromConstantInfo(reversedName, constants, parent));
            signalsByConstantName[reversedName] = constants;
        }
    }
}
exports.Port = Port;
//# sourceMappingURL=Port.js.map