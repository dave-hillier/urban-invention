import { NodeDefinition, PreviewData } from '../../types';
import { delineateWatersheds, FlowField, WatershedBasins } from '../../algorithms/watershed/d8';

export const WatershedBasinsNode: NodeDefinition = {
  type: 'watershed-basins',
  category: 'watershed',
  name: 'Watershed Basins',
  description: 'Delineate drainage basins from flow directions',
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
      id: 'basins',
      name: 'Basins',
      dataType: 'biomeMap',
      direction: 'output',
      required: true,
    },
  ],
  parameters: [],
  execute: async (inputs, _params, onProgress) => {
    const flowField = inputs.flowField as FlowField;

    onProgress?.(0, 'Delineating watersheds...');

    const basins = delineateWatersheds(flowField);

    onProgress?.(100, 'Done');

    return { basins };
  },
  preview: (outputs): PreviewData => {
    const basins = outputs.basins as WatershedBasins | undefined;
    if (!basins) return { type: 'none', data: null };

    return {
      type: 'image',
      data: { type: 'watershedBasins', ...basins },
    };
  },
};
