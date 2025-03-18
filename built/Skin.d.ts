import onml = require('onml');
import { ElkModel } from './elkGraph';
export declare namespace Skin {
    let skin: onml.Element;
    function getPortsWithPrefix(template: any[], prefix: string): any[];
    function getInputPids(template: any[]): string[];
    function getOutputPids(template: any[]): string[];
    function getLateralPortPids(template: any[]): string[];
    function findSkinType(type: string): onml.Element | null;
    function getLowPriorityAliases(): string[];
    function getProperties(): {
        [attr: string]: boolean | string | number | ElkModel.LayoutOptions;
    };
}
export default Skin;
//# sourceMappingURL=Skin.d.ts.map