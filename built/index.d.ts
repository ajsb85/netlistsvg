import Yosys from './YosysModel';
import { ElkModel } from './elkGraph';
type ICallback = (error: Error | null, result?: string) => void;
/**
 * Generates and returns the ELK graph layout JSON
 */
export declare function dumpLayout(skinData: string, yosysNetlist: Yosys.Netlist, prelayout: boolean, done: ICallback): Promise<void>;
/**
 * Renders the Yosys netlist using the provided skin and optional ELK data
 */
export declare function render(skinData: string, yosysNetlist: Yosys.Netlist, done?: ICallback, elkData?: ElkModel.Graph): Promise<string>;
export {};
//# sourceMappingURL=index.d.ts.map