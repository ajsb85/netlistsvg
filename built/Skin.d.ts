import onml = require('onml');
import { ElkModel } from './elkGraph';
export declare namespace Skin {
    export let skin: onml.Element;
    export function getPortsWithPrefix(template: any[], prefix: string): any[];
    export function getInputPids(template: any[]): string[];
    export function getOutputPids(template: any[]): string[];
    export function getLateralPortPids(template: any[]): string[];
    export function findSkinType(type: string): any;
    export function getLowPriorityAliases(): string[];
    interface SkinProperties {
        [attr: string]: boolean | string | number | ElkModel.LayoutOptions;
    }
    export function getProperties(): SkinProperties;
    export {};
}
export default Skin;
//# sourceMappingURL=Skin.d.ts.map