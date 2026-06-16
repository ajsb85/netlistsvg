import Yosys from './YosysModel';
import Config from './ConfigModel';
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
export declare function arrayToBitstring(bitArray: number[]): string;
export declare function contains(needle: string, haystack: string | string[]): boolean;
export declare function findIndexContaining(needle: string, haystack: string[]): number;
export declare function addToCollection<T>(collection: Record<string, T[]>, key: string, value: T): void;
export declare function getIndicesString(bitstring: string, query: string, start: number): string;
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
export declare function processSplitsAndJoins(inputs: string[], outputs: string[], targetSignal: string, start: number, end: number, splits: SplitJoin, joins: SplitJoin): void;
/**
 * Represents a flattened module from a Yosys netlist
 */
export declare class FlatModule {
    static netlist: Yosys.Netlist;
    static layoutProps: {
        [x: string]: any;
    };
    static modNames: string[];
    static config: Config;
    /**
     * Entry point for building a (possibly hierarchical) FlatModule from a Yosys
     * netlist and a configuration. Selects the top module, then recursively flattens
     * it according to the hierarchy settings in the config.
     */
    static fromNetlist(netlist: Yosys.Netlist, config: Config): FlatModule;
    parent: string | null;
    moduleName: string;
    nodes: Cell[];
    wires: Wire[];
    /**
     * Create a FlatModule for a single module. `depth` is the hierarchy depth
     * (0 for the top module) and `parent` is the name of the enclosing module.
     */
    constructor(mod: Yosys.Module, name: string, depth: number, parent?: string | null);
    /**
     * Decide whether a child cell should be rendered as an expanded submodule or as
     * an opaque box, based on the hierarchy configuration and current depth.
     */
    private buildCell;
    /**
     * Add constant value nodes to the module
     */
    addConstants(): void;
    /**
     * Add split and join nodes to the module
     */
    addSplitsJoins(): void;
    /**
     * Create wire connections between nodes
     */
    createWires(): void;
}
export {};
//# sourceMappingURL=FlatModule.d.ts.map