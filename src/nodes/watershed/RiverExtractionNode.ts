import { NodeDefinition, PreviewData, Polygon } from '../../types';
import { extractRivers, FlowField } from '../../algorithms/watershed/d8';

export const RiverExtractionNode: NodeDefinition = {
  type: 'river-extraction',
  category: 'watershed',
  name: 'Extract Rivers',
  description: 'Trace river network from flow accumulation',
  inputs: [
    {
      id: 'flowField',
      name: 'Flow Field',
      dataType: 'flowField',
      direction: 'input',
      required: true,
    },
  ],
  outputs: [
    {
      id: 'rivers',
      name: 'Rivers',
      dataType: 'geometry',
      direction: 'output',
      required: true,
    },
  ],
  parameters: [
    {
      id: 'minAccumulation',
      name: 'Min Accumulation',
      type: 'number',
      default: 100,
      min: 10,
      max: 1000,
      step: 10,
      description: 'Minimum flow accumulation to be considered a river',
    },
  ],
  execute: async (inputs, params, onProgress) => {
    const flowField = inputs.flowField as FlowField;

    onProgress?.(0, 'Extracting rivers...');

    const rivers = extractRivers(flowField, params.minAccumulation as number);

    onProgress?.(100, 'Done');

    // Convert rivers to polylines
    const polylines: Polygon[] = rivers.map((r) => r.points);

    return { rivers: { type: 'rivers', polylines, rivers } };
  },
  preview: (outputs): PreviewData => {
    const data = outputs.rivers as { polylines: Polygon[] } | undefined;
    if (!data) return { type: 'none', data: null };

    return {
      type: 'polylines',
      data: data.polylines,
      style: { stroke: '#4a90d9', strokeWidth: 2 },
    };
  },
};
