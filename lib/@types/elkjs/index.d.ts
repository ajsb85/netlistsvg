declare module 'elkjs/lib/elk.bundled' { // Correct module path
    export interface ElkLayoutOptions {
      [key: string]: any; // More idiomatic index signature
    }
  
    export interface ElkShape {
      id: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      layoutOptions?: ElkLayoutOptions;
    }

    export interface ElkLabel extends ElkShape {
      text: string;
    }
  
    export interface ElkPort extends ElkShape {
      labels?: ElkLabel[];
    }
  
    export interface ElkNode extends ElkShape {
      children?: ElkNode[];
      ports?: ElkPort[];
      edges?: ElkExtendedEdge[];
      labels?: ElkLabel[];
    }
  
    export interface ElkEdge extends ElkShape {
      sources: string[];
      targets: string[];
      labels?: ElkLabel[];
      junctionPoints?: ElkPoint[];
    }
  
      // Bend points are relative to the section they are in.
    export interface ElkPoint {
      x: number;
      y: number;
    }
    export interface ElkEdgeSection {
      startPoint: ElkPoint;
      endPoint: ElkPoint;
      bendPoints?: ElkPoint[];
    }
    export interface ElkExtendedEdge extends ElkEdge {
      junctionPoints?: ElkPoint[]; // For consistency
      sections?: ElkEdgeSection[];
    }
  
    export interface ElkRoot extends ElkNode {
      edges?: ElkExtendedEdge[]; // Top-level edges
    }

    export interface ElkLayoutArguments {
      layoutOptions?: ElkLayoutOptions;
    }
  
    export default class ELK {  // Use 'export default' for the class
      constructor(options?: any); // Allow constructor options
      public layout(graph: ElkRoot, options?: ElkLayoutArguments): Promise<ElkRoot>;
    }
  }