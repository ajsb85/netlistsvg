namespace Yosys {
    export enum ConstantVal {
      Zero = '0',
      One = '1',
      X = 'x',
      Z = 'z',
    }
  
    export type Signal = number | ConstantVal;
    export type Signals = Signal[];
  
    export enum Direction {
      Input = 'input',
      Output = 'output',
      Inout = 'inout',
    }
  
    export enum HideName {
      Hide,
      NoHide,
    }
  
    export interface ExtPort {
      direction: Direction;
      bits: Signals;
    }
  
    export interface Cell {
      type: string;
      port_directions?: Record<string, Direction>;
      connections: Record<string, Signals>;
      attributes?: Record<string, any>;
      hide_name?: HideName;
      parameters?: Record<string, any>;
    }
  
    export interface Net {
      bits: Signals;
      hide_name: HideName;
      attributes: Record<string, any>;
    }
  
    export interface Module {
      ports: Record<string, ExtPort>;
      cells: Record<string, Cell>;
      netNames: Record<string, Net>;
      attributes?: {
        top?: 0 | 1 | "00000000000000000000000000000000" | "00000000000000000000000000000001";
        [attrName: string]: any;
      };
    }
  
    export interface Netlist {
      modules: Record<string, Module>;
    }
  
    export const getInputPortPids = (cell: Cell): string[] =>
      Object.entries(cell.port_directions || {})
        .filter(([, dir]) => dir === Direction.Input)
        .map(([name]) => name);
  
    export const getOutputPortPids = (cell: Cell): string[] =>
      Object.entries(cell.port_directions || {})
        .filter(([, dir]) => dir === Direction.Output)
        .map(([name]) => name);
  }
  
  export default Yosys;