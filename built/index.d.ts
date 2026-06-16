import { FlatModule } from './FlatModule';
import Yosys from './YosysModel';
import Config from './ConfigModel';
import { ElkModel } from './elkGraph';
export type ElkEngine = 'auto' | 'wasm' | 'elkjs';
interface IElkEngine {
    layout(graph: any, opts?: any): Promise<any>;
}
export declare function createEngine(engine?: ElkEngine): IElkEngine;
type ICallback = (error: Error | null, result?: string) => void;
/**
 * Builds the un-laid-out ELK graph plus the skin's layout options. Lets a caller lay the
 * SAME input graph out with more than one engine (the layout-diff CLI) without rebuilding.
 */
export declare function buildLayoutGraph(skinData: string, yosysNetlist: Yosys.Netlist, configData?: Config): {
    flatModule: FlatModule;
    kgraph: ElkModel.Graph;
    layoutOptions: Record<string, unknown>;
};
/**
 * Generates and returns the ELK graph layout JSON
 */
export declare function dumpLayout(skinData: string, yosysNetlist: Yosys.Netlist, prelayout: boolean, done: ICallback, engine?: ElkEngine): Promise<void>;
/**
 * Renders the Yosys netlist using the provided skin and optional ELK data
 */
export declare function render(skinData: string, yosysNetlist: Yosys.Netlist, done?: ICallback, elkData?: ElkModel.Graph, configData?: Config): Promise<string>;
export {};
//# sourceMappingURL=index.d.ts.map