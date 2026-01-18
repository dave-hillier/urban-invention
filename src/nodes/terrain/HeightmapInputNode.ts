import { NodeDefinition, PreviewData } from '../../types';
import { generateNoiseHeightmap, Heightmap } from '../../algorithms/terrain/noise';

export const HeightmapInputNode: NodeDefinition = {
  type: 'heightmap-input',
  category: 'terrain',
  name: 'Heightmap Input',
  description: 'Generate a heightmap using fractal noise',
  inputs: [],
  outputs: [
    {
      id: 'heightmap',
      name: 'Heightmap',
      dataType: 'heightmap',
      direction: 'output',
      required: true,
    },
  ],
  parameters: [
    {
      id: 'width',
      name: 'Width',
      type: 'number',
      default: 256,
      min: 64,
      max: 1024,
      step: 64,
      description: 'Width of the heightmap',
    },
    {
      id: 'height',
      name: 'Height',
      type: 'number',
      default: 256,
      min: 64,
      max: 1024,
      step: 64,
      description: 'Height of the heightmap',
    },
    {
      id: 'seed',
      name: 'Seed',
      type: 'number',
      default: 12345,
      min: 0,
      max: 999999,
      step: 1,
      description: 'Random seed for noise generation',
    },
    {
      id: 'octaves',
      name: 'Octaves',
      type: 'number',
      default: 6,
      min: 1,
      max: 8,
      step: 1,
      description: 'Number of noise octaves (detail levels)',
    },
    {
      id: 'persistence',
      name: 'Persistence',
      type: 'number',
      default: 0.5,
      min: 0.1,
      max: 0.9,
      step: 0.05,
      description: 'Amplitude reduction per octave',
    },
    {
      id: 'lacunarity',
      name: 'Lacunarity',
      type: 'number',
      default: 2.0,
      min: 1.5,
      max: 3.0,
      step: 0.1,
      description: 'Frequency increase per octave',
    },
    {
      id: 'scale',
      name: 'Scale',
      type: 'number',
      default: 0.01,
      min: 0.001,
      max: 0.05,
      step: 0.001,
      description: 'Overall noise scale (larger = more zoomed out)',
    },
  ],
  execute: async (_inputs, params, onProgress) => {
    onProgress?.(0, 'Generating heightmap...');

    const heightmap = generateNoiseHeightmap(
      params.width as number,
      params.height as number,
      params.seed as number,
      params.octaves as number,
      params.persistence as number,
      params.lacunarity as number,
      params.scale as number
    );

    onProgress?.(100, 'Done');

    return { heightmap };
  },
  preview: (outputs): PreviewData => {
    const heightmap = outputs.heightmap as Heightmap | undefined;
    if (!heightmap) return { type: 'none', data: null };

    return {
      type: 'image',
      data: { type: 'heightmap', ...heightmap },
    };
  },
};
