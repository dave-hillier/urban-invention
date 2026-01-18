import { registerNode } from './registry';
import { CityBlueprintNode, CityGeneratorNode } from './city';
import { HeightmapInputNode } from './terrain';
import { FlowDirectionNode, FlowAccumulationNode, RiverExtractionNode } from './watershed';

// Register all nodes
export function initializeNodes(): void {
  // Terrain nodes
  registerNode(HeightmapInputNode);

  // Watershed nodes
  registerNode(FlowDirectionNode);
  registerNode(FlowAccumulationNode);
  registerNode(RiverExtractionNode);

  // City nodes
  registerNode(CityBlueprintNode);
  registerNode(CityGeneratorNode);
}

// Re-export everything
export * from './registry';
export * from './city';
export * from './terrain';
export * from './watershed';
