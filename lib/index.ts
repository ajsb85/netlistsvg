// No major structural changes, just minor cleanup and consistency.
import ELK = require('elkjs');
import onml = require('onml');

import { FlatModule } from './FlatModule';
import Yosys from './YosysModel';
import Skin from './Skin';
import { ElkModel, buildElkGraph } from './elkGraph';
import drawModule from './drawModule';

const elk = new ELK();

type ICallback = (error: Error, result?: string) => void;

function createFlatModule(skinData: string, yosysNetlist: Yosys.Netlist): FlatModule {
    Skin.skin = onml.p(skinData);
    const layoutProps = Skin.getProperties();
    const flatModule = new FlatModule(yosysNetlist);

    if (layoutProps.constants !== false) {
        flatModule.addConstants();
    }
    if (layoutProps.splitsAndJoins !== false) {
        flatModule.addSplitsJoins();
    }
    flatModule.createWires();
    return flatModule;
}

export async function dumpLayout(skinData: string, yosysNetlist: Yosys.Netlist, prelayout: boolean, done: ICallback) {
    try {
        const flatModule = createFlatModule(skinData, yosysNetlist);
        const kgraph: ElkModel.Graph = buildElkGraph(flatModule);

        if (prelayout) {
            done(null, JSON.stringify(kgraph, null, 2));
            return;
        }

        const layoutProps = Skin.getProperties();
        const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
        done(null, JSON.stringify(graph, null, 2));
    } catch (error) {
        done(error);
    }
}

export function render(skinData: string, yosysNetlist: Yosys.Netlist, done?: ICallback, elkData?: ElkModel.Graph): Promise<string> {
    const flatModule = createFlatModule(skinData, yosysNetlist);
    const kgraph: ElkModel.Graph = buildElkGraph(flatModule);
    const layoutProps = Skin.getProperties();

    const renderPromise: Promise<string> = (async () => {
        if (elkData) {
            return drawModule(elkData, flatModule);
        } else {
            try {
                const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
                return drawModule(graph, flatModule);
            } catch (error) {
                // tslint:disable-next-line:no-console
                console.error(error);  // Consistent error handling, even with async/await
                throw error; // Re-throw to propagate to the caller if needed
            }

        }
    })();

    if (done) {
        renderPromise.then(
            (output) => done(null, output),
            (error) => done(error)
        );
    }

    return renderPromise;
}