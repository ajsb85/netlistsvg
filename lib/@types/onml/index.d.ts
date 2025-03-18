declare module 'onml' {

    export interface Attributes {
        [attrName: string]: string | number | boolean; // More accurate attribute types
    }

    // Define the 'enter' and 'leave' callback types
    export interface TraverseCallbacks {
        enter?: (node: Element, parent?: Element) => void | boolean;
        leave?: (node: Element, parent?: Element) => void;
        text?: (text: string, parent?: Element) => void; // Add the 'text' callback
    }
     // Define a common interface for element and node.
     export interface Node {
        name: string;
        attr: Attributes;
        full: Element; // Use Element type here.
    }

    // Use a recursive type alias for Element
    export type Element = [string, Attributes?, ...(string | Element)[]];
    // Equivalent to:
    // export type Element = [string, (Attributes | string | Element)?, ...(string | Element)[]];

    export function parse(source: string): Element; // Changed parameter name to 'source'
    export function p(source: string): Element;      // Changed parameter name to 'source'
    export function stringify(data: Element): string; // Changed parameter name to 'data'
    export function s(data: Element): string;        // Changed parameter name to 'data'
    export function traverse(data: Element, callbacks: TraverseCallbacks): void; // Use the interface
    // Deprecated in favor of traverse
    // export function t(data: Element, callbacks: TraverseCallbacks): void;
}