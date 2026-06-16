interface LayoutOptions {
    layoutOptions?: Record<string, unknown>;
}
export default class ELK {
    private elk;
    constructor();
    layout(graph: unknown, opts?: LayoutOptions): Promise<unknown>;
    knownLayoutAlgorithms(): Promise<unknown>;
    knownLayoutOptions(): Promise<unknown>;
    knownLayoutCategories(): Promise<unknown>;
}
export {};
//# sourceMappingURL=elkWasmAdapter.d.ts.map