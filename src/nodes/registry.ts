import { NodeDefinition } from '../types';

// Node registry - maps node types to their definitions
const nodeRegistry = new Map<string, NodeDefinition>();

export function registerNode(definition: NodeDefinition): void {
  nodeRegistry.set(definition.type, definition);
}

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return nodeRegistry.get(type);
}

export function getAllNodeDefinitions(): NodeDefinition[] {
  return Array.from(nodeRegistry.values());
}

export function getNodesByCategory(category: NodeDefinition['category']): NodeDefinition[] {
  return getAllNodeDefinitions().filter((n) => n.category === category);
}

// Node categories for UI organization
export const NODE_CATEGORIES: { id: NodeDefinition['category']; name: string; color: string }[] = [
  { id: 'terrain', name: 'Terrain', color: '#d97706' },
  { id: 'watershed', name: 'Watershed', color: '#2563eb' },
  { id: 'biome', name: 'Biome', color: '#16a34a' },
  { id: 'settlement', name: 'Settlement', color: '#9333ea' },
  { id: 'roads', name: 'Roads', color: '#ea580c' },
  { id: 'city', name: 'City', color: '#dc2626' },
  { id: 'output', name: 'Output', color: '#6b7280' },
];

// Port colors by data type
export const PORT_COLORS: Record<string, string> = {
  heightmap: '#d97706',
  flowField: '#2563eb',
  biomeMap: '#16a34a',
  settlements: '#9333ea',
  roadNetwork: '#ea580c',
  cityLayout: '#dc2626',
  geometry: '#db2777',
  number: '#6b7280',
  vec2: '#0891b2',
  polygon: '#4f46e5',
  seed: '#eab308',
};
