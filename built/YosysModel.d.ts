declare namespace Yosys {
    enum ConstantVal {
        Zero = "0",
        One = "1",
        X = "x",
        Z = "z"
    }
    type Signal = number | ConstantVal;
    type Signals = Signal[];
    enum Direction {
        Input = "input",
        Output = "output",
        Inout = "inout"
    }
    enum HideName {
        Hide = 0,
        NoHide = 1
    }
    interface ExtPort {
        direction: Direction;
        bits: Signals;
    }
    interface Cell {
        type: string;
        port_directions?: Record<string, Direction>;
        connections: Record<string, Signals>;
        attributes?: Record<string, any>;
        hide_name?: HideName;
        parameters?: Record<string, any>;
    }
    interface Net {
        bits: Signals;
        hide_name: HideName;
        attributes: Record<string, any>;
    }
    interface Module {
        ports: Record<string, ExtPort>;
        cells: Record<string, Cell>;
        netNames: Record<string, Net>;
        attributes?: {
            top?: 0 | 1 | "00000000000000000000000000000000" | "00000000000000000000000000000001";
            [attrName: string]: any;
        };
    }
    interface Netlist {
        modules: Record<string, Module>;
    }
    const getInputPortPids: (cell: Cell) => string[];
    const getOutputPortPids: (cell: Cell) => string[];
}
export default Yosys;
//# sourceMappingURL=YosysModel.d.ts.map