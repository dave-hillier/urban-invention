import { NodeDefinition, PreviewData } from '../../types';
import { computeFlowAccumulation, FlowField } from '../../algorithms/watershed/d8';

export const FlowAccumulationNode: NodeDefinition = {
  type: 'flow-accumulation',
  category: 'watershed',
  name: 'Flow Accumulation',
  description: 'Compute upstream drainage area for each cell',
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
      id: 'flowField',
      name: 'Flow Field',
      dataType: 'flowField',
      direction: 'output',
      required: true,
    },
  ],
  parameters: [],
  execute: async (inputs, _params, onProgress) => {
    const flowField = inputs.flowField as FlowField;

    onProgress?.(0, 'Computing flow accumulation...');

    // Clone the flow field to avoid mutating input
    const result: FlowField = {
      width: flowField.width,
      height: flowField.height,
      directions: new Uint8Array(flowField.directions),
      accumulation: new Float32Array(flowField.accumulation.length),
    };

    computeFlowAccumulation(result);

    onProgress?.(100, 'Done');

    return { flowField: result };
  },
  preview: (outputs): PreviewData => {
    const flowField = outputs.flowField as FlowField | undefined;
    if (!flowField) return { type: 'none', data: null };

    return {
      type: 'image',
      data: { type: 'flowAccumulation', ...flowField },
    };
  },
};
