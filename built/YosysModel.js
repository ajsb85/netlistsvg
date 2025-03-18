"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Yosys;
(function (Yosys) {
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
    let HideName;
    (function (HideName) {
        HideName[HideName["Hide"] = 0] = "Hide";
        HideName[HideName["NoHide"] = 1] = "NoHide";
    })(HideName = Yosys.HideName || (Yosys.HideName = {}));
    Yosys.getInputPortPids = (cell) => Object.entries(cell.port_directions || {})
        .filter(([, dir]) => dir === Direction.Input)
        .map(([name]) => name);
    Yosys.getOutputPortPids = (cell) => Object.entries(cell.port_directions || {})
        .filter(([, dir]) => dir === Direction.Output)
        .map(([name]) => name);
})(Yosys || (Yosys = {}));
exports.default = Yosys;
//# sourceMappingURL=YosysModel.js.map