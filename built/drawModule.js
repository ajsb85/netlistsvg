"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = drawModule;
exports.removeDummyEdges = removeDummyEdges;
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
function drawModule(g, module) {
    var _a, _b;
    const nodes = module.nodes.map((n) => {
        const kchild = g.children.find((c) => c.id === n.Key);
        return n.render(kchild);
    });
    removeDummyEdges(g);
    let lines = [];
    g.edges.forEach((e) => {
        const netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
        const numWires = netId.split(',').length - 2;
        const lineStyle = 'stroke-width: ' + (numWires > 1 ? 2 : 1);
        const netName = 'net_' + netId.slice(1, netId.length - 1) + ' width_' + numWires;
        e.sections.forEach((s) => {
            let startPoint = s.startPoint;
            s.bendPoints = s.bendPoints || [];
            let bends = s.bendPoints.map((b) => {
                const l = ['line', {
                        x1: startPoint.x,
                        x2: b.x,
                        y1: startPoint.y,
                        y2: b.y,
                        class: netName,
                        style: lineStyle,
                    }];
                startPoint = b;
                return l;
            });
            if (e.junctionPoints) {
                const circles = e.junctionPoints.map((j) => ['circle', {
                        cx: j.x,
                        cy: j.y,
                        r: (numWires > 1 ? 3 : 2),
                        style: 'fill:#000',
                        class: netName,
                    }]);
                bends = bends.concat(circles);
            }
            const line = [['line', {
                        x1: startPoint.x,
                        x2: s.endPoint.x,
                        y1: startPoint.y,
                        y2: s.endPoint.y,
                        class: netName,
                        style: lineStyle,
                    }]];
            bends.push(...line); // Use push(...line) instead of concat
            lines.push(...bends);
        });
    });
    let labels = [];
    for (const index in g.edges) {
        if (g.edges.hasOwnProperty(index)) {
            const e = g.edges[index];
            const netId = elkGraph_1.ElkModel.wireNameLookup[e.id];
            const numWires = netId.split(',').length - 2;
            const netName = 'net_' + netId.slice(1, netId.length - 1) +
                ' width_' + numWires +
                ' busLabel_' + numWires;
            if (((_b = (_a = e.labels) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text) !== undefined) { // Use optional chaining
                const label = [
                    ['rect',
                        {
                            x: e.labels[0].x + 1,
                            y: e.labels[0].y - 1,
                            width: (e.labels[0].text.length + 2) * 6 - 2,
                            height: 9,
                            class: netName,
                            style: 'fill: white; stroke: none',
                        },
                    ], ['text',
                        {
                            x: e.labels[0].x,
                            y: e.labels[0].y + 7,
                            class: netName,
                        },
                        '/' + e.labels[0].text + '/',
                    ],
                ];
                labels.push(...label); // Use push(...label)
            }
        }
    }
    if (labels !== undefined && labels.length > 0) {
        lines.push(...labels); // Use push(...labels)
    }
    const svgAttrs = Skin_1.default.skin[1];
    svgAttrs.width = g.width.toString();
    svgAttrs.height = g.height.toString();
    const styles = ['style', {}, ''];
    onml.t(Skin_1.default.skin, {
        enter: (node) => {
            if (node.name === 'style') {
                styles[2] += node.full[2];
            }
        },
    });
    const elements = [styles, ...nodes, ...lines];
    const ret = ['svg', svgAttrs];
    elements.forEach(element => {
        ret.push(element);
    });
    return onml.s(ret);
}
function which_dir(start, end) {
    if (end.x === start.x && end.y === start.y) {
        throw new Error('start and end are the same');
    }
    if (end.x !== start.x && end.y !== start.y) {
        throw new Error('start and end arent orthogonal');
    }
    if (end.x > start.x) {
        return WireDirection.Right;
    }
    if (end.x < start.x) {
        return WireDirection.Left;
    }
    if (end.y > start.y) {
        return WireDirection.Down;
    }
    if (end.y < start.y) {
        return WireDirection.Up;
    }
    throw new Error('unexpected direction');
}
function findBendNearDummy(net, dummyIsSource, dummyLoc) {
    const candidates = net.map((edge) => {
        const bends = edge.sections[0].bendPoints || []; // Default to empty array
        if (dummyIsSource) {
            return bends[0]; // Safe access, first element
        }
        else {
            return bends[bends.length - 1]; // Safe access, last element
        }
    }).filter((p) => p !== null && p !== undefined); // Filter out null and undefined
    if (candidates.length === 0) {
        return undefined; // No valid candidates
    }
    // Find the closest bend point using Euclidean distance
    let closestBend = candidates[0];
    let minDistance = Number.MAX_VALUE;
    for (const pt of candidates) {
        const distance = Math.sqrt((dummyLoc.x - pt.x) ** 2 + (dummyLoc.y - pt.y) ** 2); // Euclidean
        if (distance < minDistance) {
            minDistance = distance;
            closestBend = pt;
        }
    }
    return closestBend;
}
function removeDummyEdges(g) {
    let dummyNum = 0;
    while (dummyNum < 10000) {
        const dummyId = '$d_' + String(dummyNum);
        const edgeGroup = g.edges.filter((e) => {
            return e.source === dummyId || e.target === dummyId;
        });
        if (edgeGroup.length === 0) {
            break;
        }
        let dummyIsSource;
        let dummyLoc;
        const firstEdge = edgeGroup[0];
        if (firstEdge.source === dummyId) {
            dummyIsSource = true;
            dummyLoc = firstEdge.sections[0].startPoint;
        }
        else {
            dummyIsSource = false;
            dummyLoc = firstEdge.sections[0].endPoint;
        }
        const newEnd = findBendNearDummy(edgeGroup, dummyIsSource, dummyLoc);
        if (newEnd === undefined) { // Handle potential undefined return
            dummyNum++;
            continue; // Skip to the next dummy if no bend point is found
        }
        for (const edge of edgeGroup) {
            const section = edge.sections[0];
            if (dummyIsSource) {
                section.startPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.shift();
                }
            }
            else {
                section.endPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.pop();
                }
            }
        }
        const directions = new Set(edgeGroup.flatMap((edge) => {
            const section = edge.sections[0];
            let point; // Extract the point to a variable
            if (dummyIsSource) {
                if (section.bendPoints && section.bendPoints.length > 0) {
                    point = section.bendPoints[0];
                }
                else {
                    point = section.endPoint;
                }
            }
            else {
                if (section.bendPoints && section.bendPoints.length > 0) {
                    point = section.bendPoints[section.bendPoints.length - 1];
                }
                else {
                    point = section.startPoint;
                }
            }
            // Use the extracted point for direction calculation
            if (point.x > newEnd.x) {
                return WireDirection.Right;
            }
            if (point.x < newEnd.x) {
                return WireDirection.Left;
            }
            if (point.y > newEnd.y) {
                return WireDirection.Down;
            }
            return WireDirection.Up;
        }));
        if (directions.size < 3) {
            edgeGroup.forEach((edge) => {
                if (edge.junctionPoints) {
                    edge.junctionPoints = edge.junctionPoints.filter((junct) => {
                        return junct.x !== newEnd.x || junct.y !== newEnd.y; // Correct comparison
                    });
                }
            });
        }
        dummyNum += 1;
    }
}
//# sourceMappingURL=drawModule.js.map