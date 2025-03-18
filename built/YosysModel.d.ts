declare namespace Yosys {
    enum ConstantVal {
        Zero = "0",
        One = "1",
        X = "x",
        Z = "z"
    }
    type Signal = number | ConstantVal;
    type Signals = Signal[];
    interface ModuleMap {
        [moduleName: string]: Module;
    }
    interface Netlist {
        modules: ModuleMap;
    }
    interface ModuleAttributes {
        top?: 0 | 1 | "00000000000000000000000000000000" | "00000000000000000000000000000001";
        [attrName: string]: any;
    }
    interface NetAttributes {
        [attrName: string]: any;
    }
    interface CellAttributes {
        value?: string;
        [attrName: string]: any;
    }
    enum Direction {
        Input = "input",
        Output = "output",
        Inout = "inout"
    }
    interface ExtPort {
        direction: Direction;
        bits: Signals;
    }
    type ExtPortMap = Record<string, ExtPort>;
    type PortDirMap = Record<string, Direction>;
    type PortConnectionMap = Record<string, Signals>;
    interface Cell {
        type: string;
        port_directions?: PortDirMap;
        connections: PortConnectionMap;
        attributes?: CellAttributes;
        hide_name?: HideName;
        parameters?: Record<string, any>;
    }
    const getInputPortPids: (cell: Cell) => string[];
    const getOutputPortPids: (cell: Cell) => string[];
    type CellMap = Record<string, Cell>;
    const enum HideName {
        Hide = 0,// Defaults to 0
        NoHide = 1
    }
    interface Net {
        bits: Signals;
        hide_name: HideName;
        attributes: NetAttributes;
    }
    type NetNameMap = Record<string, Net>;
    interface Module {
        ports: ExtPortMap;
        cells: CellMap;
        netNames: NetNameMap;
        attributes?: ModuleAttributes;
    }
}
export default Yosys;
//# sourceMappingURL=YosysModel.d.ts.map