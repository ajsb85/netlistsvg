import { SigsByConstName, NameToPorts, FlatModule } from './FlatModule';
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
    static fromPort(yPort: Yosys.ExtPort, name: string, parent?: string): Cell;
    static fromYosysCell(yCell: Yosys.Cell, name: string, parent?: string): Cell;
    /**
     * creates a Cell that represents an expanded submodule. The inner module is
     * flattened recursively into its own FlatModule (one level deeper) so it can be
     * rendered as a nested schematic inside this cell.
     */
    static createSubModule(yCell: Yosys.Cell, name: string, parent: string, subModule: Yosys.Module, depth: number): Cell;
    static fromConstantInfo(name: string, constants: number[], parent?: string): Cell;
    /**
     * creates a join cell
     * @param target string name of net (starts and ends with and delimited by commas)
     * @param sources list of index strings (one number, or two numbers separated by a colon)
     */
    static fromJoinInfo(target: string, sources: string[], parent?: string): Cell;
    /**
     * creates a split cell
     * @param source string name of net (starts and ends with and delimited by commas)
     * @param targets list of index strings (one number, or two numbers separated by a colon)
     */
    static fromSplitInfo(source: string, targets: string[], parent?: string): Cell;
    private static setAlternateCellType;
    parent: string;
    subModule: FlatModule | null;
    depth: number | null;
    protected key: string;
    protected type: string;
    protected inputPorts: Port[];
    protected outputPorts: Port[];
    protected attributes: Record<string, any>;
    constructor(key: string, type: string, inputPorts: Port[], outputPorts: Port[], attributes: Record<string, any>, parent?: string, subModule?: FlatModule | null, depth?: number | null);
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
    /**
     * Builds an ELK node for an expanded submodule. The inner module is laid out as
     * a nested ELK graph (children + edges), and the submodule's own external-port
     * cells are folded into this node's ports so wires connect through.
     */
    private buildElkSubModule;
    render(cell: ElkModel.Cell): onml.Element;
    private addLabels;
    private getGenericHeight;
}
//# sourceMappingURL=Cell.d.ts.map