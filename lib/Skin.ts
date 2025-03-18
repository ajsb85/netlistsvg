import onml = require('onml');
import { ElkModel } from './elkGraph';

export namespace Skin {
    export let skin: onml.Element = null;

    /**
     * Safely extracts attributes from an element
     */
    function getAttributes(element: any[]): { [key: string]: string } {
        return (Array.isArray(element) && element[0] === 'g' && element[1]) ? element[1] : {};
    }

    /**
     * Filters ports based on the provided predicate function
     */
    function filterPortPids(template: any[], predicate: (attrs: { [key: string]: string }) => boolean): string[] {
        return template
            .filter(element => {
                const attrs = getAttributes(element);
                return attrs['s:pid'] !== undefined && predicate(attrs);
            })
            .map(element => element[1]['s:pid']);
    }

    /**
     * Returns ports that have IDs starting with the specified prefix
     */
    export function getPortsWithPrefix(template: any[], prefix: string): any[] {
        return template.filter(element => {
            const attrs = getAttributes(element);
            return typeof attrs['s:pid'] === 'string' && attrs['s:pid'].startsWith(prefix);
        });
    }

    /**
     * Returns IDs of input ports
     */
    export function getInputPids(template: any[]): string[] {
        return filterPortPids(template, attrs => attrs['s:dir'] === 'in' || attrs['s:position'] === 'top');
    }

    /**
     * Returns IDs of output ports
     */
    export function getOutputPids(template: any[]): string[] {
        return filterPortPids(template, attrs => attrs['s:dir'] === 'out' || attrs['s:position'] === 'bottom');
    }

    /**
     * Returns IDs of lateral ports
     */
    export function getLateralPortPids(template: any[]): string[] {
        return filterPortPids(template, attrs => 
            attrs['s:dir'] === 'lateral' || ['left', 'right'].includes(attrs['s:position'])
        );
    }

    /**
     * Finds a skin type by name, first checking aliases then falling back to generic
     */
    export function findSkinType(type: string): onml.Element | null {
        let foundNode: onml.Element | null = null;

        // First try to find an alias matching the requested type
        onml.traverse(skin, {
            enter: (node, parent) => {
                if (node.name === 's:alias' && node.attr.val === type) {
                    foundNode = parent;
                    return true;
                }
            },
        });

        // If no alias found, fall back to generic type
        if (!foundNode) {
            onml.traverse(skin, {
                enter: (node) => {
                    if (node.attr['s:type'] === 'generic') {
                        foundNode = node;
                        return true;
                    }
                },
            });
        }
        
        return foundNode ? foundNode.full : null;
    }

    /**
     * Returns a list of low-priority aliases
     */
    export function getLowPriorityAliases(): string[] {
        const aliases: string[] = [];
        
        onml.traverse(skin, {
            enter: (node) => {
                if (node.name === 's:low_priority_alias' && typeof node.attr.value === 'string') {
                    aliases.push(node.attr.value);
                }
            },
        });
        
        return aliases;
    }

    /**
     * Extracts and returns skin properties with proper type conversion
     */
    export function getProperties(): { [attr: string]: boolean | string | number | ElkModel.LayoutOptions } {
        const properties: { [attr: string]: boolean | string | number | ElkModel.LayoutOptions } = {};

        onml.traverse(skin, {
            enter: (node) => {
                if (node.name === 's:properties') {
                    // Convert property values to appropriate types
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

        // Ensure layoutEngine exists with default empty object
        if (!properties.layoutEngine) {
            properties.layoutEngine = {};
        }

        return properties;
    }
}

export default Skin;