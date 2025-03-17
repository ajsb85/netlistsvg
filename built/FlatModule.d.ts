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
export declare class FlatModule {
    moduleName: string;
    nodes: Cell[];
    wires: Wire[];
    constructor(netlist: Yosys.Netlist);
    addConstants(): void;
    addSplitsJoins(): void;
    createWires(): void;
}
export interface SigsByConstName {
    [constantName: string]: number[];
}
export declare function arrayToBitstring(bitArray: number[]): string;
export declare function addToDefaultDict(dict: any, key: string, value: any): void;
export interface NameToPorts {
    [netName: string]: FlatPort[];
}
export declare function removeDups(inStrs: string[]): string[];
//# sourceMappingURL=FlatModule.d.ts.map