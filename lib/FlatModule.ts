// FlatModule.ts
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

export interface SigsByConstName {
    [constantName: string]: number[];
}

export interface NameToPorts {
    [netName: string]: FlatPort[];
}

interface SplitJoin {
    [portName: string]: string[];
}

// Helper functions (outside the class) -  These are now *exported*

export function arrayToBitstring(bitArray: number[]): string {
    return `,${bitArray.join(',')},`;
}

export function arrayContains(needle: string, haystack: string | string[]): boolean {
    return haystack.includes(needle);
}

export function indexOfContains(needle: string, haystack: string[]): number {
    return haystack.findIndex(hay => hay.includes(needle));
}

export function addToDefaultDict(dict: Record<string, string[]>, key: string, value: string): void {
    (dict[key] ??= []).push(value);
}

export function getIndicesString(bitstring: string, query: string, start: number): string {
    const splitStart = Math.max(bitstring.indexOf(query), start);
    const startIndex = bitstring.substring(0, splitStart).split(',').length - 1;
    const endIndex = startIndex + query.split(',').length - 3;
    return startIndex === endIndex ? String(startIndex) : `${startIndex}:${endIndex}`;
}
export function gather(
    inputs: string[],
    outputs: string[],
    toSolve: string,
    start: number,
    end: number,
    splits: SplitJoin,
    joins: SplitJoin
): void {

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



export class FlatModule {
    public moduleName: string;
    public nodes: Cell[];
    public wires: Wire[];

    constructor(netlist: Yosys.Netlist) {
        this.moduleName = Object.keys(netlist.modules).find(name =>
            netlist.modules[name].attributes?.top === 1
        ) || Object.keys(netlist.modules)[0]; // Find top module or default

        const top = netlist.modules[this.moduleName];
        this.nodes = [
            ...Object.entries(top.ports).map(([key, portData]) => Cell.fromPort(portData, key)),
            ...Object.entries(top.cells).map(([key, cellData]) => Cell.fromYosysCell(cellData, key)),
        ];
        this.wires = []; // Populated by createWires
    }

    public addConstants(): void {
        let maxNum = this.nodes.reduce((acc, v) => v.maxOutVal(acc), -1);
        const signalsByConstantName: SigsByConstName = {};
        const newCells: Cell[] = [];
        this.nodes.forEach(node => {
            maxNum = node.findConstants(signalsByConstantName, maxNum, newCells);
        });
        this.nodes.push(...newCells);
    }

    public addSplitsJoins(): void {
        const allInputs = this.nodes.flatMap(node => node.inputPortVals());
        const allOutputs = this.nodes.flatMap(node => node.outputPortVals());

        const splits: SplitJoin = {};
        const joins: SplitJoin = {};

        const allInputsCopy = allInputs.slice();
        for (const input of allInputs) {
            gather(allOutputs, allInputsCopy, input, 0, input.length, splits, joins);
        }

        const joinCells = Object.entries(joins).map(([joinInputs, [joinOutput]]) =>
            Cell.fromJoinInfo(joinInputs, joinOutput)
        );
        const splitCells = Object.entries(splits).map(([splitInput, splitOutputs]) =>
            Cell.fromSplitInfo(splitInput, splitOutputs)
        );

        this.nodes.push(...joinCells, ...splitCells);
    }

    public createWires() {
        const layoutProps = Skin.getProperties();
        const ridersByNet: NameToPorts = {};
        const driversByNet: NameToPorts = {};
        const lateralsByNet: NameToPorts = {};

        this.nodes.forEach(node =>
            node.collectPortsByDirection( // Corrected call
                ridersByNet,
                driversByNet,
                lateralsByNet,
                layoutProps.genericsLaterals as boolean
            )
        );

        const allKeys = [...Object.keys(ridersByNet), ...Object.keys(driversByNet), ...Object.keys(lateralsByNet)];
        const nets = [...new Set(allKeys)]; // Use Set for unique nets

        this.wires = nets.map(net => {
            const drivers: FlatPort[] = driversByNet[net] || [];
            const riders: FlatPort[] = ridersByNet[net] || [];
            const laterals: FlatPort[] = lateralsByNet[net] || [];
            const wire: Wire = { netName: net, drivers, riders, laterals };
            [...drivers, ...riders, ...laterals].forEach(port => port.wire = wire);
            return wire;
        });
    }
}