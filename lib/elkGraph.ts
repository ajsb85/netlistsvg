import { FlatModule } from './FlatModule';

export namespace ElkModel {
    // Core interfaces for graph elements
    export interface WirePoint {
        x: number;
        y: number;
    }

    export interface LayoutOptions {
        [option: string]: any;
    }

    export interface Label {
        id: string;
        text: string;
        x: number;
        y: number;
        height: number;
        width: number;
        layoutOptions?: LayoutOptions;
    }

    export interface Port {
        id: string;
        width: number;
        height: number;
        x?: number;
        y?: number;
        labels?: Label[];
        layoutOptions?: LayoutOptions;
    }

    export interface Cell {
        id: string;
        width?: number;
        height?: number;
        ports: Port[];
        layoutOptions?: LayoutOptions;
        labels?: Label[];
        x?: number;
        y?: number;
        // populated for expanded hierarchical submodules
        children?: Cell[];
        edges?: Edge[];
    }

    export interface Section {
        id?: string;
        startPoint: WirePoint;
        endPoint: WirePoint;
        bendPoints?: WirePoint[];
    }

    export interface Edge {
        id: string;
        labels?: Label[];
        // Connection points - either source/target or sources/targets
        source?: string;
        sourcePort?: string;
        target?: string;
        targetPort?: string;
        sources?: string[];
        targets?: string[];
        // Layout properties
        layoutOptions?: LayoutOptions;
        junctionPoints?: WirePoint[];
        bendPoints?: WirePoint[];
        sections?: Section[];
    }

    export interface Graph {
        id: string;
        children: Cell[];
        edges: Edge[];
        width?: number;
        height?: number;
    }

    // Utility type for wire name tracking
    export interface WireNameLookup {
        [edgeId: string]: string;
    }

    // Module state
    export let wireNameLookup: WireNameLookup = {};
    export let dummyNum: number = 0;
    export let edgeIndex: number = 0;
}

export function buildElkGraph(module: FlatModule): ElkModel.Graph {
    const moduleName = module.moduleName;
    // Initialize state
    const children: ElkModel.Cell[] = module.nodes.map(n => n.buildElkChild());
    ElkModel.edgeIndex = 0;
    ElkModel.dummyNum = 0;
    const edges: ElkModel.Edge[] = [];

    // Process each wire in the module
    module.wires.forEach(wire => {
        const numWires = wire.netName.split(',').length - 2;
        const { drivers, riders, laterals } = wire;

        // Handle different wire connection patterns
        if (drivers.length > 0 && riders.length > 0 && laterals.length === 0) {
            // Direct connections from drivers to riders
            createEdges(drivers, riders, edges, numWires, moduleName);
        }
        else if (drivers.concat(riders).length > 0 && laterals.length > 0) {
            // Connections through laterals
            createEdges(drivers, laterals, edges, numWires, moduleName);
            createEdges(laterals, riders, edges, numWires, moduleName);
        }
        else if (riders.length === 0 && drivers.length > 1) {
            // Multiple drivers with no riders - create dummy junction
            const dummyId = addDummy(children, moduleName);
            drivers.forEach(driver => {
                edges.push(createDummyEdge(driver, dummyId, 'source', driver.wire!.netName, moduleName));
            });
        }
        else if (riders.length > 1 && drivers.length === 0) {
            // Multiple riders with no drivers - create dummy junction
            const dummyId = addDummy(children, moduleName);
            riders.forEach(rider => {
                edges.push(createDummyEdge(rider, dummyId, 'target', rider.wire!.netName, moduleName));
            });
        }
        else if (laterals.length > 1) {
            // Connect laterals to each other
            const [source, ...otherLaterals] = laterals;
            const sourceParentKey = source.parentNode!.Key;
            otherLaterals.forEach(lateral => {
                const lateralParentKey = lateral.parentNode!.Key;
                const id = `${moduleName}.e${ElkModel.edgeIndex++}`;
                edges.push({
                    id,
                    source: `${moduleName}.${sourceParentKey}`,
                    sourcePort: `${moduleName}.${sourceParentKey}.${source.key}`,
                    target: `${moduleName}.${lateralParentKey}`,
                    targetPort: `${moduleName}.${lateralParentKey}.${lateral.key}`
                });
                ElkModel.wireNameLookup[id] = lateral.wire!.netName;
            });
        }
    });

    return {
        id: moduleName,
        children,
        edges
    };
}

// Helper function to create edges between port collections.
// Edge ids and endpoints are namespaced with the module name so that the cells of
// distinct (and recursively expanded) modules never collide.
function createEdges(sourcePorts, targetPorts, edges: ElkModel.Edge[], numWires: number, moduleName: string) {
    for (const sourcePort of sourcePorts) {
        const sourceParentKey = sourcePort.parentNode.Key;
        const source = `${moduleName}.${sourceParentKey}`;
        const sourceKey = `${source}.${sourcePort.key}`;

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
            const target = `${moduleName}.${targetParentKey}`;
            const targetKey = `${target}.${targetPort.key}`;
            const id = `${moduleName}.e${ElkModel.edgeIndex++}`;

            edges.push({
                id,
                labels: edgeLabel,
                source,
                sourcePort: sourceKey,
                target,
                targetPort: targetKey,
                layoutOptions: {
                    'org.eclipse.elk.layered.priority.direction':
                        sourcePort.parentNode.type !== '$dff' ? 10 : undefined,
                    'org.eclipse.elk.edge.thickness': numWires > 1 ? 2 : 1
                }
            });

            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
        }
    }
}

// Helper function to create dummy junction nodes
function addDummy(children: ElkModel.Cell[], moduleName: string): string {
    const dummyId = `${moduleName}.$d_${ElkModel.dummyNum++}`;
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
function createDummyEdge(
    port,
    dummyId: string,
    type: 'source' | 'target',
    netName: string,
    moduleName: string
): ElkModel.Edge {
    const parentKey = `${moduleName}.${port.parentNode.Key}`;
    const id = `${moduleName}.e${ElkModel.edgeIndex++}`;

    const edge: ElkModel.Edge = {
        id,
        [type === 'source' ? 'source' : 'target']: parentKey,
        [type === 'source' ? 'sourcePort' : 'targetPort']: `${parentKey}.${port.key}`,
        [type === 'source' ? 'target' : 'source']: dummyId,
        [type === 'source' ? 'targetPort' : 'sourcePort']: `${dummyId}.p`
    };

    ElkModel.wireNameLookup[id] = netName;
    return edge;
}