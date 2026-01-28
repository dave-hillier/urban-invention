# Urban Invention

A web-based visual node graph editor for procedural medieval city generation. 

Generate historically-accurate High Medieval South Coast settlements (1100-1300 AD) ranging from small hamlets (~5 buildings) to large towns (200+ buildings).

## Features

- **Visual Node Graph Editor** - Drag-and-drop node-based workflow using XYFlow
- **Procedural City Generation** - Complete MFCG algorithm implementation including:
  - Voronoi-based city patches with Lloyd relaxation
  - Defensive walls with gates and towers
  - Streets, plazas, temples, and harbors
  - Ward assignment (castle, market, cathedral, farms, etc.)
  - Building footprints with L-shaped lots
- **Terrain Generation** - Fractal noise heightmaps using Perlin/Simplex noise
- **Watershed Analysis** - Hydrological simulation with:
  - D8 flow direction algorithm
  - Flow accumulation computation
  - River extraction
  - Watershed basin delineation
- **Real-time Preview** - 2D canvas rendering with multiple visualization modes
- **Execution Engine** - Topological sort with dependency resolution and caching

## Technologies

- React 19
- TypeScript
- Vite
- XYFlow (React Flow)
- Three.js

## Installation

**Prerequisites:** Node.js 20+

```bash
# Clone the repository
git clone https://github.com/dave-hillier/urban-invention.git
cd urban-invention

# Install dependencies
npm install
```

## Usage

### Development

```bash
npm run dev
```

Opens the development server at `http://localhost:5173/urban-invention/`

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
urban-invention/
├── src/
│   ├── nodes/              # Node definitions
│   │   ├── city/           # City generation nodes
│   │   ├── terrain/        # Heightmap generation
│   │   └── watershed/      # Hydrological analysis
│   ├── engine/             # Graph execution engine
│   ├── algorithms/         # Core algorithms
│   │   ├── mfcg/           # Medieval Fantasy City Generator
│   │   ├── terrain/        # Noise generation
│   │   └── watershed/      # D8 flow direction
│   ├── components/         # React UI components
│   └── types/              # TypeScript type definitions
├── docs/
│   └── spec.md             # Detailed specification
└── .github/workflows/      # CI/CD configuration
```

## How It Works

1. **Create a Node Graph** - Drag nodes from the palette onto the canvas
2. **Connect Nodes** - Link outputs to inputs to define data flow
3. **Configure Parameters** - Adjust settings in the properties panel
4. **Execute** - The engine resolves dependencies and runs nodes in topological order
5. **Preview** - View generated cities, terrain, and watersheds in the preview panel

## Node Types

| Category | Nodes |
|----------|-------|
| City | CityBlueprintNode, CityGeneratorNode |
| Terrain | HeightmapInputNode |
| Watershed | FlowDirectionNode, FlowAccumulationNode, RiverExtractionNode, WatershedBasinsNode |

## Deployment

The project automatically deploys to GitHub Pages on push to the main branch via GitHub Actions.

## License

See [LICENSE](LICENSE) for details.
