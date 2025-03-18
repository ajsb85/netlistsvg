import Yosys from './YosysModel';
import { ElkModel } from './elkGraph';
type ICallback = (error: Error, result?: string) => void;
export declare function dumpLayout(skinData: string, yosysNetlist: Yosys.Netlist, prelayout: boolean, done: ICallback): Promise<void>;
export declare function render(skinData: string, yosysNetlist: Yosys.Netlist, done?: ICallback, elkData?: ElkModel.Graph): Promise<string>;
export {};
//# sourceMappingURL=index.d.ts.map