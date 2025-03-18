"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Yosys;
(function (Yosys) {
    // Use string enums for better readability and type safety
    let ConstantVal;
    (function (ConstantVal) {
        ConstantVal["Zero"] = "0";
        ConstantVal["One"] = "1";
        ConstantVal["X"] = "x";
        ConstantVal["Z"] = "z";
    })(ConstantVal = Yosys.ConstantVal || (Yosys.ConstantVal = {}));
    let Direction;
    (function (Direction) {
        Direction["Input"] = "input";
        Direction["Output"] = "output";
        Direction["Inout"] = "inout";
    })(Direction = Yosys.Direction || (Yosys.Direction = {}));
    // Helper functions to get input/output port IDs (made more concise)
    Yosys.getInputPortPids = (cell) => Object.entries(cell.port_directions || {}) // Safe access with || {}
        .filter(([, direction]) => direction === Direction.Input)
        .map(([portName]) => portName);
    Yosys.getOutputPortPids = (cell) => Object.entries(cell.port_directions || {})
        .filter(([, direction]) => direction === Direction.Output)
        .map(([portName]) => portName);
})(Yosys || (Yosys = {}));
exports.default = Yosys;
//# sourceMappingURL=YosysModel.js.map