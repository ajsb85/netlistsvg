import { ElkModel } from './elkGraph';
import { FlatModule } from './FlatModule';
import Cell from './Cell';
import Skin from './Skin';

import onml = require('onml');

enum WireDirection {
    Up, Down, Left, Right,
}

// Helper function to determine wire direction (moved outside drawModule)
function whichDir(start: ElkModel.WirePoint, end: ElkModel.WirePoint): WireDirection {
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
function findBendNearDummy(
    net: ElkModel.Edge[],
    dummyIsSource: boolean,
    dummyLoc: ElkModel.WirePoint,
): ElkModel.WirePoint | undefined {
    const candidates = net.map((edge) => {
        const bends = edge.sections[0].bendPoints || [];
        return dummyIsSource ? bends[0] : bends[bends.length - 1];
    }).filter((p): p is ElkModel.WirePoint => p !== undefined); // Use type guard

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
export function removeDummyEdges(g: ElkModel.Graph) {
    while (true) {
        const dummyId = `$d_${ElkModel.dummyNum}`;
        const edgeGroup = g.edges.filter(e => e.source === dummyId || e.target === dummyId);

        if (edgeGroup.length === 0) {
            break; // No more dummy nodes
        }

        const firstEdge = edgeGroup[0];
        const dummyIsSource = firstEdge.source === dummyId;
        const dummyLoc = dummyIsSource ? firstEdge.sections[0].startPoint : firstEdge.sections[0].endPoint;

        const newEnd = findBendNearDummy(edgeGroup, dummyIsSource, dummyLoc);
        if (!newEnd) {
            ElkModel.dummyNum += 1;
            continue; // Skip if no bend point
        }

        for (const edge of edgeGroup) {
            const section = edge.sections[0];
            if (dummyIsSource) {
                section.startPoint = newEnd;
                section.bendPoints?.shift(); // Use optional chaining
            } else {
                section.endPoint = newEnd;
                section.bendPoints?.pop(); // Use optional chaining
            }
        }

        const directions = new Set(edgeGroup.map(edge => {
            const section = edge.sections[0];
            const point = dummyIsSource
                ? (section.bendPoints?.[0] || section.endPoint)
                : (section.bendPoints?.[section.bendPoints.length - 1] || section.startPoint);
            return whichDir(newEnd, point);
        }));

        if (directions.size < 3) {
            for (const edge of edgeGroup) {
                edge.junctionPoints = (edge.junctionPoints || []).filter(junct => !(junct.x === newEnd.x && junct.y === newEnd.y));
            }
        }
        ElkModel.dummyNum += 1;
    }
}

// Main drawModule function
export default function drawModule(g: ElkModel.Graph, module: FlatModule): string {
    const nodes: onml.Element[] = module.nodes.map((n: Cell) => {
        const kchild: ElkModel.Cell = g.children.find((c) => c.id === n.Key);
        return n.render(kchild);
    });

    removeDummyEdges(g);

    const lines: onml.Element[] = g.edges.flatMap((e: ElkModel.Edge) => {
        const netId = ElkModel.wireNameLookup[e.id];
        const numWires = netId.split(',').length - 2;
        const lineStyle = `stroke-width: ${numWires > 1 ? 2 : 1}`;
        const netName = `net_${netId.slice(1, -1)} width_${numWires}`;

        return e.sections.flatMap((s: ElkModel.Section) => {
            let startPoint = s.startPoint;
            const bends: onml.Element[] = (s.bendPoints || []).map((b) => {
                const line: onml.Element = ['line', {
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

            const circles: onml.Element[] = (e.junctionPoints || []).map((j: ElkModel.WirePoint) =>
                ['circle', {
                    cx: j.x,
                    cy: j.y,
                    r: numWires > 1 ? 3 : 2,
                    style: 'fill:#000',
                    class: netName,
                }]
            );

            const line: onml.Element = ['line', {
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

    const labels: onml.Element[] = g.edges.flatMap((e: ElkModel.Edge) => {
        const netId = ElkModel.wireNameLookup[e.id];
        const numWires = netId.split(',').length - 2;
        const netName = `net_${netId.slice(1, -1)} width_${numWires} busLabel_${numWires}`;

        if (e.labels?.[0]?.text) {
            const label: onml.Element[] = [
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

    const svgAttrs: onml.Attributes = { ...Skin.skin[1] }; // Clone attributes
    svgAttrs.width = String(g.width); // Use String() for conversion
    svgAttrs.height = String(g.height);

    const styles: onml.Element = ['style', {}, ''];
    onml.traverse(Skin.skin, {
        enter: (node) => {
            if (node.name === 'style') {
                styles[2] += node.full[2];
            }
        },
    });

    const ret: onml.Element = ['svg', svgAttrs, styles, ...nodes, ...lines];
    return onml.s(ret);
}