import { FlatModule } from './FlatModule';

export namespace ElkModel {
    // Using interfaces is generally preferred over type aliases for object shapes
    export interface WireNameLookup {
        [edgeId: string]: string;
    }
    export let wireNameLookup: WireNameLookup = {};
    export let dummyNum: number = 0;
    export let edgeIndex: number = 0;

    export interface WirePoint {
        x: number;
        y: number;
    }

    export interface Cell {
        id: string;
        width: number;
        height: number;
        ports: Port[];
        layoutOptions?: LayoutOptions;
        labels?: Label[];
        x?: number;
        y?: number;
    }

    export interface Graph {
        id: string;
        children: Cell[];
        edges: (Edge | ExtendedEdge)[]; // Use union type directly
        width?: number;
        height?: number;
    }

    export interface Port {
        id: string;
        width: number;
        height: number;
        x?: number;
        y?: number;
        labels?: Label[];
    }

    export interface Section {
        id?: string;
        startPoint: WirePoint;
        endPoint: WirePoint;
        bendPoints?: WirePoint[];
    }

    // Combined Edge and ExtendedEdge using optional properties
    export interface Edge {
        id: string;
        labels?: Label[];
        source?: string; // Optional for ExtendedEdge
        sourcePort?: string; // Optional for ExtendedEdge
        target?: string; // Optional for ExtendedEdge
        targetPort?: string; // Optional for ExtendedEdge
        sources?: [string]; // Optional for standard Edge
        targets?: [string]; // Optional for standard Edge
        layoutOptions?: LayoutOptions;
        junctionPoints?: WirePoint[]; // Only in standard Edge
        bendPoints?: WirePoint[];   // Only in standard Edge
        sections?: Section[];        // Only in standard Edge
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
}

export function buildElkGraph(module: FlatModule): ElkModel.Graph {
    const children: ElkModel.Cell[] = module.nodes.map(n => n.buildElkChild());
    ElkModel.edgeIndex = 0;
    ElkModel.dummyNum = 0;
    const edges: ElkModel.Edge[] = [];

    module.wires.forEach(wire => {
        const numWires = wire.netName.split(',').length - 2;

        const addEdges = (sourcePorts, targetPorts) => {
            route(sourcePorts, targetPorts, edges, numWires);
        };

        if (wire.drivers.length > 0 && wire.riders.length > 0 && wire.laterals.length === 0) {
            addEdges(wire.drivers, wire.riders);
        } else if (wire.drivers.concat(wire.riders).length > 0 && wire.laterals.length > 0) {
            addEdges(wire.drivers, wire.laterals);
            addEdges(wire.laterals, wire.riders);
        } else if (wire.riders.length === 0 && wire.drivers.length > 1) {
            const dummyId = addDummy(children);
            const dummyEdges = wire.drivers.map(driver => createDummyEdge(driver, dummyId, 'source'));
            edges.push(...dummyEdges);
        } else if (wire.riders.length > 1 && wire.drivers.length === 0) {
            const dummyId = addDummy(children);
            const dummyEdges = wire.riders.map(rider => createDummyEdge(rider, dummyId, 'target'));
            edges.push(...dummyEdges);
        } else if (wire.laterals.length > 1) {
            const [source, ...otherLaterals] = wire.laterals; // Destructure for clarity
            const sourceParentKey = source.parentNode.Key;
            const lateralEdges = otherLaterals.map(lateral => {
                const lateralParentKey = lateral.parentNode.Key;
                const id = `e${ElkModel.edgeIndex++}`;
                const edge: ElkModel.Edge = {
                    id,
                    source: sourceParentKey,
                    sourcePort: `${sourceParentKey}.${source.key}`,
                    target: lateralParentKey,
                    targetPort: `${lateralParentKey}.${lateral.key}`,
                };
                ElkModel.wireNameLookup[id] = lateral.wire.netName;
                return edge;
            });
            edges.push(...lateralEdges);
        }
    });

    return {
        id: module.moduleName,
        children,
        edges,
    };
}

// Helper function to create dummy edges (for drivers or riders)
function createDummyEdge(port, dummyId: string, type: 'source' | 'target'): ElkModel.Edge {
    const sourceParentKey = port.parentNode.Key;
    const id = `e${ElkModel.edgeIndex++}`;
    const edge: ElkModel.Edge = {
        id,
        [type === 'source' ? 'source' : 'target']: sourceParentKey,
        [(type === 'source' ? 'sourcePort' : 'targetPort')]: `${sourceParentKey}.${port.key}`,
        [type === 'source' ? 'target' : 'source']: dummyId,
        [(type === 'source' ? 'targetPort' : 'sourcePort')]: `${dummyId}.p`,
    };
    ElkModel.wireNameLookup[id] = port.wire.netName;
    return edge;
}

function addDummy(children: ElkModel.Cell[]): string {
    const dummyId = `$d_${ElkModel.dummyNum++}`;
    children.push({
        id: dummyId,
        width: 0,
        height: 0,
        ports: [{ id: `${dummyId}.p`, width: 0, height: 0 }],
        layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_SIDE' },
    });
    return dummyId;
}

function route(sourcePorts, targetPorts, edges: ElkModel.Edge[], numWires: number) {
    for (const sourcePort of sourcePorts) {
        const sourceParentKey = sourcePort.parentNode.Key;
        const sourceKey = `${sourceParentKey}.${sourcePort.key}`;
        const edgeLabel: ElkModel.Label[] | undefined = numWires > 1
            ? [{
                id: `label_${ElkModel.edgeIndex}`, // Give label a unique ID
                text: String(numWires),
                width: 4,
                height: 6,
                x: 0,
                y: 0,
                layoutOptions: { 'org.eclipse.elk.edgeLabels.inline': true },
            }]
            : undefined;

        for (const targetPort of targetPorts) {
            const targetParentKey = targetPort.parentNode.Key;
            const targetKey = `${targetParentKey}.${targetPort.key}`;
            const id = `e${ElkModel.edgeIndex++}`;
            const edge: ElkModel.Edge = {
                id,
                labels: edgeLabel,
                sources: [sourceKey], // Use sources/targets for consistency
                targets: [targetKey],
                layoutOptions: {
                    'org.eclipse.elk.layered.priority.direction': sourcePort.parentNode.type !== '$dff' ? 10 : undefined,
                    'org.eclipse.elk.edge.thickness': numWires > 1 ? 2 : 1,
                },
            };
            ElkModel.wireNameLookup[id] = targetPort.wire.netName;
            edges.push(edge);
        }
    }
}