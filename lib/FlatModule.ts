import Yosys from './YosysModel';
import Skin from './Skin';
import Cell from './Cell';

export interface FlatPort {
    key: string;
    value?: number[] | Yosys.Signals;
    parentNode?: Cell;
    wire?: Wire;
}

export interface Wire {
    netName: string;
    drivers: FlatPort[];
    riders: FlatPort[];
    laterals: FlatPort[];
}

export class FlatModule {
    public moduleName: string;
    public nodes: Cell[];
    public wires: Wire[];

    constructor(netlist: Yosys.Netlist) {
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
        const ports = Object.entries(top.ports).map(([key, portData]) => Cell.fromPort(portData, key));
        const cells = Object.entries(top.cells).map(([key, cellData]) => Cell.fromYosysCell(cellData, key));

        this.nodes = cells.concat(ports);
        // populated by createWires
        this.wires = [];
    }

    // converts input ports with constant assignments to constant nodes
    public addConstants(): void {
        // find the maximum signal number
        let maxNum: number = this.nodes.reduce(((acc, v) => v.maxOutVal(acc)), -1);

        // add constants to nodes
        const signalsByConstantName: SigsByConstName = {};
        const cells: Cell[] = [];
        this.nodes.forEach((n) => {
            maxNum = n.findConstants(signalsByConstantName, maxNum, cells);
        });
        this.nodes = this.nodes.concat(cells);
    }

    // solves for minimal bus splits and joins and adds them to module
    public addSplitsJoins(): void {
        const allInputs = this.nodes.flatMap((n) => n.inputPortVals());
        const allOutputs = this.nodes.flatMap((n) => n.outputPortVals());

        const allInputsCopy = allInputs.slice();
        const splits: SplitJoin = {};
        const joins: SplitJoin = {};
        allInputs.forEach((input) => {
            gather(
                allOutputs,
                allInputsCopy,
                input,
                0,
                input.length,
                splits,
                joins);
        });
        const joinCells = Object.entries(joins).map(([joinInputs, joinOutput]) => {
            return Cell.fromJoinInfo(joinInputs, joinOutput[0]); // joinOutput is an array
        });
        const splitCells = Object.entries(splits).map(([splitInput, splitOutputs]) => {
            return Cell.fromSplitInfo(splitInput, splitOutputs);
        });

        this.nodes = this.nodes.concat(joinCells, splitCells);
    }

    // search through all the ports to find all of the wires
    public createWires() {
        const layoutProps = Skin.getProperties();
        const ridersByNet: NameToPorts = {};
        const driversByNet: NameToPorts = {};
        const lateralsByNet: NameToPorts = {};
        this.nodes.forEach((n) => {
            n.collectPortsByDirection(
                ridersByNet,
                driversByNet,
                lateralsByNet,
                layoutProps.genericsLaterals as boolean);
        });
        // list of unique nets
        const allKeys = Object.keys(ridersByNet).concat(Object.keys(driversByNet)).concat(Object.keys(lateralsByNet));

        const nets = removeDups(allKeys);

        const wires: Wire[] = nets.map((net) => {
            const drivers: FlatPort[] = driversByNet[net] || [];
            const riders: FlatPort[] = ridersByNet[net] || [];
            const laterals: FlatPort[] = lateralsByNet[net] || [];
            const wire: Wire = { netName: net, drivers, riders, laterals };
            drivers.concat(riders).concat(laterals).forEach((port) => {
                port.wire = wire;
            });
            return wire;
        });
        this.wires = wires;
    }
}

export interface SigsByConstName {
    [constantName: string]: number[];
}

// returns a string that represents the values of the array of integers
// [1, 2, 3] -> ',1,2,3,'
export function arrayToBitstring(bitArray: number[]): string {
    return ',' + bitArray.join(',') + ',';
}

// returns whether needle is a substring of haystack
function arrayContains(needle: string, haystack: string | string[]): boolean {
    return (haystack.indexOf(needle) > -1);
}

// returns the index of the string that contains a substring
// given arrhaystack, an array of strings
function indexOfContains(needle: string, arrhaystack: string[]): number {
    return arrhaystack.findIndex((haystack: string) => {
        return arrayContains(needle, haystack);
    });
}

interface SplitJoin {
    [portName: string]: string[];
}

export function addToDefaultDict(dict: any, key: string, value: any): void {
    if (dict[key] === undefined) {
        dict[key] = [value];
    } else {
        dict[key].push(value);
    }
}

// string (for labels), that represents an index
// or range of indices.
function getIndicesString(bitstring: string,
                          query: string,
                          start: number): string {

    const splitStart: number = Math.max(bitstring.indexOf(query), start);
    const startIndex: number = bitstring.substring(0, splitStart).split(',').length - 1;
    const endIndex: number = startIndex + query.split(',').length - 3;

    if (startIndex === endIndex) {
        return String(startIndex);
    } else {
        return String(startIndex) + ':' + String(endIndex);
    }
}

// gather splits and joins
function gather(inputs: string[],  // all inputs
                outputs: string[], // all outputs
                toSolve: string, // an input array we are trying to solve
                start: number,   // index of toSolve to start from
                end: number,     // index of toSolve to end at
                splits: SplitJoin,  // container collecting the splits
                joins: SplitJoin): void {  // container collecting the joins
    // remove myself from outputs list if present
    const outputIndex: number = outputs.indexOf(toSolve);
    if (outputIndex !== -1) {
        outputs.splice(outputIndex, 1);
    }

    // This toSolve is compconste
    if (start >= toSolve.length || end - start < 2) {
        return;
    }

    const query: string = toSolve.slice(start, end);

    // are there are perfect matches?
    if (arrayContains(query, inputs)) {
        if (query !== toSolve) {
            addToDefaultDict(joins, toSolve, getIndicesString(toSolve, query, start));
        }
        gather(inputs, outputs, toSolve, end - 1, toSolve.length, splits, joins);
        return;
    }
    const index: number = indexOfContains(query, inputs);
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

export interface NameToPorts {
    [netName: string]: FlatPort[];
}

interface StringToBool {
    [s: string]: boolean;
}

export function removeDups(inStrs: string[]): string[] {
    const map: StringToBool = {};
    inStrs.forEach((str) => {
        map[str] = true;
    });
    return Object.keys(map);
}