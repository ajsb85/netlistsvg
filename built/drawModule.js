"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDummyEdges = removeDummyEdges;
exports.default = drawModule;
const elkGraph_1 = require("./elkGraph");
const Skin_1 = __importDefault(require("./Skin"));
const onml = require("onml");
var WireDirection;
(function (WireDirection) {
    WireDirection[WireDirection["Up"] = 0] = "Up";
    WireDirection[WireDirection["Down"] = 1] = "Down";
    WireDirection[WireDirection["Left"] = 2] = "Left";
    WireDirection[WireDirection["Right"] = 3] = "Right";
})(WireDirection || (WireDirection = {}));
// Helper function to determine wire direction (moved outside drawModule)
function whichDir(start, end) {
    if (end.x === start.x && end.y === start.y) {
        throw new Error('start and end are the same');
    }
    if (end.x !== start.x && end.y !== start.y) {
        throw new Error('start and end arent orthogonal');
    }
    return end.x > start.x ? WireDirection.Right
        : end.x < start.x ? WireDirection.Left
            : end.y > start.y ? WireDirection.Down
                : WireDirection.Up; // Simplified conditional
}
// Helper to find the bend point nearest to a dummy node (moved outside drawModule)
function findBendNearDummy(net, dummyIsSource, dummyLoc) {
    const candidates = net.map((edge) => {
        const bends = edge.sections[0].bendPoints || [];
        return dummyIsSource ? bends[0] : bends[bends.length - 1];
    }).filter((p) => p !== undefined); // Use type guard
    if (candidates.length === 0) {
        return undefined;
    }
    // Find closest bend point using Euclidean distance
    return candidates.reduce((closest, current) => {
        const closestDist = (closest.x - dummyLoc.x) ** 2 + (closest.y - dummyLoc.y) ** 2;
        const currentDist = (current.x - dummyLoc.x) ** 2 + (current.y - dummyLoc.y) ** 2;
        return currentDist < closestDist ? current : closest;
    });
}
// Function to remove dummy edges (extracted and simplified)
function removeDummyEdges(g) {
    var _a, _b;
    while (true) {
        const dummyId = `$d_${elkGraph_1.ElkModel.dummyNum}`;
        const edgeGroup = g.edges.filter(e => e.source === dummyId || e.target === dummyId);
        if (edgeGroup.length === 0) {
            break; // No more dummy nodes
        }
        const firstEdge = edgeGroup[0];
        const dummyIsSource = firstEdge.source === dummyId;
        const dummyLoc = dummyIsSource ? firstEdge.sections[0].startPoint : firstEdge.sections[0].endPoint;
        const newEnd = findBendNearDummy(edgeGroup, dummyIsSource, dummyLoc);
        if (!newEnd) {
            elkGraph_1.ElkModel.dummyNum += 1;
            continue; // Skip if no bend point
        }
        for (const edge of edgeGroup) {
            const section = edge.sections[0];
            if (dummyIsSource) {
                section.startPoint = newEnd;
                (_a = section.bendPoints) === null || _a === void 0 ? void 0 : _a.shift(); // Use optional chaining
            }
            else {
                section.endPoint = newEnd;
                (_b = section.bendPoints) === null || _b === void 0 ? void 0 : _b.pop(); // Use optional chaining
            }
        }
        const directions = new Set(edgeGroup.map(edge => {
            var _a, _b;
            const section = edge.sections[0];
            const point = dummyIsSource
                ? (((_a = section.bendPoints) === null || _a === void 0 ? void 0 : _a[0]) || section.endPoint)
                : (((_b = section.bendPoints) === null || _b === void 0 ? void 0 : _b[section.bendPoints.length - 1]) || section.startPoint);
            return whichDir(newEnd, point);
        }));
        if (directions.size < 3) {
            for (const edge of edgeGroup) {
                edge.junctionPoints = (edge.junctionPoints || []).filter(junct => !(junct.x === newEnd.x && junct.y === newEnd.y));
            }
        }
        elkGraph_1.ElkModel.dummyNum += 1;
    }
}
// Main drawModule function
function drawModule(g, module) {
    const nodes = module.nodes.map((n) => {
        const kchild = g.children.find((c) => c.id === n.Key);
        return n.render(kchild);
    });
    removeDummyEdges(g);
    const lines = g.edges.flatMap((e) => {
        const netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
        const numWires = netId.split(',').length - 2;
        const lineStyle = `stroke-width: ${numWires > 1 ? 2 : 1}`;
        const netName = `net_${netId.slice(1, -1)} width_${numWires}`;
        return e.sections.flatMap((s) => {
            let startPoint = s.startPoint;
            const bends = (s.bendPoints || []).map((b) => {
                const line = ['line', {
                        x1: startPoint.x,
                        x2: b.x,
                        y1: startPoint.y,
                        y2: b.y,
                        class: netName,
                        style: lineStyle,
                    }];
                startPoint = b;
                return line;
            });
            const circles = (e.junctionPoints || []).map((j) => ['circle', {
                    cx: j.x,
                    cy: j.y,
                    r: numWires > 1 ? 3 : 2,
                    style: 'fill:#000',
                    class: netName,
                }]);
            const line = ['line', {
                    x1: startPoint.x,
                    x2: s.endPoint.x,
                    y1: startPoint.y,
                    y2: s.endPoint.y,
                    class: netName,
                    style: lineStyle,
                }];
            return [...bends, ...circles, line];
        });
    });
    const labels = g.edges.flatMap((e) => {
        var _a, _b;
        const netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
        const numWires = netId.split(',').length - 2;
        const netName = `net_${netId.slice(1, -1)} width_${numWires} busLabel_${numWires}`;
        if ((_b = (_a = e.labels) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text) {
            const label = [
                ['rect', {
                        x: e.labels[0].x + 1,
                        y: e.labels[0].y - 1,
                        width: (e.labels[0].text.length + 2) * 6 - 2,
                        height: 9,
                        class: netName,
                        style: 'fill: white; stroke: none',
                    }],
                ['text', {
                        x: e.labels[0].x,
                        y: e.labels[0].y + 7,
                        class: netName,
                    }, `/${e.labels[0].text}/`],
            ];
            return label;
        }
        return []; // Return empty array if no label
    });
    if (labels.length > 0) {
        lines.push(...labels);
    }
    const svgAttrs = Object.assign({}, Skin_1.default.skin[1]); // Clone attributes
    svgAttrs.width = String(g.width); // Use String() for conversion
    svgAttrs.height = String(g.height);
    const styles = ['style', {}, ''];
    onml.traverse(Skin_1.default.skin, {
        enter: (node) => {
            if (node.name === 'style') {
                styles[2] += node.full[2];
            }
        },
    });
    const ret = ['svg', svgAttrs, styles, ...nodes, ...lines];
    return onml.s(ret);
}
//# sourceMappingURL=drawModule.js.map