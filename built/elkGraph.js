"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElkModel = void 0;
exports.buildElkGraph = buildElkGraph;
var ElkModel;
(function (ElkModel) {
    ElkModel.wireNameLookup = {};
    ElkModel.dummyNum = 0;
    ElkModel.edgeIndex = 0;
})(ElkModel || (exports.ElkModel = ElkModel = {}));
function buildElkGraph(module) {
    const children = module.nodes.map((n) => {
        return n.buildElkChild();
    });
    ElkModel.edgeIndex = 0;
    ElkModel.dummyNum = 0;
    const edges = [];
    module.wires.forEach((w) => {
        const numWires = w.netName.split(',').length - 2;
        if (w.drivers.length > 0 && w.riders.length > 0 && w.laterals.length === 0) {
            route(w.drivers, w.riders, edges, numWires);
        }
        else if (w.drivers.concat(w.riders).length > 0 && w.laterals.length > 0) {
            route(w.drivers, w.laterals, edges, numWires);
            route(w.laterals, w.riders, edges, numWires);
        }
        else if (w.riders.length === 0 && w.drivers.length > 1) {
            const dummyId = addDummy(children);
            ElkModel.dummyNum += 1;
            const dummyEdges = w.drivers.map((driver) => {
                const sourceParentKey = driver.parentNode.Key;
                const id = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const d = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + driver.key,
                    target: dummyId,
                    targetPort: dummyId + '.p',
                };
                ElkModel.wireNameLookup[id] = driver.wire.netName;
                return d;
            });
            edges.push(...dummyEdges); // Append dummyEdges
        }
        else if (w.riders.length > 1 && w.drivers.length === 0) {
            const dummyId = addDummy(children);
            ElkModel.dummyNum += 1;
            const dummyEdges = w.riders.map((rider) => {
                const sourceParentKey = rider.parentNode.Key;
                const id = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const edge = {
                    id,
                    source: dummyId,
                    sourcePort: dummyId + '.p',
                    target: sourceParentKey,
                    targetPort: sourceParentKey + '.' + rider.key,
                };
                ElkModel.wireNameLookup[id] = rider.wire.netName;
                return edge;
            });
            edges.push(...dummyEdges); //Append dummyEdges
        }
        else if (w.laterals.length > 1) {
            const source = w.laterals[0];
            const sourceParentKey = source.parentNode.Key;
            const lateralEdges = w.laterals.slice(1).map((lateral) => {
                const lateralParentKey = lateral.parentNode.Key;
                const id = 'e' + String(ElkModel.edgeIndex);
                ElkModel.edgeIndex += 1;
                const edge = {
                    id,
                    source: sourceParentKey,
                    sourcePort: sourceParentKey + '.' + source.key,
                    target: lateralParentKey,
                    targetPort: lateralParentKey + '.' + lateral.key,
                };
                ElkModel.wireNameLookup[id] = lateral.wire.netName;
                return edge;
            });
            edges.push(...lateralEdges); // Append lateralEdges
        }
        // No need to return anything for forEach
    });
    return {
        id: module.moduleName,
        children,
        edges,
    };
}
function addDummy(children) {
    const dummyId = '$d_' + String(ElkModel.dummyNum);
    const child = {
        id: dummyId,
        width: 0,
        height: 0,
        ports: [{
                id: dummyId + '.p',
                width: 0,
                height: 0,
            }],
        layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE' },
    };
    children.push(child);
    return dummyId;
}
function route(sourcePorts, targetPorts, edges, numWires) {
    sourcePorts.forEach((sourcePort) => {
        const sourceParentKey = sourcePort.parentNode.key;
        const sourceKey = sourceParentKey + '.' + sourcePort.key;
        let edgeLabel; // Allow undefined
        if (numWires > 1) {
            edgeLabel = [{
                    id: '',
                    text: String(numWires),
                    width: 4,
                    height: 6,
                    x: 0,
                    y: 0,
                    layoutOptions: {
                        'org.eclipse.elk.edgeLabels.inline': true,
                    },
                }];
        }
        targetPorts.forEach((targetPort) => {
            const targetParentKey = targetPort.parentNode.key;
            const targetKey = targetParentKey + '.' + targetPort.key;
            const id = 'e' + ElkModel.edgeIndex;
            const edge = {
                id,
                labels: edgeLabel, // Use the potentially undefined edgeLabel
                sources: [sourceKey],
                targets: [targetKey],
            };
            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
            if (sourcePort.parentNode.type !== '$dff') {
                edge.layoutOptions = {
                    'org.eclipse.elk.layered.priority.direction': 10,
                    'org.eclipse.elk.edge.thickness': (numWires > 1 ? 2 : 1)
                };
            }
            else {
                edge.layoutOptions = { 'org.eclipse.elk.edge.thickness': (numWires > 1 ? 2 : 1) };
            }
            ElkModel.edgeIndex += 1;
            edges.push(edge); // Push the new edge
        });
    });
}
//# sourceMappingURL=elkGraph.js.map