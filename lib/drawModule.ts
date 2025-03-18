import { ElkModel } from './elkGraph';
import { FlatModule } from './FlatModule';
import Skin from './Skin';
import onml = require('onml');

// Wire direction enum
enum WireDirection {
    Up, Down, Left, Right
}

// Determine direction between two points
function getWireDirection(start: ElkModel.WirePoint, end: ElkModel.WirePoint): WireDirection {
    if (end.x === start.x && end.y === start.y) {
        throw new Error('Points cannot be identical');
    }
    if (end.x !== start.x && end.y !== start.y) {
        throw new Error('Points must be orthogonal');
    }
    
    if (end.x > start.x) return WireDirection.Right;
    if (end.x < start.x) return WireDirection.Left;
    if (end.y > start.y) return WireDirection.Down;
    return WireDirection.Up;
}

// Find bend point nearest to a dummy node
function findNearestBend(
    edges: ElkModel.Edge[],
    dummyIsSource: boolean,
    dummyLocation: ElkModel.WirePoint
): ElkModel.WirePoint | undefined {
    // Get candidate bend points
    const candidates = edges
        .map(edge => {
            const bends = edge.sections[0].bendPoints || [];
            return dummyIsSource ? bends[0] : bends[bends.length - 1];
        })
        .filter((p): p is ElkModel.WirePoint => p !== undefined);
    
    if (candidates.length === 0) return undefined;
    
    // Return closest point by Euclidean distance
    return candidates.reduce((closest, current) => {
        const closestDist = (closest.x - dummyLocation.x) ** 2 + (closest.y - dummyLocation.y) ** 2;
        const currentDist = (current.x - dummyLocation.x) ** 2 + (current.y - dummyLocation.y) ** 2;
        return currentDist < closestDist ? current : closest;
    });
}

// Clean up dummy edges in the graph
export function removeDummyEdges(graph: ElkModel.Graph) {
    while (true) {
        const dummyId = `$d_${ElkModel.dummyNum}`;
        const edgesWithDummy = graph.edges.filter(e => e.source === dummyId || e.target === dummyId);
        
        // Exit if no more dummy edges found
        if (edgesWithDummy.length === 0) break;
        
        const firstEdge = edgesWithDummy[0];
        const dummyIsSource = firstEdge.source === dummyId;
        const dummyLocation = dummyIsSource 
            ? firstEdge.sections[0].startPoint 
            : firstEdge.sections[0].endPoint;
        
        // Find replacement endpoint
        const newEndpoint = findNearestBend(edgesWithDummy, dummyIsSource, dummyLocation);
        if (!newEndpoint) {
            ElkModel.dummyNum += 1;
            continue;
        }
        
        // Update edge endpoints
        for (const edge of edgesWithDummy) {
            const section = edge.sections[0];
            if (dummyIsSource) {
                section.startPoint = newEndpoint;
                section.bendPoints?.shift();
            } else {
                section.endPoint = newEndpoint;
                section.bendPoints?.pop();
            }
        }
        
        // Check if junction is needed
        const directions = new Set(edgesWithDummy.map(edge => {
            const section = edge.sections[0];
            const point = dummyIsSource
                ? (section.bendPoints?.[0] || section.endPoint)
                : (section.bendPoints?.[section.bendPoints.length - 1] || section.startPoint);
            return getWireDirection(newEndpoint, point);
        }));
        
        // Remove junction points if fewer than 3 directions
        if (directions.size < 3) {
            for (const edge of edgesWithDummy) {
                edge.junctionPoints = (edge.junctionPoints || []).filter(
                    junction => !(junction.x === newEndpoint.x && junction.y === newEndpoint.y)
                );
            }
        }
        
        ElkModel.dummyNum += 1;
    }
}

// Main function to generate SVG from module
export default function drawModule(graph: ElkModel.Graph, module: FlatModule): string {
    // Render all nodes
    const nodes: onml.Element[] = module.nodes.map(node => {
        const matchedChild = graph.children.find(child => child.id === node.Key);
        return node.render(matchedChild);
    });
    
    // Clean up the graph structure
    removeDummyEdges(graph);
    
    // Create wire lines
    const lines: onml.Element[] = graph.edges.flatMap(edge => {
        const netId = ElkModel.wireNameLookup[edge.id];
        const numWires = netId.split(',').length - 2;
        const lineWidth = numWires > 1 ? 2 : 1;
        const netClass = `net_${netId.slice(1, -1)} width_${numWires}`;
        
        return edge.sections.flatMap(section => {
            let currentPoint = section.startPoint;
            const wireSegments: onml.Element[] = [];
            
            // Create line segments for each bend
            const bendPoints = section.bendPoints || [];
            bendPoints.forEach(bendPoint => {
                wireSegments.push(['line', {
                    x1: currentPoint.x,
                    y1: currentPoint.y,
                    x2: bendPoint.x,
                    y2: bendPoint.y,
                    class: netClass,
                    style: `stroke-width: ${lineWidth}`
                }]);
                currentPoint = bendPoint;
            });
            
            // Create junction points
            const junctions: onml.Element[] = (edge.junctionPoints || []).map(junction => 
                ['circle', {
                    cx: junction.x,
                    cy: junction.y,
                    r: numWires > 1 ? 3 : 2,
                    style: 'fill:#000',
                    class: netClass
                }]
            );
            
            // Add final line segment
            wireSegments.push(['line', {
                x1: currentPoint.x,
                y1: currentPoint.y,
                x2: section.endPoint.x,
                y2: section.endPoint.y,
                class: netClass,
                style: `stroke-width: ${lineWidth}`
            }]);
            
            return [...wireSegments, ...junctions];
        });
    });
    
    // Create wire labels
    const labels: onml.Element[] = graph.edges.flatMap(edge => {
        // Skip if no label
        if (!edge.labels?.[0]?.text) return [];
        
        const label = edge.labels[0];
        const netId = ElkModel.wireNameLookup[edge.id];
        const numWires = netId.split(',').length - 2;
        const labelClass = `net_${netId.slice(1, -1)} width_${numWires} busLabel_${numWires}`;
        
        return [
            // Label background
            ['rect', {
                x: label.x + 1,
                y: label.y - 1,
                width: (label.text.length + 2) * 6 - 2,
                height: 9,
                class: labelClass,
                style: 'fill: white; stroke: none'
            }],
            // Label text
            ['text', {
                x: label.x,
                y: label.y + 7,
                class: labelClass
            }, `/${label.text}/`]
        ];
    });
    
    // Add labels to lines if present
    if (labels.length > 0) {
        lines.push(...labels);
    }
    
    // Set up SVG attributes
    const svgAttributes: onml.Attributes = { ...Skin.skin[1] };
    svgAttributes.width = String(graph.width);
    svgAttributes.height = String(graph.height);
    
    // Extract and combine styles
    const styles: onml.Element = ['style', {}, ''];
    onml.traverse(Skin.skin, {
        enter: (node) => {
            if (node.name === 'style') {
                styles[2] += node.full[2];
            }
        }
    });
    
    // Build final SVG
    const svgElement: onml.Element = ['svg', svgAttributes, styles, ...nodes, ...lines];
    return onml.s(svgElement);
}