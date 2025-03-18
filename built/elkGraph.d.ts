import { FlatModule } from './FlatModule';
export declare namespace ElkModel {
    interface WirePoint {
        x: number;
        y: number;
    }
    interface LayoutOptions {
        [option: string]: any;
    }
    interface Label {
        id: string;
        text: string;
        x: number;
        y: number;
        height: number;
        width: number;
        layoutOptions?: LayoutOptions;
    }
    interface Port {
        id: string;
        width: number;
        height: number;
        x?: number;
        y?: number;
        labels?: Label[];
    }
    interface Cell {
        id: string;
        width: number;
        height: number;
        ports: Port[];
        layoutOptions?: LayoutOptions;
        labels?: Label[];
        x?: number;
        y?: number;
    }
    interface Section {
        id?: string;
        startPoint: WirePoint;
        endPoint: WirePoint;
        bendPoints?: WirePoint[];
    }
    interface Edge {
        id: string;
        labels?: Label[];
        source?: string;
        sourcePort?: string;
        target?: string;
        targetPort?: string;
        sources?: string[];
        targets?: string[];
        layoutOptions?: LayoutOptions;
        junctionPoints?: WirePoint[];
        bendPoints?: WirePoint[];
        sections?: Section[];
    }
    interface Graph {
        id: string;
        children: Cell[];
        edges: Edge[];
        width?: number;
        height?: number;
    }
    interface WireNameLookup {
        [edgeId: string]: string;
    }
    let wireNameLookup: WireNameLookup;
    let dummyNum: number;
    let edgeIndex: number;
}
export declare function buildElkGraph(module: FlatModule): ElkModel.Graph;
//# sourceMappingURL=elkGraph.d.ts.map