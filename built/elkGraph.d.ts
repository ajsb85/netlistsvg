import { FlatModule } from './FlatModule';
export declare namespace ElkModel {
    interface WireNameLookup {
        [edgeId: string]: string;
    }
    export let wireNameLookup: WireNameLookup;
    export let dummyNum: number;
    export let edgeIndex: number;
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
        edges: (Edge | ExtendedEdge)[];
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
    export interface Edge {
        id: string;
        labels?: Label[];
        source: string;
        sourcePort: string;
        target: string;
        targetPort: string;
        layoutOptions?: LayoutOptions;
        junctionPoints?: WirePoint[];
        bendPoints?: WirePoint[];
        sections?: Section[];
    }
    export interface ExtendedEdge {
        id: string;
        labels?: Label[];
        sources: [string];
        targets: [string];
        layoutOptions?: LayoutOptions;
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
    export {};
}
export declare function buildElkGraph(module: FlatModule): ElkModel.Graph;
//# sourceMappingURL=elkGraph.d.ts.map