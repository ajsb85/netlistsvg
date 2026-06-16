// FlatModule.ts
import Yosys from './YosysModel';
import Config from './ConfigModel';
import Skin from './Skin';
import Cell from './Cell';

// Core interfaces
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

// Utility functions
export function arrayToBitstring(bitArray: number[]): string {
    return `,${bitArray.join(',')},`;
}

export function contains(needle: string, haystack: string | string[]): boolean {
    return haystack.includes(needle);
}

export function findIndexContaining(needle: string, haystack: string[]): number {
    return haystack.findIndex(item => item.includes(needle));
}

export function addToCollection<T>(collection: Record<string, T[]>, key: string, value: T): void {
    // Initialize array if it doesn't exist, then add the value
    (collection[key] ??= []).push(value);
}

export function getIndicesString(bitstring: string, query: string, start: number): string {
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
export function processSplitsAndJoins(
    inputs: string[],
    outputs: string[],
    targetSignal: string,
    start: number,
    end: number,
    splits: SplitJoin,
    joins: SplitJoin
): void {
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
    const newEnd = targetSignal.substring(0, end - 1).lastIndexOf(',') + 1;
    processSplitsAndJoins(inputs, outputs, targetSignal, start, newEnd, splits, joins);
}

/**
 * Represents a flattened module from a Yosys netlist
 */
export class FlatModule {
    // Shared state for a single render pass (set up by fromNetlist).
    public static netlist: Yosys.Netlist;
    public static layoutProps: { [x: string]: any };
    public static modNames: string[];
    public static config: Config;

    /**
     * Entry point for building a (possibly hierarchical) FlatModule from a Yosys
     * netlist and a configuration. Selects the top module, then recursively flattens
     * it according to the hierarchy settings in the config.
     */
    public static fromNetlist(netlist: Yosys.Netlist, config: Config): FlatModule {
        this.layoutProps = Skin.getProperties();
        this.modNames = Object.keys(netlist.modules);
        this.netlist = netlist;
        this.config = config;

        let topName: string | null = null;
        if (config.top.enable) {
            topName = config.top.module;
            if (!this.modNames.includes(topName)) {
                throw new Error('Top module in config file not defined in input json file.');
            }
        } else {
            Object.entries(netlist.modules).forEach(([name, mod]) => {
                if (mod.attributes && Number(mod.attributes.top) === 1) {
                    topName = name;
                }
            });
            // Otherwise default the first one in the file...
            if (topName == null) {
                topName = this.modNames[0];
            }
        }
        const top = netlist.modules[topName];
        return new FlatModule(top, topName, 0);
    }

    // name of the parent module (null for the top module)
    public parent: string | null;
    public moduleName: string;
    public nodes: Cell[];
    public wires: Wire[];

    /**
     * Create a FlatModule for a single module. `depth` is the hierarchy depth
     * (0 for the top module) and `parent` is the name of the enclosing module.
     */
    constructor(mod: Yosys.Module, name: string, depth: number, parent: string | null = null) {
        this.parent = parent;
        this.moduleName = name;

        const ports = Object.entries(mod.ports).map(([portName, portData]) =>
            Cell.fromPort(portData, portName, this.moduleName));

        const cells = Object.entries(mod.cells).map(([key, c]) =>
            this.buildCell(c, key, depth));

        this.nodes = cells.concat(ports);
        this.wires = []; // populated by createWires below

        // this can be skipped if there are no 0's or 1's
        if (FlatModule.layoutProps.constants !== false) {
            this.addConstants();
        }
        // this can be skipped if there are no splits or joins
        if (FlatModule.layoutProps.splitsAndJoins !== false) {
            this.addSplitsJoins();
        }
        this.createWires();
    }

    /**
     * Decide whether a child cell should be rendered as an expanded submodule or as
     * an opaque box, based on the hierarchy configuration and current depth.
     */
    private buildCell(c: Yosys.Cell, key: string, depth: number): Cell {
        const cfg = FlatModule.config.hierarchy;
        const isModule = FlatModule.modNames.includes(c.type);
        const expand = (): Cell => Cell.createSubModule(
            c, key, this.moduleName, FlatModule.netlist.modules[c.type], depth);
        const box = (): Cell => Cell.fromYosysCell(c, key, this.moduleName);

        switch (cfg.enable) {
            case 'level':
                return (cfg.expandLevel > depth && isModule) ? expand() : box();
            case 'all':
                return isModule ? expand() : box();
            case 'modules':
                if (cfg.expandModules.types.includes(c.type) || cfg.expandModules.ids.includes(key)) {
                    if (!isModule) {
                        throw new Error('Submodule in config file not defined in input json file.');
                    }
                    return expand();
                }
                return box();
            default:
                return box();
        }
    }

    /**
     * Add constant value nodes to the module
     */
    public addConstants(): void {
        let maxNum = this.nodes.reduce((acc, node) => node.maxOutVal(acc), -1);
        const signalsByConstantName: SigsByConstName = {};
        const newCells: Cell[] = [];

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
    public addSplitsJoins(): void {
        const allInputs = this.nodes.flatMap(node => node.inputPortVals());
        const allOutputs = this.nodes.flatMap(node => node.outputPortVals());
        const inputsCopy = allInputs.slice();

        const splits: SplitJoin = {};
        const joins: SplitJoin = {};

        // Process all inputs to find splits and joins
        for (const input of allInputs) {
            processSplitsAndJoins(allOutputs, inputsCopy, input, 0, input.length, splits, joins);
        }

        // Create new cells for joins and splits
        const joinCells = Object.entries(joins).map(([joinInput, joinOutputs]) =>
            Cell.fromJoinInfo(joinInput, joinOutputs, this.moduleName)
        );

        const splitCells = Object.entries(splits).map(([splitInput, splitOutputs]) =>
            Cell.fromSplitInfo(splitInput, splitOutputs, this.moduleName)
        );

        // Add new cells to the module
        this.nodes.push(...joinCells, ...splitCells);
    }

    /**
     * Create wire connections between nodes
     */
    public createWires(): void {
        const layoutProps = Skin.getProperties();
        const ridersByNet: NameToPorts = {};
        const driversByNet: NameToPorts = {};
        const lateralsByNet: NameToPorts = {};

        // Collect ports by direction
        this.nodes.forEach(node =>
            node.collectPortsByDirection(
                ridersByNet,
                driversByNet,
                lateralsByNet,
                layoutProps.genericsLaterals as boolean
            )
        );

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

            const wire: Wire = { netName, drivers, riders, laterals };

            // Connect ports to their wire
            [...drivers, ...riders, ...laterals].forEach(port => {
                port.wire = wire;
            });

            return wire;
        });
    }
}