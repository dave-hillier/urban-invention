import { NodeDefinition, PreviewData } from '../../types';
import { Heightmap } from '../../algorithms/terrain/noise';
import {
  computeD8FlowDirection,
  resolvePitsAndFlats,
  FlowField,
} from '../../algorithms/watershed/d8';

export const FlowDirectionNode: NodeDefinition = {
  type: 'flow-direction',
  category: 'watershed',
  name: 'D8 Flow Direction',
  description: 'Compute flow directions using D8 algorithm',
  inputs: [
    {
      id: 'heightmap',
      name: 'Heightmap',
      dataType: 'heightmap',
      direction: 'input',
      required: true,
    },
  ],
  outputs: [
    {
      id: 'flowField',
      name: 'Flow Field',
      dataType: 'flowField',
      direction: 'output',
      required: true,
    },
  ],
  parameters: [
    {
      id: 'seaLevel',
      name: 'Sea Level',
      type: 'number',
      default: 0.1,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: 'Height below which is considered sea',
    },
    {
      id: 'resolvePits',
      name: 'Resolve Pits',
      type: 'boolean',
      default: true,
      description: 'Resolve depressions and flat areas',
    },
  ],
  execute: async (inputs, params, onProgress) => {
    const heightmap = inputs.heightmap as Heightmap;

    onProgress?.(0, 'Computing flow directions...');

    const flowField = computeD8FlowDirection(heightmap, params.seaLevel as number);

    if (params.resolvePits) {
      onProgress?.(50, 'Resolving pits and flats...');
      resolvePitsAndFlats(flowField, heightmap);
    }

    onProgress?.(100, 'Done');

    return { flowField };
  },
  preview: (outputs): PreviewData => {
    const flowField = outputs.flowField as FlowField | undefined;
    if (!flowField) return { type: 'none', data: null };

    return {
      type: 'image',
      data: { type: 'flowField', ...flowField },
    };
  },
};
