"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Skin = void 0;
const onml = require("onml");
var Skin;
(function (Skin) {
    Skin.skin = null;
    // Utility function to extract attributes safely
    function getAttributes(element) {
        return (Array.isArray(element) && element[0] === 'g' && element[1]) ? element[1] : {};
    }
    // Generic function to filter ports based on a predicate
    function filterPortPids(template, predicate) {
        return template
            .filter(element => {
            const attrs = getAttributes(element);
            return attrs['s:pid'] !== undefined && predicate(attrs);
        })
            .map(element => element[1]['s:pid']);
    }
    function getPortsWithPrefix(template, prefix) {
        return template.filter(element => {
            const attrs = getAttributes(element);
            return typeof attrs['s:pid'] === 'string' && attrs['s:pid'].startsWith(prefix);
        });
    }
    Skin.getPortsWithPrefix = getPortsWithPrefix;
    function getInputPids(template) {
        return filterPortPids(template, attrs => attrs['s:dir'] === 'in' || attrs['s:position'] === 'top');
    }
    Skin.getInputPids = getInputPids;
    function getOutputPids(template) {
        return filterPortPids(template, attrs => attrs['s:dir'] === 'out' || attrs['s:position'] === 'bottom');
    }
    Skin.getOutputPids = getOutputPids;
    function getLateralPortPids(template) {
        return filterPortPids(template, attrs => attrs['s:dir'] === 'lateral' || (attrs['s:position'] === 'left' || attrs['s:position'] === 'right'));
    }
    Skin.getLateralPortPids = getLateralPortPids;
    // Find a skin type, prioritizing aliases and falling back to generic
    function findSkinType(type) {
        let foundNode = null;
        onml.traverse(Skin.skin, {
            enter: (node, parent) => {
                if (node.name === 's:alias' && node.attr.val === type) {
                    foundNode = parent;
                    return true; // Stop traversal
                }
            },
        });
        if (!foundNode) {
            onml.traverse(Skin.skin, {
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
    Skin.findSkinType = findSkinType;
    // Get a list of low-priority aliases
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
    // Extract skin properties, converting string values to appropriate types
    function getProperties() {
        let properties = {};
        onml.traverse(Skin.skin, {
            enter: (node) => {
                if (node.name === 's:properties') {
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
        // Ensure layoutEngine exists
        if (!properties.layoutEngine) {
            properties.layoutEngine = {};
        }
        return properties;
    }
    Skin.getProperties = getProperties;
})(Skin || (exports.Skin = Skin = {}));
exports.default = Skin;
//# sourceMappingURL=Skin.js.map