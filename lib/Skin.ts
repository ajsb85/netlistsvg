import onml = require('onml');
import { ElkModel } from './elkGraph';

export namespace Skin {

    export let skin: onml.Element = null;

    export function getPortsWithPrefix(template: any[], prefix: string) {
        const ports = template.filter((e) => {
            try {
                // Check if 'e' is an array and its first element is 'g'
                return Array.isArray(e) && e[0] === 'g' && e[1] &&
                       typeof e[1]['s:pid'] === 'string' && e[1]['s:pid'].startsWith(prefix);
            } catch (exception) {
                // Do nothing if the SVG group doesn't have a pin id.
                return false; // Ensure a boolean is returned in the catch block
            }
        });
        return ports;
    }

    function filterPortPids(template: any[], filter: (attrs: any) => boolean): string[] {
        const ports = template.filter((element: any[]) => {
            if (Array.isArray(element) && element[0] === 'g') {
                const attrs: any = element[1];
                return filter(attrs);
            }
            return false;
        });
        return ports.map((port) => {
            return port[1]['s:pid'];
        });
    }
    export function getInputPids(template: any[]): string[] {
        return filterPortPids(template, (attrs) => {
            return attrs['s:position'] === 'top';
        });
    }

    export function getOutputPids(template: any[]): string[] {
        return filterPortPids(template, (attrs) => {
            return attrs['s:position'] === 'bottom';
        });
    }

    export function getLateralPortPids(template: any[]): string[] {
        return filterPortPids(template, (attrs) => {
            if (attrs['s:dir']) {
                return attrs['s:dir'] === 'lateral';
            }
            if (attrs['s:position']) {
              return attrs['s:position'] === 'left' || attrs['s:position'] === 'right';
            }
            return false;
        });
    }
    export function findSkinType(type: string) {
        let ret = null;
        onml.traverse(skin, {
            enter: (node, parent) => {
                if (node.name === 's:alias' && node.attr.val === type) {
                    ret = parent;
                }
            },
        });
        if (ret == null) {
            onml.traverse(skin, {
                enter: (node) => {
                    if (node.attr['s:type'] === 'generic') {
                        ret = node;
                    }
                },
            });
        }
        return ret ? ret.full : null; // Handle case where ret is null
    }
    export function getLowPriorityAliases(): string[] {
        const ret: string[] = []; // Explicitly type ret as string[]
        onml.t(skin, {
            enter: (node) => {
                if (node.name === 's:low_priority_alias' && typeof node.attr.value === 'string') {
                    ret.push(node.attr.value);
                }
            },
        });
        return ret;
    }
    interface SkinProperties {
        [attr: string]: boolean | string | number | ElkModel.LayoutOptions;
    }

    export function getProperties(): SkinProperties {
      let vals: SkinProperties = {}; // Initialize vals

      onml.t(skin, {
        enter: (node) => {
          if (node.name === 's:properties') {
            // Use Object.entries and reduce for a more functional approach
            vals = Object.entries(node.attr).reduce<SkinProperties>((acc, [key, val]) => {
                const strVal = String(val); // Ensure val is a string
                if (!isNaN(Number(strVal))) {
                    acc[key] = Number(strVal);
                } else if (strVal === 'true') {
                    acc[key] = true;
                } else if (strVal === 'false') {
                    acc[key] = false;
                } else {
                    acc[key] = strVal;
                }
                return acc;
            }, {});
          } else if (node.name === 's:layoutEngine') {
              vals.layoutEngine = node.attr;
          }
        },
      });

      if (!vals.layoutEngine) {
        vals.layoutEngine = {};
      }

      return vals;
    }
}
export default Skin;