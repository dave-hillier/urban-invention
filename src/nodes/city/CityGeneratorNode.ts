import { NodeDefinition, PreviewData, CityLayout } from '../../types';
import { City, CityBlueprint } from '../../algorithms/mfcg';

export const CityGeneratorNode: NodeDefinition = {
  type: 'city-generator',
  category: 'city',
  name: 'Generate City',
  description: 'Run MFCG algorithm to generate city layout',
  inputs: [
    {
      id: 'blueprint',
      name: 'Blueprint',
      dataType: 'cityLayout',
      direction: 'input',
      required: true,
    },
  ],
  outputs: [
    {
      id: 'city',
      name: 'City',
      dataType: 'cityLayout',
      direction: 'output',
      required: true,
    },
  ],
  parameters: [],
  execute: async (inputs, _params, onProgress) => {
    const blueprint = inputs.blueprint as CityBlueprint;

    onProgress?.(0, 'Initializing city...');

    const city = new City(blueprint);

    onProgress?.(50, 'Building city...');

    const layout = city.build();

    onProgress?.(100, 'Done');

    return { city: layout };
  },
  preview: (outputs): PreviewData => {
    const city = outputs.city as CityLayout | undefined;
    if (!city) return { type: 'none', data: null };

    return {
      type: 'city-layout',
      data: city,
    };
  },
};
