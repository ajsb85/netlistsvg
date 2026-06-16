import onml = require('onml');
import { ElkModel } from './elkGraph';
export declare namespace Skin {
    let skin: onml.Element | null;
    /**
     * Returns ports that have IDs starting with the specified prefix
     */
    function getPortsWithPrefix(template: any[], prefix: string): any[];
    /**
     * Returns IDs of input ports
     */
    function getInputPids(template: any[]): string[];
    /**
     * Returns IDs of output ports
     */
    function getOutputPids(template: any[]): string[];
    /**
     * Returns IDs of lateral ports
     */
    function getLateralPortPids(template: any[]): string[];
    /**
     * Finds a skin type by name, first checking aliases then falling back to a
     * generic template. When `depth` is provided (i.e. the cell is an expanded
     * submodule) the fallback alternates between the `sub_odd` and `sub_even`
     * templates based on the hierarchy depth so nested modules are visually distinct.
     */
    function findSkinType(type: string, depth?: number | null): onml.Element | null;
    /**
     * Returns a list of low-priority aliases
     */
    function getLowPriorityAliases(): string[];
    /**
     * Extracts and returns skin properties with proper type conversion
     */
    function getProperties(): {
        [attr: string]: boolean | string | number | ElkModel.LayoutOptions;
    };
}
export default Skin;
//# sourceMappingURL=Skin.d.ts.map