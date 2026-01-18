import { registerNode } from './registry';
import { CityBlueprintNode, CityGeneratorNode } from './city';

// Register all nodes
export function initializeNodes(): void {
  // City nodes
  registerNode(CityBlueprintNode);
  registerNode(CityGeneratorNode);
}

// Re-export everything
export * from './registry';
export * from './city';
