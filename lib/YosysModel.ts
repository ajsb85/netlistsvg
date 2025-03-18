namespace Yosys {
    // Use string enums for better readability and type safety
    export enum ConstantVal {
        Zero = '0',
        One = '1',
        X = 'x',
        Z = 'z', // Added Z for completeness
    }

    // More descriptive type alias
    export type Signal = number | ConstantVal;
    export type Signals = Signal[];

    // Use generics for map types
    export interface ModuleMap {
        [moduleName: string]: Module;
    }

    // Use indexed access types for consistency
    export interface Netlist {
        modules: ModuleMap;
    }

    // More specific types for attributes
    export interface ModuleAttributes {
        top?: 0 | 1 | "00000000000000000000000000000000" | "00000000000000000000000000000001"; // Match schema
        [attrName: string]: any; // Consider more specific types if possible
    }

    export interface NetAttributes {
        [attrName: string]: any;  // Consider more specific types if possible
    }

    export interface CellAttributes {
        value?: string; // value is usually a string.
        [attrName: string]: any;  // Consider more specific types if possible
    }

    export enum Direction {
        Input = 'input',
        Output = 'output',
        Inout = 'inout', // Added Inout for completeness
    }

    export interface ExtPort {
        direction: Direction;
        bits: Signals;
    }

    // Use Record<string, T> for maps where the key is always a string
    export type ExtPortMap = Record<string, ExtPort>;
    export type PortDirMap = Record<string, Direction>;
    export type PortConnectionMap = Record<string, Signals>;

    export interface Cell {
        type: string;
        port_directions?: PortDirMap; // Optional, as per your schema
        connections: PortConnectionMap;
        attributes?: CellAttributes;
        hide_name?: HideName;
        parameters?: Record<string, any>; // More concise than { [key: string]: any }
    }


    // Helper functions to get input/output port IDs (made more concise)
    export const getInputPortPids = (cell: Cell): string[] =>
        Object.entries(cell.port_directions || {}) // Safe access with || {}
            .filter(([, direction]) => direction === Direction.Input)
            .map(([portName]) => portName);

    export const getOutputPortPids = (cell: Cell): string[] =>
        Object.entries(cell.port_directions || {})
            .filter(([, direction]) => direction === Direction.Output)
            .map(([portName]) => portName);


    export type CellMap = Record<string, Cell>;

    // Use const enum for efficiency, if these values are only used at compile time
    export const enum HideName {
        Hide,  // Defaults to 0
        NoHide, // Defaults to 1
    }

    export interface Net {
        bits: Signals;
        hide_name: HideName;
        attributes: NetAttributes;
    }

    export type NetNameMap = Record<string, Net>;

    export interface Module {
        ports: ExtPortMap;
        cells: CellMap;
        netNames: NetNameMap;
        attributes?: ModuleAttributes;
    }
}
export default Yosys;