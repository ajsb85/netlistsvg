import { ElkModel } from './elkGraph';
import { FlatModule } from './FlatModule';
import onml = require('onml');
export declare function removeDummyEdges(graph: ElkModel.Graph | ElkModel.Cell): void;
export default function drawModule(graph: ElkModel.Graph, module: FlatModule): string;
/**
 * Renders the contents of an expanded submodule into an `svg` element. Returns the
 * onml element tree (not serialized) so the parent cell can splice it into its body.
 */
export declare function drawSubModule(cell: ElkModel.Cell, subModule: FlatModule): onml.Element;
//# sourceMappingURL=drawModule.d.ts.map