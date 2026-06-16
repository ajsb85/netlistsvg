import ELK from 'elkjs';
import onml = require('onml');
import { FlatModule } from './FlatModule';
import Yosys from './YosysModel';
import Config from './ConfigModel';
import Skin from './Skin';
import { ElkModel, buildElkGraph } from './elkGraph';
import drawModule from './drawModule';

// Layout engine selection.
//   'elkjs' — the upstream elkjs (the reference behaviour). In the browser the demo's
//             bundle banner maps require('elkjs') -> window.ELK (the elk-rust web WASM).
//   'wasm'  — the elk-rust Rust/WASM port loaded through ./elkWasmAdapter (node target).
//             require()d lazily so it is never pulled into the browser bundle.
//   'auto'  — node => 'wasm' (the drop-in under evaluation); browser => 'elkjs'
//             (i.e. window.ELK / the web WASM via the banner).
export type ElkEngine = 'auto' | 'wasm' | 'elkjs';

interface IElkEngine { layout(graph: any, opts?: any): Promise<any>; }

export function createEngine(engine: ElkEngine = 'auto'): IElkEngine {
  const useWasm =
    engine === 'wasm' || (engine === 'auto' && typeof window === 'undefined');
  if (useWasm) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WasmELK = require('./elkWasmAdapter').default;
    return new WasmELK();
  }
  return new ELK();
}

// Default engine (node => WASM, browser => elkjs/window.ELK).
const elk = createEngine('auto');

// Type definition for callback functions
type ICallback = (error: Error | null, result?: string) => void;

// Default configuration: hierarchy disabled, top module taken from the netlist.
const defaultConfig: Config = {
  hierarchy: {
    enable: 'off',
    expandLevel: 0,
    expandModules: { types: [], ids: [] },
  },
  top: { enable: false, module: '' },
};

/**
 * Creates a flat module representation from Yosys netlist using skin data.
 * The module is flattened recursively according to the supplied configuration
 * (constants, splits/joins and wires are all built during construction).
 */
function createFlatModule(skinData: string, yosysNetlist: Yosys.Netlist, configData?: Config): FlatModule {
  // Parse skin data
  Skin.skin = onml.p(skinData);
  const config = configData || defaultConfig;
  return FlatModule.fromNetlist(yosysNetlist, config);
}

/**
 * Builds the un-laid-out ELK graph plus the skin's layout options. Lets a caller lay the
 * SAME input graph out with more than one engine (the layout-diff CLI) without rebuilding.
 */
export function buildLayoutGraph(skinData: string, yosysNetlist: Yosys.Netlist, configData?: Config): {
  flatModule: FlatModule;
  kgraph: ElkModel.Graph;
  layoutOptions: Record<string, unknown>;
} {
  const flatModule = createFlatModule(skinData, yosysNetlist, configData);
  const kgraph: ElkModel.Graph = buildElkGraph(flatModule);
  const layoutOptions = (Skin.getProperties().layoutEngine || {}) as Record<string, unknown>;
  return { flatModule, kgraph, layoutOptions };
}

/**
 * Generates and returns the ELK graph layout JSON
 */
export async function dumpLayout(
  skinData: string,
  yosysNetlist: Yosys.Netlist,
  prelayout: boolean,
  done: ICallback,
  engine: ElkEngine = 'auto'
): Promise<void> {
  try {
    // Create module and build graph
    const flatModule = createFlatModule(skinData, yosysNetlist);
    const kgraph: ElkModel.Graph = buildElkGraph(flatModule);

    // Return unlayouted graph if prelayout is true
    if (prelayout) {
      done(null, JSON.stringify(kgraph, null, 2));
      return;
    }

    // Apply layout and return result
    const layoutProps = Skin.getProperties();
    const eng = engine === 'auto' ? elk : createEngine(engine);
    const graph = await eng.layout(kgraph as any, { layoutOptions: layoutProps.layoutEngine as any });
    done(null, JSON.stringify(graph, null, 2));

  } catch (error) {
    done(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Renders the Yosys netlist using the provided skin and optional ELK data
 */
export function render(
  skinData: string,
  yosysNetlist: Yosys.Netlist,
  done?: ICallback,
  elkData?: ElkModel.Graph,
  configData?: Config
): Promise<string> {
  // Create module and build graph
  const flatModule = createFlatModule(skinData, yosysNetlist, configData);
  const kgraph: ElkModel.Graph = buildElkGraph(flatModule);
  const layoutProps = Skin.getProperties();

  // Define rendering process
  const renderPromise: Promise<string> = (async () => {
    // Use provided ELK data if available
    if (elkData) {
      return drawModule(elkData, flatModule);
    }

    // Otherwise perform layout and rendering
    try {
      const graph = await elk.layout(kgraph as any, { layoutOptions: layoutProps.layoutEngine as any });
      return drawModule(graph as any, flatModule);
    } catch (error) {
      // tslint:disable-next-line:no-console
      console.error(error);
      throw error;
    }
  })();

  // Handle callback if provided
  if (done) {
    renderPromise
      .then(output => done(null, output))
      .catch(error => done(error instanceof Error ? error : new Error(String(error))));
  }

  return renderPromise;
}