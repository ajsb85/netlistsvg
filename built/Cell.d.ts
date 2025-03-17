import { SigsByConstName, NameToPorts } from './FlatModule';
import Yosys from './YosysModel';
import { Port } from './Port';
import { ElkModel } from './elkGraph';
import onml = require('onml');
export default class Cell {
    /**
     * creates a Cell from a Yosys Port
     * @param yPort the Yosys Port with our port data
     * @param name the name of the port
     */
    static fromPort(yPort: Yosys.ExtPort, name: string): Cell;
    static fromYosysCell(yCell: Yosys.Cell, name: string): Cell;
    static fromConstantInfo(name: string, constants: number[]): Cell;
    /**
     * creates a join cell
     * @param target string name of net (starts and ends with and delimited by commas)
     * @param sources list of index strings (one number, or two numbers separated by a colon)
     */
    static fromJoinInfo(target: string, sources: string[]): Cell;
    /**
     * creates a split cell
     * @param source string name of net (starts and ends with and delimited by commas)
     * @param targets list of index strings (one number, or two numbers separated by a colon)
     */
    static fromSplitInfo(source: string, targets: string[]): Cell;
    private static setAlternateCellType;
    protected key: string;
    protected type: string;
    protected inputPorts: Port[];
    protected outputPorts: Port[];
    protected attributes: Yosys.CellAttributes;
    constructor(key: string, type: string, inputPorts: Port[], outputPorts: Port[], attributes: Yosys.CellAttributes);
    get Type(): string;
    get Key(): string;
    get InputPorts(): Port[];
    get OutputPorts(): Port[];
    maxOutVal(atLeast: number): number;
    findConstants(sigsByConstantName: SigsByConstName, maxNum: number, constantCollector: Cell[]): number;
    inputPortVals(): string[];
    outputPortVals(): string[];
    collectPortsByDirection(ridersByNet: NameToPorts, driversByNet: NameToPorts, lateralsByNet: NameToPorts, genericsLaterals: boolean): void;
    getValueAttribute(): string;
    getTemplate(): any;
    buildElkChild(): ElkModel.Cell;
    render(cell: ElkModel.Cell): onml.Element;
    private addLabels;
    private getGenericHeight;
}
//# sourceMappingURL=Cell.d.ts.map