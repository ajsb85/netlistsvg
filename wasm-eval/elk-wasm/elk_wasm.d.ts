/* tslint:disable */
/* eslint-disable */

export class Elk {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * `algorithms` command — `knownLayoutAlgorithms()` JSON.
     */
    knownLayoutAlgorithms(): string;
    /**
     * `categories` command — `knownLayoutCategories()` JSON.
     */
    knownLayoutCategories(): string;
    /**
     * `options` command — `knownLayoutOptions()` JSON.
     */
    knownLayoutOptions(): string;
    /**
     * `layout` command. Takes the graph JSON string plus optional global
     * `layoutOptions` and `options` JSON (empty string = none); returns the
     * laid-out graph JSON.
     */
    layout(graph: string, layout_options: string, options: string): string;
    constructor();
}
