import ELK = require('elkjs');
import onml = require('onml');
import { FlatModule } from './FlatModule';
import Yosys from './YosysModel';
import Skin from './Skin';
import { ElkModel, buildElkGraph } from './elkGraph';
import drawModule from './drawModule';

// Initialize ELK engine
const elk = new ELK();

// Type definition for callback functions
type ICallback = (error: Error | null, result?: string) => void;

/**
 * Creates a flat module representation from Yosys netlist using skin data
 */
function createFlatModule(skinData: string, yosysNetlist: Yosys.Netlist): FlatModule {
  // Parse skin data
  Skin.skin = onml.p(skinData);
  const layoutProps = Skin.getProperties();
  
  // Create and configure flat module
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

/**
 * Generates and returns the ELK graph layout JSON
 */
export async function dumpLayout(
  skinData: string, 
  yosysNetlist: Yosys.Netlist, 
  prelayout: boolean, 
  done: ICallback
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
    const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
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
  elkData?: ElkModel.Graph
): Promise<string> {
  // Create module and build graph
  const flatModule = createFlatModule(skinData, yosysNetlist);
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
      const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
      return drawModule(graph, flatModule);
    } catch (error) {
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