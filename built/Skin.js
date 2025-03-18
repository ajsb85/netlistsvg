"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Skin = void 0;
const onml = require("onml");
var Skin;
(function (Skin) {
    Skin.skin = null;
    /**
     * Safely extracts attributes from an element
     */
    function getAttributes(element) {
        return (Array.isArray(element) && element[0] === 'g' && element[1]) ? element[1] : {};
    }
    /**
     * Filters ports based on the provided predicate function
     */
    function filterPortPids(template, predicate) {
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
    function getPortsWithPrefix(template, prefix) {
        return template.filter(element => {
            const attrs = getAttributes(element);
            return typeof attrs['s:pid'] === 'string' && attrs['s:pid'].startsWith(prefix);
        });
    }
    Skin.getPortsWithPrefix = getPortsWithPrefix;
    /**
     * Returns IDs of input ports
     */
    function getInputPids(template) {
        return filterPortPids(template, attrs => attrs['s:dir'] === 'in' || attrs['s:position'] === 'top');
    }
    Skin.getInputPids = getInputPids;
    /**
     * Returns IDs of output ports
     */
    function getOutputPids(template) {
        return filterPortPids(template, attrs => attrs['s:dir'] === 'out' || attrs['s:position'] === 'bottom');
    }
    Skin.getOutputPids = getOutputPids;
    /**
     * Returns IDs of lateral ports
     */
    function getLateralPortPids(template) {
        return filterPortPids(template, attrs => attrs['s:dir'] === 'lateral' || ['left', 'right'].includes(attrs['s:position']));
    }
    Skin.getLateralPortPids = getLateralPortPids;
    /**
     * Finds a skin type by name, first checking aliases then falling back to generic
     */
    function findSkinType(type) {
        let foundNode = null;
        // First try to find an alias matching the requested type
        onml.traverse(Skin.skin, {
            enter: (node, parent) => {
                if (node.name === 's:alias' && node.attr.val === type) {
                    foundNode = parent;
                    return true;
                }
            },
        });
        // If no alias found, fall back to generic type
        if (!foundNode) {
            onml.traverse(Skin.skin, {
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
    Skin.findSkinType = findSkinType;
    /**
     * Returns a list of low-priority aliases
     */
    function getLowPriorityAliases() {
        const aliases = [];
        onml.traverse(Skin.skin, {
            enter: (node) => {
                if (node.name === 's:low_priority_alias' && typeof node.attr.value === 'string') {
                    aliases.push(node.attr.value);
                }
            },
        });
        return aliases;
    }
    Skin.getLowPriorityAliases = getLowPriorityAliases;
    /**
     * Extracts and returns skin properties with proper type conversion
     */
    function getProperties() {
        const properties = {};
        onml.traverse(Skin.skin, {
            enter: (node) => {
                if (node.name === 's:properties') {
                    // Convert property values to appropriate types
                    for (const [key, val] of Object.entries(node.attr)) {
                        const strVal = String(val);
                        if (!isNaN(Number(strVal))) {
                            properties[key] = Number(strVal);
                        }
                        else if (strVal === 'true') {
                            properties[key] = true;
                        }
                        else if (strVal === 'false') {
                            properties[key] = false;
                        }
                        else {
                            properties[key] = strVal;
                        }
                    }
                }
                else if (node.name === 's:layoutEngine') {
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
    Skin.getProperties = getProperties;
})(Skin || (exports.Skin = Skin = {}));
exports.default = Skin;
//# sourceMappingURL=Skin.js.map