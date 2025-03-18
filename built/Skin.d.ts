import onml = require('onml');
import { ElkModel } from './elkGraph';
export declare namespace Skin {
    let skin: onml.Element;
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
     * Finds a skin type by name, first checking aliases then falling back to generic
     */
    function findSkinType(type: string): onml.Element | null;
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