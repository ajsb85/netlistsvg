"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Skin = void 0;
const onml = require("onml");
var Skin;
(function (Skin) {
    Skin.skin = null;
    function getPortsWithPrefix(template, prefix) {
        const ports = template.filter((e) => {
            try {
                // Check if 'e' is an array and its first element is 'g'
                return Array.isArray(e) && e[0] === 'g' && e[1] &&
                    typeof e[1]['s:pid'] === 'string' && e[1]['s:pid'].startsWith(prefix);
            }
            catch (exception) {
                // Do nothing if the SVG group doesn't have a pin id.
                return false; // Ensure a boolean is returned in the catch block
            }
        });
        return ports;
    }
    Skin.getPortsWithPrefix = getPortsWithPrefix;
    function filterPortPids(template, filter) {
        const ports = template.filter((element) => {
            if (Array.isArray(element) && element[0] === 'g') {
                const attrs = element[1];
                return filter(attrs);
            }
            return false;
        });
        return ports.map((port) => {
            return port[1]['s:pid'];
        });
    }
    // Simplified getInputPids, getOutputPids, getLateralPortPids
    function getInputPids(template) {
        return filterPortPids(template, (attrs) => attrs['s:dir'] === 'in' || attrs['s:position'] === 'top');
    }
    Skin.getInputPids = getInputPids;
    function getOutputPids(template) {
        return filterPortPids(template, (attrs) => attrs['s:dir'] === 'out' || attrs['s:position'] === 'bottom');
    }
    Skin.getOutputPids = getOutputPids;
    function getLateralPortPids(template) {
        return filterPortPids(template, (attrs) => {
            if (attrs['s:dir']) {
                return attrs['s:dir'] === 'lateral';
            }
            // Placeholder: Keep position check IF s:dir is missing.
            if (attrs['s:position']) {
                return attrs['s:position'] === 'left' || attrs['s:position'] === 'right';
            }
            return false;
        });
    }
    Skin.getLateralPortPids = getLateralPortPids;
    function findSkinType(type) {
        let ret = null;
        onml.traverse(Skin.skin, {
            enter: (node, parent) => {
                if (node.name === 's:alias' && node.attr.val === type) {
                    ret = parent;
                }
            },
        });
        if (ret == null) {
            onml.traverse(Skin.skin, {
                enter: (node) => {
                    if (node.attr['s:type'] === 'generic') {
                        ret = node;
                    }
                },
            });
        }
        return ret ? ret.full : null; // Handle case where ret is null
    }
    Skin.findSkinType = findSkinType;
    function getLowPriorityAliases() {
        const ret = []; // Explicitly type ret as string[]
        onml.t(Skin.skin, {
            enter: (node) => {
                if (node.name === 's:low_priority_alias' && typeof node.attr.value === 'string') {
                    ret.push(node.attr.value);
                }
            },
        });
        return ret;
    }
    Skin.getLowPriorityAliases = getLowPriorityAliases;
    function getProperties() {
        let vals = {}; // Initialize vals
        onml.t(Skin.skin, {
            enter: (node) => {
                if (node.name === 's:properties') {
                    // Use Object.entries and reduce for a more functional approach
                    vals = Object.entries(node.attr).reduce((acc, [key, val]) => {
                        const strVal = String(val); // Ensure val is a string
                        if (!isNaN(Number(strVal))) {
                            acc[key] = Number(strVal);
                        }
                        else if (strVal === 'true') {
                            acc[key] = true;
                        }
                        else if (strVal === 'false') {
                            acc[key] = false;
                        }
                        else {
                            acc[key] = strVal;
                        }
                        return acc;
                    }, {});
                }
                else if (node.name === 's:layoutEngine') {
                    vals.layoutEngine = node.attr;
                }
            },
        });
        if (!vals.layoutEngine) {
            vals.layoutEngine = {};
        }
        return vals;
    }
    Skin.getProperties = getProperties;
})(Skin || (exports.Skin = Skin = {}));
exports.default = Skin;
//# sourceMappingURL=Skin.js.map