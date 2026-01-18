import { NodeDefinition } from '../../types';

export const CityBlueprintNode: NodeDefinition = {
  type: 'city-blueprint',
  category: 'city',
  name: 'City Blueprint',
  description: 'Configure city generation parameters',
  inputs: [],
  outputs: [
    {
      id: 'blueprint',
      name: 'Blueprint',
      dataType: 'cityLayout',
      direction: 'output',
      required: true,
    },
  ],
  parameters: [
    {
      id: 'seed',
      name: 'Seed',
      type: 'number',
      default: 12345,
      min: 0,
      max: 999999,
      step: 1,
      description: 'Random seed for generation',
    },
    {
      id: 'size',
      name: 'Size (patches)',
      type: 'number',
      default: 20,
      min: 6,
      max: 60,
      step: 1,
      description: 'Number of Voronoi patches',
    },
    {
      id: 'walls',
      name: 'Has Walls',
      type: 'boolean',
      default: true,
      description: 'Generate city walls',
    },
    {
      id: 'citadel',
      name: 'Has Citadel',
      type: 'boolean',
      default: true,
      description: 'Include a castle/citadel',
    },
    {
      id: 'plaza',
      name: 'Has Plaza',
      type: 'boolean',
      default: true,
      description: 'Include a market plaza',
    },
    {
      id: 'temple',
      name: 'Has Temple',
      type: 'boolean',
      default: true,
      description: 'Include a cathedral/temple',
    },
    {
      id: 'river',
      name: 'Has River',
      type: 'boolean',
      default: false,
      description: 'Add a river through the city',
    },
    {
      id: 'coast',
      name: 'Coastal',
      type: 'boolean',
      default: false,
      description: 'City is on the coast',
    },
    {
      id: 'coastDirection',
      name: 'Coast Direction',
      type: 'number',
      default: 180,
      min: 0,
      max: 360,
      step: 15,
      description: 'Direction of coast (degrees)',
    },
  ],
  execute: async (_inputs, params) => {
    // Blueprint is just configuration - actual generation happens in CityGenerator
    return {
      blueprint: {
        seed: params.seed as number,
        size: params.size as number,
        walls: params.walls as boolean,
        citadel: params.citadel as boolean,
        plaza: params.plaza as boolean,
        temple: params.temple as boolean,
        river: params.river as boolean,
        coast: params.coast as boolean,
        coastDirection: params.coastDirection as number,
      },
    };
  },
  preview: () => ({ type: 'none', data: null }),
};
