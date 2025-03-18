"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElkModel = void 0;
exports.buildElkGraph = buildElkGraph;
var ElkModel;
(function (ElkModel) {
    // Module state
    ElkModel.wireNameLookup = {};
    ElkModel.dummyNum = 0;
    ElkModel.edgeIndex = 0;
})(ElkModel || (exports.ElkModel = ElkModel = {}));
function buildElkGraph(module) {
    // Initialize state
    const children = module.nodes.map(n => n.buildElkChild());
    ElkModel.edgeIndex = 0;
    ElkModel.dummyNum = 0;
    const edges = [];
    // Process each wire in the module
    module.wires.forEach(wire => {
        const numWires = wire.netName.split(',').length - 2;
        const { drivers, riders, laterals } = wire;
        // Handle different wire connection patterns
        if (drivers.length > 0 && riders.length > 0 && laterals.length === 0) {
            // Direct connections from drivers to riders
            createEdges(drivers, riders, edges, numWires);
        }
        else if (drivers.concat(riders).length > 0 && laterals.length > 0) {
            // Connections through laterals
            createEdges(drivers, laterals, edges, numWires);
            createEdges(laterals, riders, edges, numWires);
        }
        else if (riders.length === 0 && drivers.length > 1) {
            // Multiple drivers with no riders - create dummy junction
            const dummyId = addDummy(children);
            drivers.forEach(driver => {
                edges.push(createDummyEdge(driver, dummyId, 'source', driver.wire.netName));
            });
        }
        else if (riders.length > 1 && drivers.length === 0) {
            // Multiple riders with no drivers - create dummy junction
            const dummyId = addDummy(children);
            riders.forEach(rider => {
                edges.push(createDummyEdge(rider, dummyId, 'target', rider.wire.netName));
            });
        }
        else if (laterals.length > 1) {
            // Connect laterals to each other
            const [source, ...otherLaterals] = laterals;
            otherLaterals.forEach(lateral => {
                const id = `e${ElkModel.edgeIndex++}`;
                edges.push({
                    id,
                    source: source.parentNode.Key,
                    sourcePort: `${source.parentNode.Key}.${source.key}`,
                    target: lateral.parentNode.Key,
                    targetPort: `${lateral.parentNode.Key}.${lateral.key}`
                });
                ElkModel.wireNameLookup[id] = lateral.wire.netName;
            });
        }
    });
    return {
        id: module.moduleName,
        children,
        edges
    };
}
// Helper function to create edges between port collections
function createEdges(sourcePorts, targetPorts, edges, numWires) {
    for (const sourcePort of sourcePorts) {
        const sourceParentKey = sourcePort.parentNode.Key;
        const sourceKey = `${sourceParentKey}.${sourcePort.key}`;
        // Create edge label if needed
        const edgeLabel = numWires > 1 ? [{
                id: `label_${ElkModel.edgeIndex}`,
                text: String(numWires),
                width: 4,
                height: 6,
                x: 0,
                y: 0,
                layoutOptions: { 'org.eclipse.elk.edgeLabels.inline': true }
            }] : undefined;
        for (const targetPort of targetPorts) {
            const targetParentKey = targetPort.parentNode.Key;
            const targetKey = `${targetParentKey}.${targetPort.key}`;
            const id = `e${ElkModel.edgeIndex++}`;
            edges.push({
                id,
                labels: edgeLabel,
                sources: [sourceKey],
                targets: [targetKey],
                layoutOptions: {
                    'org.eclipse.elk.layered.priority.direction': sourcePort.parentNode.type !== '$dff' ? 10 : undefined,
                    'org.eclipse.elk.edge.thickness': numWires > 1 ? 2 : 1
                }
            });
            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
        }
    }
}
// Helper function to create dummy junction nodes
function addDummy(children) {
    const dummyId = `$d_${ElkModel.dummyNum++}`;
    children.push({
        id: dummyId,
        width: 0,
        height: 0,
        ports: [{ id: `${dummyId}.p`, width: 0, height: 0 }],
        layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE' }
    });
    return dummyId;
}
// Helper function to create edges to/from dummy nodes
function createDummyEdge(port, dummyId, type, netName) {
    const parentKey = port.parentNode.Key;
    const id = `e${ElkModel.edgeIndex++}`;
    const edge = {
        id,
        [type === 'source' ? 'source' : 'target']: parentKey,
        [type === 'source' ? 'sourcePort' : 'targetPort']: `${parentKey}.${port.key}`,
        [type === 'source' ? 'target' : 'source']: dummyId,
        [type === 'source' ? 'targetPort' : 'sourcePort']: `${dummyId}.p`
    };
    ElkModel.wireNameLookup[id] = netName;
    return edge;
}
//# sourceMappingURL=elkGraph.js.map