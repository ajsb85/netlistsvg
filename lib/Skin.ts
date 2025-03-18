import onml = require('onml');
import { ElkModel } from './elkGraph';

export namespace Skin {

    export let skin: onml.Element = null;

    // Utility function to extract attributes safely
    function getAttributes(element: any[]): { [key: string]: string } {
        return (Array.isArray(element) && element[0] === 'g' && element[1]) ? element[1] : {};
    }

    // Generic function to filter ports based on a predicate
    function filterPortPids(template: any[], predicate: (attrs: { [key: string]: string }) => boolean): string[] {
        return template
            .filter(element => {
                const attrs = getAttributes(element);
                return attrs['s:pid'] !== undefined && predicate(attrs);
            })
            .map(element => element[1]['s:pid']);
    }

    export function getPortsWithPrefix(template: any[], prefix: string): any[] {
      return template.filter(element => {
          const attrs = getAttributes(element);
          return typeof attrs['s:pid'] === 'string' && attrs['s:pid'].startsWith(prefix);
      });
    }

    export function getInputPids(template: any[]): string[] {
        return filterPortPids(template, attrs => attrs['s:dir'] === 'in' || attrs['s:position'] === 'top');
    }

    export function getOutputPids(template: any[]): string[] {
        return filterPortPids(template, attrs => attrs['s:dir'] === 'out' || attrs['s:position'] === 'bottom');
    }

    export function getLateralPortPids(template: any[]): string[] {
        return filterPortPids(template, attrs =>
            attrs['s:dir'] === 'lateral' || (attrs['s:position'] === 'left' || attrs['s:position'] === 'right')
        );
    }

    // Find a skin type, prioritizing aliases and falling back to generic
    export function findSkinType(type: string): onml.Element | null {
        let foundNode: onml.Element | null = null;

        onml.traverse(skin, {
            enter: (node, parent) => {
                if (node.name === 's:alias' && node.attr.val === type) {
                    foundNode = parent;
                    return true; // Stop traversal
                }
            },
        });

        if (!foundNode) {
            onml.traverse(skin, {
                enter: (node) => {
                    if (node.attr['s:type'] === 'generic') {
                        foundNode = node;
                        return true; // Stop traversal
                    }
                },
            });
        }
        return foundNode ? foundNode.full : null;
    }

    // Get a list of low-priority aliases
    export function getLowPriorityAliases(): string[] {
      const aliases: string[] = [];
        onml.traverse(skin, { // Changed from onml.t for consistency and added type
            enter: (node) => {
                if (node.name === 's:low_priority_alias' && typeof node.attr.value === 'string') {
                    aliases.push(node.attr.value);
                }
            },
        });
        return aliases;
    }

    // Extract skin properties, converting string values to appropriate types
    export function getProperties(): { [attr: string]: boolean | string | number | ElkModel.LayoutOptions } {
        let properties: { [attr: string]: boolean | string | number | ElkModel.LayoutOptions } = {};

        onml.traverse(skin, { // Changed from onml.t
            enter: (node) => {
                if (node.name === 's:properties') {
                    for (const [key, val] of Object.entries(node.attr)) {
                        const strVal = String(val);
                        if (!isNaN(Number(strVal))) {
                            properties[key] = Number(strVal);
                        } else if (strVal === 'true') {
                            properties[key] = true;
                        } else if (strVal === 'false') {
                            properties[key] = false;
                        } else {
                            properties[key] = strVal;
                        }
                    }
                } else if (node.name === 's:layoutEngine') {
                    properties.layoutEngine = node.attr;
                }
            },
        });

        // Ensure layoutEngine exists
        if (!properties.layoutEngine) {
            properties.layoutEngine = {};
        }

        return properties;
    }
}

export default Skin;