import { ElkModel } from './elkGraph';
import { FlatModule, removeDups } from './FlatModule';
import Cell from './Cell';
import Skin from './Skin';

import onml = require('onml');
import assert = require('assert');

enum WireDirection {
    Up, Down, Left, Right,
}

export default function drawModule(g: ElkModel.Graph, module: FlatModule) {
    const nodes: onml.Element[] = module.nodes.map((n: Cell) => {
        const kchild: ElkModel.Cell = g.children.find((c) => c.id === n.Key);
        return n.render(kchild);
    });
    removeDummyEdges(g);
    let lines: onml.Element[] = [];
    g.edges.forEach((e: ElkModel.Edge) => {
        const netId = ElkModel.wireNameLookup[e.id];
        const numWires = netId.split(',').length - 2;
        const lineStyle = 'stroke-width: ' + (numWires > 1 ? 2 : 1);
        const netName = 'net_' + netId.slice(1, netId.length - 1) + ' width_' + numWires;
        e.sections.forEach((s: ElkModel.Section) => {
            let startPoint = s.startPoint;
            s.bendPoints = s.bendPoints || [];
            let bends: any[] = s.bendPoints.map((b) => {
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
                const circles: any[] = e.junctionPoints.map((j: ElkModel.WirePoint) =>
                    ['circle', {
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

    let labels: any[] = [];
    for (const index in g.edges) {
        if (g.edges.hasOwnProperty(index)) {
            const e = g.edges[index];
            const netId = ElkModel.wireNameLookup[e.id];
            const numWires = netId.split(',').length - 2;
            const netName = 'net_' + netId.slice(1, netId.length - 1) +
                ' width_' + numWires +
                ' busLabel_' + numWires;
            if (e.labels?.[0]?.text !== undefined) { // Use optional chaining
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
    const svgAttrs: onml.Attributes = Skin.skin[1];
    svgAttrs.width = g.width.toString();
    svgAttrs.height = g.height.toString();

    const styles: onml.Element = ['style', {}, ''];
    onml.t(Skin.skin, {
        enter: (node: { name: string; full: any[] }) => {
            if (node.name === 'style') {
                styles[2] += node.full[2];
            }
        },
    });
    const elements: onml.Element[] = [styles, ...nodes, ...lines];
    const ret: onml.Element = ['svg', svgAttrs];
    elements.forEach(element => { // Use forEach
        ret.push(element);
    });
    return onml.s(ret);
}

function which_dir(start: ElkModel.WirePoint, end: ElkModel.WirePoint): WireDirection {
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

function findBendNearDummy(
    net: ElkModel.Edge[],
    dummyIsSource: boolean,
    dummyLoc: ElkModel.WirePoint,
): ElkModel.WirePoint | undefined { // Return type can be undefined
    const candidates = net.map((edge) => {
        const bends = edge.sections[0].bendPoints || []; // Default to empty array
        if (dummyIsSource) {
            return bends[0]; // Safe access, first element
        } else {
            return bends[bends.length - 1]; // Safe access, last element
        }
    }).filter((p) => p !== null && p !== undefined); // Filter out null and undefined

    if (candidates.length === 0) {
        return undefined; // No valid candidates
    }

    // Find the closest bend point using Euclidean distance
    let closestBend: ElkModel.WirePoint = candidates[0];
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

export function removeDummyEdges(g: ElkModel.Graph) {
    let dummyNum: number = 0;
    while (dummyNum < 10000) {
        const dummyId: string = '$d_' + String(dummyNum);
        const edgeGroup = g.edges.filter((e: ElkModel.Edge) => {
            return e.source === dummyId || e.target === dummyId;
        });
        if (edgeGroup.length === 0) {
            break;
        }
        let dummyIsSource: boolean;
        let dummyLoc: ElkModel.WirePoint;
        const firstEdge: ElkModel.Edge = edgeGroup[0];
        if (firstEdge.source === dummyId) {
            dummyIsSource = true;
            dummyLoc = firstEdge.sections[0].startPoint;
        } else {
            dummyIsSource = false;
            dummyLoc = firstEdge.sections[0].endPoint;
        }
        const newEnd: ElkModel.WirePoint = findBendNearDummy(edgeGroup, dummyIsSource, dummyLoc);
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
            } else {
                section.endPoint = newEnd;
                if (section.bendPoints) {
                    section.bendPoints.pop();
                }
            }
        }

        const directions = new Set(edgeGroup.flatMap((edge: ElkModel.Edge) => {
            const section = edge.sections[0];
            let point: ElkModel.WirePoint; // Extract the point to a variable

            if (dummyIsSource) {
                if (section.bendPoints && section.bendPoints.length > 0) {
                    point = section.bendPoints[0];
                } else {
                    point = section.endPoint;
                }
            } else {
                if (section.bendPoints && section.bendPoints.length > 0) {
                    point = section.bendPoints[section.bendPoints.length - 1];
                } else {
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
            edgeGroup.forEach((edge: ElkModel.Edge) => {
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