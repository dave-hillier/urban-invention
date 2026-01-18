// Data types that can flow through the graph
export type DataType =
  | 'heightmap'
  | 'flowField'
  | 'biomeMap'
  | 'settlements'
  | 'roadNetwork'
  | 'cityLayout'
  | 'geometry'
  | 'number'
  | 'vec2'
  | 'polygon'
  | 'seed';

// Port definition for nodes
export interface Port {
  id: string;
  name: string;
  dataType: DataType;
  direction: 'input' | 'output';
  required: boolean;
  default?: unknown;
}

// Parameter types for node configuration
export type ParameterType = 'number' | 'boolean' | 'enum' | 'vec2' | 'string';

export interface ParameterDefinition {
  id: string;
  name: string;
  type: ParameterType;
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description?: string;
}

// Preview data returned by nodes
export interface PreviewData {
  type: 'image' | 'polylines' | 'polygons' | 'city-layout' | 'markers' | 'none';
  data: unknown;
  style?: {
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
  };
  legend?: Record<string, string>;
}

// Node definition (static template)
export interface NodeDefinition {
  type: string;
  category: 'terrain' | 'watershed' | 'biome' | 'settlement' | 'roads' | 'city' | 'output';
  name: string;
  description: string;
  inputs: Port[];
  outputs: Port[];
  parameters: ParameterDefinition[];
  execute: (
    inputs: Record<string, unknown>,
    params: Record<string, unknown>,
    onProgress?: (progress: number, message: string) => void
  ) => Promise<Record<string, unknown>>;
  preview?: (outputs: Record<string, unknown>, params: Record<string, unknown>) => PreviewData;
}

// Node instance state
export type NodeState = 'idle' | 'stale' | 'running' | 'complete' | 'error';

// Node instance (runtime instance)
export interface NodeInstance {
  id: string;
  type: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
  state: NodeState;
  outputs: Record<string, unknown> | null;
  error?: string;
  executionTime?: number;
}

// Connection between nodes
export interface Connection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

// Graph (complete node graph)
export interface Graph {
  nodes: NodeInstance[];
  connections: Connection[];
  viewport: { x: number; y: number; zoom: number };
}

// Utility functions
export function createEmptyGraph(): Graph {
  return {
    nodes: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function createNodeInstance(
  type: string,
  position: { x: number; y: number },
  params: Record<string, unknown> = {}
): NodeInstance {
  return {
    id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    position,
    parameters: params,
    state: 'idle',
    outputs: null,
  };
}
