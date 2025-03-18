import Yosys from './YosysModel';
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
export declare function arrayContains(needle: string, haystack: string | string[]): boolean;
export declare function indexOfContains(needle: string, haystack: string[]): number;
export declare function addToDefaultDict(dict: Record<string, string[]>, key: string, value: string): void;
export declare function getIndicesString(bitstring: string, query: string, start: number): string;
export declare function gather(inputs: string[], outputs: string[], toSolve: string, start: number, end: number, splits: SplitJoin, joins: SplitJoin): void;
export declare class FlatModule {
    moduleName: string;
    nodes: Cell[];
    wires: Wire[];
    constructor(netlist: Yosys.Netlist);
    addConstants(): void;
    addSplitsJoins(): void;
    createWires(): void;
}
export {};
//# sourceMappingURL=FlatModule.d.ts.map