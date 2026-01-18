import { registerNode } from './registry';
import { CityBlueprintNode, CityGeneratorNode } from './city';
import { HeightmapInputNode } from './terrain';
import {
  FlowDirectionNode,
  FlowAccumulationNode,
  RiverExtractionNode,
  WatershedBasinsNode,
} from './watershed';

// Register all nodes
export function initializeNodes(): void {
  // Terrain nodes
  registerNode(HeightmapInputNode);

  // Watershed nodes
  registerNode(FlowDirectionNode);
  registerNode(FlowAccumulationNode);
  registerNode(RiverExtractionNode);
  registerNode(WatershedBasinsNode);

  // City nodes
  registerNode(CityBlueprintNode);
  registerNode(CityGeneratorNode);
}

// Re-export everything
export * from './registry';
export * from './city';
export * from './terrain';
export * from './watershed';
