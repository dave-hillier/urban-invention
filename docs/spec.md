Read 3 files
Town Generator Overview
The town generator is a procedural settlement generation system targeting High Medieval South Coast of England (1100-1300 AD). It scales from small hamlets (5 buildings) to towns (200+ buildings).

Primary Reference: MFCG (Medieval Fantasy City Generator)
The C++ implementation in tools/town_generator/ is a faithful port of Oleg Dolya's (watabou) Medieval Fantasy City Generator, originally written in Haxe.

Core Algorithm:

Voronoi Patches - Generate patches from a spiral of seed points
Coast/Water - Mark cells as water using Perlin noise
Edge Optimization - Collapse short edges for clean junctions
Walls - Build curtain walls around inner patches with towers/gates
Streets - Connect gates to center using topology/pathfinding
Canals - Add rivers through the city
Ward Assignment - Each cell gets a type (Market, Alleys, Castle, Cathedral, Farm, Harbour, Park, Wilderness)
Building Generation - Subdivide lots and place L-shaped building footprints
Key Requirements
Requirement	Decision
Scale	Single algorithm handles hamlet → town
Interiors	Required (floor plans, not solid volumes)
Terrain Integration	Buildings adapt; cellars/wells cut into terrain
Street Networks	Hybrid: Space Colonization + A* terrain-following
Defenses	Required for towns (walls, gates, towers) - south coast was contested frontier
Asset Pipeline	Procedural blockout → hand-crafted replacement
Academic References
The design draws from:

Runions et al. (2007) - Space Colonization Algorithm for organic street growth
Parish & Müller (2001) - Procedural Modeling of Cities (road network concepts)
Müller et al. (2006) - CGA shape grammar for buildings
Vanegas et al. (2012) - Lot subdivision algorithms
Gumin (2016) / Alaka & Bidarra (2023) - Wave Function Collapse for complex structures
Historical Accuracy
Based on references like Beresford's "New Towns of the Middle Ages" and Aston & Bond's "The Landscape of Towns", the system generates historically-appropriate:

Village plan types: Nucleated, linear, green, polyfocal
Medieval open field system: Strip fields, common pasture
Burgage plots: Deep narrow lots (5-10m × 30-60m) perpendicular to streets
Period-appropriate building types: Cruck halls, longhouses, tithe barns, parish churches
Regional materials: Flint (chalk areas), timber frame (woodland), cob (grassland)
Development Milestones
The project follows breadth-first visual development:

M1 Markers → M2 Footprints → M2.5 Roamable → M3 Blockout → M4 Silhouettes → ... → M10 Polish

M2.5 (Roamable World) is the key integration milestone - roads + fields + subdivided plots create a navigable world where characters can walk between any settlements.

Be detailed about all the sub systems

Let me explore the subsystems in detail by examining the implementation files.


Read 16 files
Now I have a complete picture. Here's a detailed breakdown of all the subsystems:

Town Generator Subsystems - Detailed Breakdown
1. Core Geometry Subsystem (geom/)
1.1 Point & Polygon (Point.h, Polygon.h)
PointPtr: Uses shared_ptr<Point> for reference semantics matching Haxe - critical for mutations that propagate across cell boundaries
Polygon: Vector of points with utilities like length(), area(), centroid(), edge access via operator[]
1.2 Voronoi Diagram (Voronoi.h)
Delaunay Triangulation: Incrementally builds triangles, each storing circumcircle center/radius
Triangle: Stores 3 points + circumcircle (center c, radius r) for point-in-circle test
Region: Voronoi cell around a seed point; vertices are circumcenters of adjacent Delaunay triangles
Lloyd Relaxation: Voronoi::relax() moves seeds toward region centroids for more uniform cells
Partitioning: partitioning() extracts "real" regions (excludes frame boundary)
1.3 DCEL - Doubly Connected Edge List (DCEL.h)
The topological backbone for all cell operations:

Component	Purpose
Vertex	Wraps PointPtr, tracks outgoing half-edges (weak refs to avoid cycles)
HalfEdge	Directed edge with origin, twin, next, prev, face, and std::any data for edge classification
Face	Polygonal region with one boundary halfEdge, void* data for Cell back-reference
Key Operations:

buildFromPolygons(): Creates DCEL from Cell shapes, links twins for shared edges
circumference(): Finds boundary edges of a face set (for wall/border extraction)
split(): BFS through twins to find connected components
collapseEdge(): Merges vertices for junction optimization
splitEdge(): Inserts midpoint vertex
1.4 Graph with A* Pathfinding (Graph.h)
Node: Has std::map<Node*, double> links for weighted edges
Graph: Owns nodes, provides aStar(start, goal, exclude) for street routing
Used by both Topology (streets) and CanalTopology (rivers)
2. Building Subsystem (building/)
2.1 City - Master Generator (City.h)
The orchestrator that runs the full pipeline:

void City::build() {
    buildPatches();      // 1. Generate Voronoi cells
    optimizeJunctions(); // 2. Collapse short edges
    buildWalls();        // 3. Create curtain walls (city, citadel, border)
    buildDomains();      // 4. Classify horizon/shore edges
    disableCoastWallSegments();
    buildStreets();      // 5. Route streets between gates
    tidyUpRoads();       // 6. Clean up street geometry
    createWards();       // 7. Assign ward types to cells
    buildFarms();        // 8. Create farm wards outside walls
    buildSlums();        // 9. Optional slums outside walls
    buildGeometry();     // 10. Generate buildings
    setEdgeData();       // 11. Classify edges (COAST, ROAD, WALL, CANAL)
    createWardGroups();  // 12. Group adjacent same-type cells
}

Configuration flags:

plazaNeeded, citadelNeeded, wallsNeeded, templeNeeded
slumsNeeded, coastNeeded, riverNeeded
coastDir (0-2, multiplied by π)
Output data:

cells[], inner[] (patches within walls)
citadel, wall, border (CurtainWall pointers)
streets[], roads[], arteries[] (path arrays of PointPtr)
canals[], gates[]
waterEdge, earthEdge, shore (water boundary polygons)
2.2 Cell - Voronoi Patch (Cell.h)
Each cell represents one Voronoi region:

Field	Purpose
shape	Polygon boundary
ward	Assigned Ward type (Castle, Market, Alleys, etc.)
neighbors[]	Adjacent cells sharing an edge
edgeData	Per-edge type map (index → EdgeType)
face	DCEL Face reference
withinWalls, withinCity	Classification flags
waterbody, landing	Water/harbour flags
seed	Random seed for reproducibility
EdgeType enum: NONE, COAST, ROAD, WALL, CANAL

2.3 Topology - Street Pathfinding (Topology.h)
Builds a graph from cell vertices for A* street routing:

pt2node / node2pt: Maps between PointPtr and graph Node* (pointer identity for mutation propagation)
inner[] / outer[]: Nodes inside/outside walls
buildPath(from, to): Returns point sequence for a street
buildPathPtrs(): Returns PointPtr sequence (mutable reference semantics)
2.4 CurtainWall - Defensive Walls (CurtainWall.h)
Generates city/castle walls with gates and towers:

Field	Purpose
shape	Wall perimeter polygon
segments[]	Boolean per-edge: true = wall segment enabled
gates[]	PointPtrs shared with shape vertices
towers[]	Tower positions (not shared)
Constants:

TOWER_RADIUS = 1.9, LTOWER_RADIUS = 2.5 (large towers)
THICKNESS = 1.5
Methods:

buildGates(): Places gates based on topology and reserved points
buildTowers(): Places towers at intervals between gates
getTowerRadius(vertex): Returns exclusion radius for building inset
2.5 Canal - Rivers/Waterways (Canal.h)
Generates river paths through cities:

Field	Purpose
coursePtr[]	Path as PointPtrs (reference semantics)
course[]	Path as Points (compatibility)
width	Canal width (3-6 based on city size)
bridges	Map of bridge locations → street direction
gates[]	Where canal passes through walls
Creation modes:

deltaRiver(): For coastal cities - flows from inland to coast
regularRiver(): For non-coastal - crosses through city
CanalTopology: Separate graph for river pathfinding through non-water cells

2.6 Block - City Block (Block.h)
A single city block within a WardGroup:

class Block {
    Polygon shape;           // Block perimeter
    vector<Polygon> lots;    // Subdivided lots
    vector<Polygon> rects;   // OBB approximations
    vector<Polygon> buildings; // Final building shapes
    vector<Polygon> courtyard; // Inner lots (filtered out)
    
    void createLots();      // Subdivide along frontage
    void createRects();     // LIRA: OBB shrunk 10%
    void createBuildings(); // Generate L-shaped footprints
    vector<Polygon> filterInner(); // Remove non-perimeter lots
    void indentFronts();    // Setback variation
    vector<Point> spawnTrees(); // Courtyard trees
};

2.7 Building - Footprint Generation (Building.h)
Creates L-shaped and complex building footprints:

static Polygon create(
    const Polygon& quad,  // Input lot (4 vertices)
    double minSq,         // Min area per grid cell
    bool hasFront,        // Front-facing plan
    bool symmetric,       // Mirror left-right
    double gap = 0.6      // Grid gap factor
);

Plan types:

getPlan(): Random organic fill (stopProb = 0.5)
getPlanFront(): Buildings always touch front edge
getPlanSym(): Symmetric (mirrored left-right)
Algorithm: Subdivides lot into grid, fills cells based on plan, computes circumference for final polygon

2.8 WardGroup - Unified District (WardGroup.h)
Groups adjacent cells of the same ward type for unified geometry:

Field	Purpose
cells[]	Patches in group
core	First patch (triggers geometry creation)
border	Combined circumference
blocks[]	City blocks
urban	All border vertices are "inner"
alleys	Shared AlleyParams
blockM	Per-vertex block size multiplier (inner=1, outer=9)
triangulation	Cached triangles for barycentric interpolation
Key methods:

buildBorder(): Computes combined circumference of all cells
computeInnerVertices(): Marks vertices where all adjacent cells are withinCity/waterbody
isBlockSized(): Checks if polygon is small enough to stop subdivision
interpolate(): Barycentric interpolation for density filtering
filter(): Removes buildings at low-density fringe areas
3. Ward Types Subsystem (wards/)
All wards inherit from Ward base class with:

patch (Cell*), model (City*)
geometry[] (building polygons)
blocks[] (Block pointers)
church (optional church polygon)
alleys[] (alley cut lines for rendering)
3.1 AlleyParams - Subdivision Parameters
struct AlleyParams {
    double minSq = 15.0;      // Minimum block area
    double gridChaos = 0.5;   // Grid regularity (0=regular, 1=chaotic)
    double sizeChaos = 0.6;   // Building size variation
    double blockSize = 8.0;   // Initial subdivision threshold multiplier
    double emptyProb = 0.04;  // Empty lot probability
    double minFront = 4.0;    // Minimum frontage (sqrt(minSq))
    double shapeFactor = 1.0; // Building shape control
    double inset = 0.3;       // Building edge inset
};

createUrban() uses averaged random values (normal distribution approximation) for organic variation.

3.2 Ward Types
Ward	Purpose	Special Features
Alleys	Standard urban district	Delegates to WardGroup for unified block generation
Castle	Fortified citadel	Own CurtainWall, adjustShape() for circularity, large keep building
Cathedral	Religious district	isSpecialWard()=true, large church building
Market	Central plaza	Open space, possibly with market cross
Farm	Agricultural zone	Sine-wave radial field pattern, sparse buildings
Harbour	Waterfront	Piers extending into water, dock buildings
Park	Green space	Trees, minimal buildings
Wilderness	Undeveloped	Natural, no buildings
4. Utilities Subsystem (utils/)
4.1 Random (Random.h)
Seeded deterministic RNG:

init(seed), floatVal(), intVal(max)
Critical for reproducible generation
4.2 Bisector - Recursive Subdivision (Bisector.h)
Core algorithm for block/lot subdivision:

class Bisector {
    vector<Point> poly;     // Polygon to subdivide
    double minArea;         // Stop threshold
    double variance;        // Size variation factor
    vector<vector<Point>> cuts; // Recorded alley paths
    
    function<double(vector<Point>&)> getGap;      // Gap width callback
    function<vector<Point>(vector<Point>&)> processCut; // Cut processor
    function<bool(vector<Point>&)> isAtomic;      // Stop condition
    
    vector<vector<Point>> partition();  // Main entry point
    vector<vector<Point>> makeCut(poly, attempt); // Single cut
    vector<vector<Point>> split(poly, edge1, edge2, cutLine);
    vector<vector<Point>> applyGap(halves, cutLine); // Street gap
};

Algorithm:

Find OBB (oriented bounding box) of polygon
Choose cut line perpendicular to longest axis
Vary cut position based on variance
Split polygon along cut edges
Apply gap using PolyBool operations
Recurse on each half until isAtomic() or area < minArea
4.3 Noise (Noise.h)
Perlin/fractal noise for natural variation:

Used for coastline generation
Farm field patterns
Building weathering/age
4.4 PolyBool - Boolean Operations (PolyBool.h)
Polygon boolean operations:

and_(), or_(), subtract()
Used for gap application in Bisector
Building cutouts
Available area computation
5. Edge Data & Classification (EdgeData.h)
Each cell edge is classified by type:

enum class EdgeType {
    NONE,   // Default
    COAST,  // Water boundary
    ROAD,   // Street/road
    WALL,   // Curtain wall segment
    CANAL   // River/canal
};

// Inset amounts for building setback
double getEdgeInset(EdgeType type, bool landing, double canalWidth);
// ROAD: MAIN_STREET (4.0) or REGULAR_STREET (2.0)
// WALL: depends on tower radius
// CANAL: depends on canal width
// COAST: landing ? pier offset : 0

6. SVG Export Subsystem (svg/)
SVGWriter outputs the generated city as SVG for debugging/visualization:

Patches with fill colors by ward type
Streets and roads as paths
Walls with towers and gates
Buildings as filled polygons
Canals with bridge markers
7. Generation Pipeline Summary
1. INITIALIZATION
   └── City(nCells, seed) → Random::init(seed)

2. PATCH GENERATION (buildPatches)
   ├── Generate spiral seed points
   ├── Lloyd relaxation (2 iterations)
   ├── Build Voronoi diagram
   ├── Create Cell from each Region
   └── Build DCEL for topology

3. JUNCTION OPTIMIZATION (optimizeJunctions)
   ├── Find edges shorter than threshold
   └── Collapse edges via DCEL::collapseEdge()

4. WALL CONSTRUCTION (buildWalls)
   ├── Identify inner patches (near center)
   ├── Create CurtainWall for city walls
   ├── Create CurtainWall for citadel (if needed)
   ├── Build gates at topology endpoints
   └── Build towers between gates

5. DOMAIN CLASSIFICATION (buildDomains)
   ├── horizonE[] ← outer boundary edges
   ├── shoreE[] ← land-water boundary edges
   └── Disable wall segments along coast

6. STREET GENERATION (buildStreets)
   ├── Build Topology graph from cell vertices
   ├── For each gate pair: buildPath() via A*
   ├── Connect inner streets to outer roads
   └── Store as streets[], roads[], arteries[]

7. CANAL GENERATION (if riverNeeded)
   ├── Build CanalTopology
   ├── deltaRiver() or regularRiver()
   ├── Find bridge locations
   └── Update canal gates

8. WARD ASSIGNMENT (createWards)
   ├── Plaza → Market ward
   ├── Citadel → Castle ward
   ├── Temple → Cathedral ward
   ├── Waterbody → skip
   ├── Harbour → coastal cells
   └── Default → Alleys

9. FARM/SLUM GENERATION
   ├── buildFarms() → sine-wave radial pattern
   └── buildSlums() → outside walls

10. GEOMETRY GENERATION (buildGeometry)
    ├── For each ward: createGeometry()
    └── Ward delegates to WardGroup if Alleys

11. WARD GROUPING (createWardGroups)
    ├── Group adjacent same-type cells
    ├── Build combined border
    ├── Compute inner vertices
    └── Run filter() for density falloff

12. EDGE DATA (setEdgeData)
    └── Classify each edge: COAST, ROAD, WALL, CANAL

This represents a faithful C++ port of the Medieval Fantasy City Generator (MFCG) by Oleg Dolya, with the Voronoi-based patch system, A* street routing, recursive Bisector subdivision, and unified WardGroup geometry generation all working together to produce historically-plausible medieval city layouts.

ok now look at the watershed and biome tools. Describe a complete end-to-end system for generating towns and villages on heightmaps

Let me explore the watershed and biome tools to understand the terrain analysis pipeline.

Task
Find watershed biome tools
Used 29 tools
Let me read the key implementation files to understand the details.


Read 8 files
Now I have a complete picture. Here's the end-to-end system for generating towns and villages on heightmaps:

End-to-End Settlement Generation System
Pipeline Overview
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PREPROCESSING PIPELINE                             │
│                              (preprocess.sh)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
     ┌───────────────────────────────┼───────────────────────────────┐
     ▼                               ▼                               │
┌─────────────┐              ┌─────────────────┐                     │
│   STAGE 1   │              │     STAGE 2     │                     │
│   Terrain   │   parallel   │    Watershed    │                     │
│   Tiles     │◄────────────►│    Analysis     │                     │
└─────────────┘              └─────────────────┘                     │
                                     │                               │
                                     ▼                               │
                             ┌─────────────────┐                     │
                             │     STAGE 3     │                     │
                             │     Biome +     │                     │
                             │   Settlements   │                     │
                             └─────────────────┘                     │
                                     │                               │
                                     ▼                               │
                             ┌─────────────────┐                     │
                             │     STAGE 4     │                     │
                             │      Roads      │                     │
                             └─────────────────┘                     │
                                     │                               │
                                     ▼                               ▼
                             ┌─────────────────┐              ┌─────────────┐
                             │     STAGE 5     │              │   Runtime   │
                             │   Vegetation    │─────────────►│   Loaders   │
                             └─────────────────┘              └─────────────┘
                                     │
                                     ▼
                             ┌─────────────────┐
                             │     STAGE 6     │
                             │ Town Generator  │ (per-settlement)
                             └─────────────────┘

Stage 1: Terrain Preprocessing (terrain_preprocess)
Input: 16-bit PNG heightmap (e.g., isleofwight-0m-200m.png)

Process:

Generates CBT (Clipmap Binary Tree) tile cache
Multi-LOD levels (default 6)
Configurable tile resolution (default 128px)
Output:

terrain_tiles/ directory with LOD pyramid
terrain.meta for cache validation
Stage 2: Watershed Analysis (watershed)
Input: Same heightmap

Process:

2.1 D8 Flow Direction
// D8 encoding: 8 neighbors + pit/flat
// 7 0 1
// 6 X 2
// 5 4 3
// Value 8 = no flow (pit or flat)

D8Result compute_d8(const ElevationGrid& elevation);

Each cell points to its steepest downhill neighbor.

2.2 DAFA Resolution (Depressions and Flat Areas)
D8Result resolve_dafa_by_merging(
    const ElevationGrid& elevation,
    D8Result d8,
    uint16_t sea_level
);

Resolves pits and flats by watershed merging (preserves original DEM, unlike pit-filling).

2.3 Flow Accumulation
Counts upstream cells draining through each cell. High values = rivers.

2.4 Watershed Delineation
WatershedResult delineate_watersheds(const D8Result& d8);
WatershedResult merge_watersheds(..., uint32_t min_area);

Labels each cell with its drainage basin ID.

2.5 River Tracing
std::vector<uint32_t> trace_rivers_from_sea(
    const ElevationGrid& elevation,
    const D8Result& d8,
    uint32_t min_accumulation,
    uint16_t sea_level
);

Traces rivers upstream from sea outlets.

Output:

File	Format	Content
flow_direction.png	8-bit PNG	D8 directions (0-7, 8=no flow)
flow_accumulation.exr	OpenEXR float	Upstream cell count
watershed_labels.png	RGBA PNG	uint32 basin IDs encoded as RGBA
rivers.geojson	GeoJSON	River LineStrings with flow/width
lakes.geojson	GeoJSON	Lake polygons
Stage 3: Biome Classification & Settlement Placement (biome_preprocess)
Input: Heightmap + watershed outputs

3.1 Derived Metrics
Slope Map
void computeSlopeMap(ProgressCallback callback);
// Gradient magnitude from finite differences

Distance Fields
void computeDistanceToSea(ProgressCallback callback);   // BFS from sea cells
void computeDistanceToRiver(ProgressCallback callback); // BFS from river cells

Watershed Metrics (WatershedMetrics.h)
struct WatershedMetricsResult {
    std::vector<float> twiMap;           // Topographic Wetness Index
    std::vector<uint8_t> streamOrderMap; // Strahler stream order
    std::vector<uint32_t> basinLabels;   // Watershed basin ID
    uint32_t basinCount;
};

TWI (Topographic Wetness Index):

TWI = ln(a / tan(β))
  where a = upstream area per unit contour width
        β = local slope

High TWI → wetland-prone areas.

Strahler Stream Order:

Order 1 = headwater streams
When two order-n streams meet → order n+1
Higher order = larger rivers
3.2 Zone Classification
enum class BiomeZone : uint8_t {
    Sea = 0,          // Below sea level
    Beach = 1,        // height < 3m, slope < 0.1, coastal
    ChalkCliff = 2,   // slope > 0.7, coastal
    SaltMarsh = 3,    // height < 8m, slope < 0.15, coastal
    River = 4,        // flowAccumulation > threshold
    Wetland = 5,      // TWI > 8.0
    Grassland = 6,    // height > 50m, slope < 0.3 (chalk downs)
    Agricultural = 7, // 10m < height < 80m, slope < 0.2
    Woodland = 8      // default remaining land
};

Classification thresholds (from BiomeConfig):

float cliffSlopeThreshold = 0.7f;
float beachMaxHeight = 3.0f;
float marshMaxHeight = 8.0f;
float grasslandMinHeight = 50.0f;
float twiWetlandThreshold = 8.0f;
float twiWetMeadowThreshold = 6.0f;
float twiDryThreshold = 4.0f;

3.3 Sub-Zone Variation
Each major zone has 4 sub-zones for visual variety:

Zone	Sub-zones
Grassland	OpenDown, WildflowerMeadow, GorsePatch, ChalkScrape
Woodland	BeechFloor, OakUnderstorey, Clearing, Coppice
Agricultural	Ploughed, Pasture, CropField, Fallow
SaltMarsh	Mudflat, Saltpan, Cordgrass, Creek
Assigned via:

Perlin noise for spatial coherence
Basin ID for per-watershed variation (basinVariationStrength = 0.3)
3.4 Settlement Placement
struct Settlement {
    uint32_t id;
    SettlementType type;    // Hamlet, Village, Town, FishingVillage
    glm::vec2 position;     // World coordinates
    float radius;           // Area radius in meters
    float score;
    std::vector<std::string> features;
};

Settlement Types:

Type	Radius	Min Distance	Notes
Hamlet	50m	400m	3-8 buildings
Village	100m	800m	15-40 buildings
Town	200m	2000m	80-200+ buildings
FishingVillage	80m	-	Coastal, 8-25 buildings
Scoring Function:

float calculateSettlementScore(float x, float z) const {
    float score = 0.0f;
    
    // Prefer flat terrain
    float slope = sampleSlope(x, z);
    score += (1.0f - slope) * 30.0f;
    
    // Prefer near (but not in) water
    float riverDist = sampleDistanceToRiver(x, z);
    if (riverDist > 50.0f && riverDist < 500.0f)
        score += 20.0f * (1.0f - riverDist / 500.0f);
    
    // Prefer moderate elevation
    float height = sampleHeight(x, z);
    if (height > 10.0f && height < 80.0f)
        score += 15.0f;
    
    // Coastal bonus for fishing villages
    float seaDist = sampleDistanceToSea(x, z);
    if (seaDist < 200.0f)
        score += 25.0f * (1.0f - seaDist / 200.0f);
    
    // Flow accumulation (trade routes follow rivers)
    float flow = sampleFlowAccumulation(x, z);
    score += std::min(flow * 10.0f, 20.0f);
    
    return score;
}

Validation:

bool isValidSettlementLocation(float x, float z, const std::vector<Settlement>& existing) const {
    // Not in water
    BiomeZone zone = sampleZone(x, z);
    if (zone == BiomeZone::Sea || zone == BiomeZone::River)
        return false;
    
    // Not on steep slopes
    if (sampleSlope(x, z) > 0.3f)
        return false;
    
    // Not too close to existing settlements
    for (const auto& s : existing) {
        float dist = glm::distance(position, s.position);
        float minDist = getMinDistance(candidateType, s.type);
        if (dist < minDist) return false;
    }
    
    return true;
}

Output:

File	Content
biome_map.png	Zone + sub-zone per pixel
settlements.json	Settlement positions, types, radii
settlements.svg	Visualization
biome_debug.png	Color-coded zone visualization
Stage 4: Road Network Generation (road_generator)
Input: Heightmap, biome map, settlements.json

4.1 Network Topology: Space Colonization
// Runions et al. algorithm for organic branching
1. Initialize with towns as root nodes
2. All other settlements are "attraction points"
3. Grow branches toward nearest attractors
4. When branch reaches attractor, it becomes growth node
5. Continue until all settlements connected

Creates hierarchical structure:

MainRoad (8m): Town ↔ Town
Road (6m): Town ↔ Village
Lane (4m): Village ↔ Village
Bridleway (3m): Village ↔ Hamlet
Footpath (1.5m): Hamlet ↔ Hamlet
4.2 Route Finding: A* Pathfinding
// Cost factors in RoadPathfinder
float slopeCostMultiplier;  // Penalize steep terrain
float waterPenalty;         // River/wetland crossing cost
float cliffPenalty;         // Avoid cliffs entirely

Enhancements:

Valley preference (follow contours)
Existing road sharing (prefer established routes)
Bridge/ford detection at river crossings
4.3 Bridge/Ford Detection
At water crossings:

Classify by stream order (from watershed data)
Road type determines structure:
MainRoad + Order 3+ → Stone bridge
Lane + Order 2 → Wooden bridge
Footpath + Order 1 → Ford
Check bank slope (fords need gentle banks)
Output:

File	Content
roads.geojson	Road LineStrings with type/width
roads.svg	Catmull-Rom spline visualization
roads_debug.png	Raster debug view
network.svg	Topology graph (with --use-colonization)
Stage 5: Vegetation Placement (vegetation_generator)
Input: Heightmap, biome map

Process:

Poisson disk sampling (Bridson's algorithm)
Biome-aware density:
Woodland: high tree density
Grassland: scattered gorse, shrubs
Agricultural: field boundaries only
Multi-layer: trees, bushes, rocks, detritus
Tile-based for streaming
Output: Vegetation tiles with per-biome statistics

Stage 6: Town Generation (town_generator)
Input: Settlement from settlements.json, terrain data

This is where MFCG-based generation creates the actual settlement layout.

6.1 Settlement Sizing
// Map settlement type to MFCG patch count
SettlementType → nPatches:
  Hamlet         → 6-8 patches
  Village        → 12-20 patches
  Town           → 25-45 patches
  FishingVillage → 10-15 patches

6.2 Blueprint Configuration
Blueprint blueprint(nPatches, settlement.id);  // Seed from settlement ID

// Configure based on settlement type and features
blueprint.walls = (type == Town);
blueprint.citadel = hasFeature("castle");
blueprint.plaza = (type == Town || type == Village);
blueprint.temple = hasFeature("church");
blueprint.coast = (type == FishingVillage);
blueprint.river = nearRiver(position);

6.3 City Generation
City city(blueprint);
city.build();  // Full MFCG pipeline

// Extract geometry
for (Cell* cell : city.cells) {
    Ward* ward = cell->ward;
    for (const Polygon& building : ward->geometry) {
        // Transform to world coordinates
        Polygon worldBuilding = transformToWorld(building, settlement.position, settlement.radius);
        output.buildings.push_back(worldBuilding);
    }
}

6.4 Terrain Integration
// For each building footprint:
1. Sample terrain height at footprint center
2. Find minimum corner height (for foundation)
3. Level building platform (cut/fill)
4. Adjust for slope (stepped foundations if needed)

// For streets:
1. Sample height along street centerline
2. Smooth to maximum grade (5% for carts)
3. Cut into hillside if needed

6.5 Entry Point Extraction
// Find where settlement streets meet edge
for (const auto& street : city.streets) {
    if (touchesSettlementBoundary(street, settlement.radius)) {
        glm::vec2 entryPoint = findBoundaryIntersection(street, settlement.radius);
        float direction = getOutwardDirection(entryPoint, settlement.position);
        output.entryPoints.push_back({entryPoint, direction});
    }
}

These entry points connect to the regional road network.

Runtime Integration
Loaders (src/terrain/)
ErosionDataLoader:

bool loadFromCache(const std::string& cacheDir);
// Loads rivers.geojson, lakes.geojson, flow maps
// Cache validation via file size and metadata

RoadNetworkLoader:

bool loadFromGeoJson(const std::string& path);
// Returns RoadNetwork with RoadSpline array

Rendering Integration
Terrain System: Uses biome map for texture splatting
Water System: Rivers/lakes from GeoJSON with flow direction
Road System: Renders road splines with width from RoadType
Settlement System: Renders building meshes at settlement positions
Vegetation System: Streams vegetation tiles, excludes settlement areas
Data Flow Summary
heightmap.png (16-bit)
       │
       ├──────────────────────┐
       ▼                      ▼
┌─────────────┐        ┌─────────────┐
│  Terrain    │        │  Watershed  │
│  Tiles      │        │  Analysis   │
└─────────────┘        └─────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │   Biome +   │
                       │ Settlements │
                       └─────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
       │    Roads    │ │ Vegetation  │ │    Town     │
       │   Network   │ │  Placement  │ │  Generator  │
       └─────────────┘ └─────────────┘ └─────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                       ┌─────────────┐
                       │   Runtime   │
                       │   Render    │
                       └─────────────┘

Complete File Outputs
Stage	Files	Format	Purpose
Terrain	terrain_tiles/	CBT	LOD terrain mesh
Watershed	flow_direction.png	PNG 8-bit	D8 directions
flow_accumulation.exr	OpenEXR	Upstream area
watershed_labels.png	RGBA PNG	Basin IDs
rivers.geojson	GeoJSON	River paths
lakes.geojson	GeoJSON	Lake polygons
Biome	biome_map.png	PNG	Zone classification
settlements.json	JSON	Settlement data
Roads	roads.geojson	GeoJSON	Road network
Vegetation	vegetation/	Tiles	Tree/bush positions
Town	town_*.json	JSON	Building footprints
This system creates a complete, geographically-coherent world where settlements emerge at sensible locations based on terrain analysis, roads connect them following natural valleys, and each settlement has an internally-consistent medieval layout generated by the MFCG algorithm.

ok describe how you might design this as a typescript react tool in browser that can work on generating cities then tweak on the way. i feel like a node based approach might make sense to control

This is a great idea. A node-based visual editor would let you see the pipeline, tweak parameters at each stage, and iterate quickly. Here's how I'd design it:

Browser-Based City Generator Design
Architecture Overview
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER APPLICATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────────────┐    ┌───────────────────────┐  │
│  │   Node       │    │      Preview         │    │     Properties        │  │
│  │   Graph      │◄──►│      Canvas          │◄──►│     Panel             │  │
│  │   Editor     │    │   (2D/3D view)       │    │  (selected node)      │  │
│  └──────────────┘    └──────────────────────┘    └───────────────────────┘  │
│         │                     │                            │                 │
│         └─────────────────────┼────────────────────────────┘                 │
│                               ▼                                              │
│                    ┌──────────────────────┐                                  │
│                    │    Execution Engine   │                                  │
│                    │    (Web Workers)      │                                  │
│                    └──────────────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Core Data Types
// ═══════════════════════════════════════════════════════════════════════════
// GRAPH TYPES
// ═══════════════════════════════════════════════════════════════════════════

type DataType = 
  | 'heightmap'      // Float32Array grid
  | 'flowField'      // D8 directions + accumulation
  | 'biomeMap'       // Zone classification grid
  | 'settlements'    // Settlement[] array
  | 'roadNetwork'    // Road splines
  | 'cityLayout'     // MFCG City output
  | 'geometry'       // Building polygons
  | 'number'
  | 'vec2'
  | 'polygon'
  | 'seed';

interface Port {
  id: string;
  name: string;
  dataType: DataType;
  direction: 'input' | 'output';
  required: boolean;
  default?: unknown;
}

interface NodeDefinition {
  type: string;
  category: 'terrain' | 'watershed' | 'biome' | 'settlement' | 'roads' | 'city' | 'output';
  name: string;
  description: string;
  inputs: Port[];
  outputs: Port[];
  parameters: ParameterDefinition[];
  
  // Execution
  execute: (inputs: Record<string, unknown>, params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  
  // Preview generation (lightweight for real-time feedback)
  preview?: (inputs: Record<string, unknown>, params: Record<string, unknown>) => PreviewData;
}

interface NodeInstance {
  id: string;
  type: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
  
  // Execution state
  state: 'idle' | 'stale' | 'running' | 'complete' | 'error';
  outputs: Record<string, unknown> | null;
  error?: string;
  executionTime?: number;
}

interface Connection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

interface Graph {
  nodes: NodeInstance[];
  connections: Connection[];
  viewport: { x: number; y: number; zoom: number };
}

Node Categories & Types
1. Terrain Nodes
// ═══════════════════════════════════════════════════════════════════════════
// TERRAIN INPUT NODES
// ═══════════════════════════════════════════════════════════════════════════

const HeightmapInputNode: NodeDefinition = {
  type: 'heightmap-input',
  category: 'terrain',
  name: 'Heightmap Input',
  description: 'Load or generate a heightmap',
  inputs: [],
  outputs: [
    { id: 'heightmap', name: 'Heightmap', dataType: 'heightmap', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'source', type: 'enum', options: ['file', 'noise', 'url'], default: 'noise' },
    { id: 'width', type: 'number', min: 64, max: 4096, default: 512 },
    { id: 'height', type: 'number', min: 64, max: 4096, default: 512 },
    { id: 'seed', type: 'number', default: 12345 },
    // Noise parameters (when source === 'noise')
    { id: 'octaves', type: 'number', min: 1, max: 8, default: 6 },
    { id: 'persistence', type: 'number', min: 0, max: 1, default: 0.5 },
    { id: 'lacunarity', type: 'number', min: 1, max: 4, default: 2.0 },
    { id: 'scale', type: 'number', min: 0.001, max: 0.1, default: 0.01 },
  ],
  execute: async (inputs, params) => {
    // Generate or load heightmap
  },
  preview: (inputs, params) => ({
    type: 'image',
    data: generateHeightmapPreview(params)
  })
};

const TerrainModifierNode: NodeDefinition = {
  type: 'terrain-modifier',
  category: 'terrain',
  name: 'Terrain Modifier',
  description: 'Apply modifications to heightmap',
  inputs: [
    { id: 'heightmap', name: 'Heightmap', dataType: 'heightmap', direction: 'input', required: true }
  ],
  outputs: [
    { id: 'heightmap', name: 'Heightmap', dataType: 'heightmap', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'operation', type: 'enum', options: ['erode', 'smooth', 'terrace', 'add-coast'], default: 'smooth' },
    { id: 'strength', type: 'number', min: 0, max: 1, default: 0.5 },
    { id: 'iterations', type: 'number', min: 1, max: 100, default: 10 },
  ],
  execute: async (inputs, params) => {
    // Apply terrain modification
  }
};

2. Watershed Nodes
// ═══════════════════════════════════════════════════════════════════════════
// WATERSHED ANALYSIS NODES
// ═══════════════════════════════════════════════════════════════════════════

const FlowDirectionNode: NodeDefinition = {
  type: 'flow-direction',
  category: 'watershed',
  name: 'D8 Flow Direction',
  description: 'Compute flow directions using D8 algorithm',
  inputs: [
    { id: 'heightmap', name: 'Heightmap', dataType: 'heightmap', direction: 'input', required: true }
  ],
  outputs: [
    { id: 'flowField', name: 'Flow Field', dataType: 'flowField', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'seaLevel', type: 'number', min: 0, max: 100, default: 0 },
    { id: 'resolveDafa', type: 'boolean', default: true },
  ],
  execute: async (inputs, params) => {
    const { heightmap } = inputs as { heightmap: Float32Array };
    // Run D8 algorithm (in Web Worker)
    return { flowField: await computeD8(heightmap, params) };
  },
  preview: (inputs, params) => ({
    type: 'flow-arrows',
    data: inputs.flowField
  })
};

const FlowAccumulationNode: NodeDefinition = {
  type: 'flow-accumulation',
  category: 'watershed',
  name: 'Flow Accumulation',
  description: 'Compute upstream drainage area',
  inputs: [
    { id: 'flowField', name: 'Flow Field', dataType: 'flowField', direction: 'input', required: true }
  ],
  outputs: [
    { id: 'flowField', name: 'Flow Field', dataType: 'flowField', direction: 'output', required: true }
  ],
  parameters: [],
  execute: async (inputs, params) => {
    // Accumulate flow
  }
};

const RiverExtractionNode: NodeDefinition = {
  type: 'river-extraction',
  category: 'watershed',
  name: 'Extract Rivers',
  description: 'Trace river network from flow accumulation',
  inputs: [
    { id: 'flowField', name: 'Flow Field', dataType: 'flowField', direction: 'input', required: true },
    { id: 'heightmap', name: 'Heightmap', dataType: 'heightmap', direction: 'input', required: true }
  ],
  outputs: [
    { id: 'rivers', name: 'Rivers', dataType: 'geometry', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'minAccumulation', type: 'number', min: 100, max: 10000, default: 1000 },
    { id: 'smoothing', type: 'number', min: 0, max: 1, default: 0.5 },
  ],
  execute: async (inputs, params) => {
    // Extract river polylines
  },
  preview: (inputs, params) => ({
    type: 'polylines',
    data: inputs.rivers,
    style: { stroke: '#4a90d9', strokeWidth: 2 }
  })
};

const WatershedBasinsNode: NodeDefinition = {
  type: 'watershed-basins',
  category: 'watershed',
  name: 'Watershed Basins',
  description: 'Delineate drainage basins',
  inputs: [
    { id: 'flowField', name: 'Flow Field', dataType: 'flowField', direction: 'input', required: true }
  ],
  outputs: [
    { id: 'basins', name: 'Basin Labels', dataType: 'biomeMap', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'minBasinArea', type: 'number', min: 100, max: 10000, default: 500 },
    { id: 'mergeSmall', type: 'boolean', default: true },
  ],
  execute: async (inputs, params) => {
    // Delineate and optionally merge basins
  }
};

3. Biome Nodes
// ═══════════════════════════════════════════════════════════════════════════
// BIOME CLASSIFICATION NODES
// ═══════════════════════════════════════════════════════════════════════════

const BiomeClassifierNode: NodeDefinition = {
  type: 'biome-classifier',
  category: 'biome',
  name: 'Biome Classifier',
  description: 'Classify terrain into biome zones',
  inputs: [
    { id: 'heightmap', name: 'Heightmap', dataType: 'heightmap', direction: 'input', required: true },
    { id: 'flowField', name: 'Flow Field', dataType: 'flowField', direction: 'input', required: false },
  ],
  outputs: [
    { id: 'biomeMap', name: 'Biome Map', dataType: 'biomeMap', direction: 'output', required: true }
  ],
  parameters: [
    // Zone thresholds
    { id: 'seaLevel', type: 'number', min: 0, max: 50, default: 0 },
    { id: 'beachMaxHeight', type: 'number', min: 1, max: 10, default: 3 },
    { id: 'cliffSlopeThreshold', type: 'number', min: 0.3, max: 0.9, default: 0.7 },
    { id: 'marshMaxHeight', type: 'number', min: 3, max: 20, default: 8 },
    { id: 'grasslandMinHeight', type: 'number', min: 20, max: 100, default: 50 },
    { id: 'twiWetlandThreshold', type: 'number', min: 5, max: 12, default: 8 },
  ],
  execute: async (inputs, params) => {
    // Classify zones
  },
  preview: (inputs, params) => ({
    type: 'image',
    data: renderBiomeMap(inputs.biomeMap),
    legend: BIOME_COLORS
  })
};

4. Settlement Nodes
// ═══════════════════════════════════════════════════════════════════════════
// SETTLEMENT PLACEMENT NODES
// ═══════════════════════════════════════════════════════════════════════════

const SettlementPlacerNode: NodeDefinition = {
  type: 'settlement-placer',
  category: 'settlement',
  name: 'Place Settlements',
  description: 'Automatically place settlements based on terrain suitability',
  inputs: [
    { id: 'heightmap', name: 'Heightmap', dataType: 'heightmap', direction: 'input', required: true },
    { id: 'biomeMap', name: 'Biome Map', dataType: 'biomeMap', direction: 'input', required: false },
    { id: 'flowField', name: 'Flow Field', dataType: 'flowField', direction: 'input', required: false },
  ],
  outputs: [
    { id: 'settlements', name: 'Settlements', dataType: 'settlements', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'numSettlements', type: 'number', min: 1, max: 50, default: 15 },
    { id: 'townRatio', type: 'number', min: 0, max: 0.3, default: 0.1 },
    { id: 'villageRatio', type: 'number', min: 0, max: 0.5, default: 0.3 },
    { id: 'hamletMinDistance', type: 'number', min: 100, max: 1000, default: 400 },
    { id: 'villageMinDistance', type: 'number', min: 200, max: 2000, default: 800 },
    { id: 'townMinDistance', type: 'number', min: 500, max: 5000, default: 2000 },
    { id: 'preferRivers', type: 'boolean', default: true },
    { id: 'preferCoast', type: 'boolean', default: true },
  ],
  execute: async (inputs, params) => {
    // Score terrain and place settlements
  },
  preview: (inputs, params) => ({
    type: 'markers',
    data: inputs.settlements,
    iconMap: SETTLEMENT_ICONS
  })
};

const ManualSettlementNode: NodeDefinition = {
  type: 'manual-settlement',
  category: 'settlement',
  name: 'Manual Settlement',
  description: 'Place a single settlement manually',
  inputs: [],
  outputs: [
    { id: 'settlement', name: 'Settlement', dataType: 'settlements', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'position', type: 'vec2', default: { x: 256, y: 256 } },
    { id: 'type', type: 'enum', options: ['hamlet', 'village', 'town', 'fishingVillage'], default: 'village' },
    { id: 'name', type: 'string', default: 'New Settlement' },
    { id: 'seed', type: 'number', default: 12345 },
  ],
  execute: async (inputs, params) => {
    return { settlement: [createSettlement(params)] };
  }
};

const MergeSettlementsNode: NodeDefinition = {
  type: 'merge-settlements',
  category: 'settlement',
  name: 'Merge Settlements',
  description: 'Combine multiple settlement sources',
  inputs: [
    { id: 'settlements1', name: 'Settlements A', dataType: 'settlements', direction: 'input', required: true },
    { id: 'settlements2', name: 'Settlements B', dataType: 'settlements', direction: 'input', required: false },
    { id: 'settlements3', name: 'Settlements C', dataType: 'settlements', direction: 'input', required: false },
  ],
  outputs: [
    { id: 'settlements', name: 'Settlements', dataType: 'settlements', direction: 'output', required: true }
  ],
  parameters: [],
  execute: async (inputs, params) => {
    return { settlements: [...inputs.settlements1, ...inputs.settlements2 || [], ...inputs.settlements3 || []] };
  }
};

5. Road Network Nodes
// ═══════════════════════════════════════════════════════════════════════════
// ROAD NETWORK NODES
// ═══════════════════════════════════════════════════════════════════════════

const RoadTopologyNode: NodeDefinition = {
  type: 'road-topology',
  category: 'roads',
  name: 'Road Topology',
  description: 'Generate road network topology using space colonization',
  inputs: [
    { id: 'settlements', name: 'Settlements', dataType: 'settlements', direction: 'input', required: true }
  ],
  outputs: [
    { id: 'topology', name: 'Network Topology', dataType: 'roadNetwork', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'algorithm', type: 'enum', options: ['space-colonization', 'delaunay', 'mst'], default: 'space-colonization' },
    { id: 'branchAngle', type: 'number', min: 15, max: 90, default: 45 },
    { id: 'killDistance', type: 'number', min: 10, max: 200, default: 50 },
  ],
  execute: async (inputs, params) => {
    // Generate network topology
  }
};

const RoadRoutingNode: NodeDefinition = {
  type: 'road-routing',
  category: 'roads',
  name: 'Road Routing',
  description: 'Find terrain-aware routes using A* pathfinding',
  inputs: [
    { id: 'topology', name: 'Network Topology', dataType: 'roadNetwork', direction: 'input', required: true },
    { id: 'heightmap', name: 'Heightmap', dataType: 'heightmap', direction: 'input', required: true },
    { id: 'biomeMap', name: 'Biome Map', dataType: 'biomeMap', direction: 'input', required: false },
  ],
  outputs: [
    { id: 'roads', name: 'Road Network', dataType: 'roadNetwork', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'slopePenalty', type: 'number', min: 1, max: 20, default: 5 },
    { id: 'waterPenalty', type: 'number', min: 10, max: 1000, default: 100 },
    { id: 'preferValleys', type: 'boolean', default: true },
    { id: 'smoothing', type: 'number', min: 0, max: 1, default: 0.5 },
  ],
  execute: async (inputs, params) => {
    // A* routing for each edge in topology
  }
};

6. City Generation Nodes (MFCG)
// ═══════════════════════════════════════════════════════════════════════════
// CITY GENERATION NODES (MFCG-BASED)
// ═══════════════════════════════════════════════════════════════════════════

const CityBlueprintNode: NodeDefinition = {
  type: 'city-blueprint',
  category: 'city',
  name: 'City Blueprint',
  description: 'Configure city generation parameters',
  inputs: [
    { id: 'settlement', name: 'Settlement', dataType: 'settlements', direction: 'input', required: false },
  ],
  outputs: [
    { id: 'blueprint', name: 'Blueprint', dataType: 'cityLayout', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'seed', type: 'number', default: 12345 },
    { id: 'size', type: 'number', min: 6, max: 60, default: 20, description: 'Number of Voronoi patches' },
    { id: 'walls', type: 'boolean', default: true },
    { id: 'citadel', type: 'boolean', default: true },
    { id: 'plaza', type: 'boolean', default: true },
    { id: 'temple', type: 'boolean', default: true },
    { id: 'river', type: 'boolean', default: false },
    { id: 'coast', type: 'boolean', default: false },
    { id: 'coastDirection', type: 'number', min: 0, max: 360, default: 180 },
  ],
  execute: async (inputs, params) => {
    return { blueprint: new Blueprint(params.size, params.seed, params) };
  }
};

const CityGeneratorNode: NodeDefinition = {
  type: 'city-generator',
  category: 'city',
  name: 'Generate City',
  description: 'Run MFCG algorithm to generate city layout',
  inputs: [
    { id: 'blueprint', name: 'Blueprint', dataType: 'cityLayout', direction: 'input', required: true }
  ],
  outputs: [
    { id: 'city', name: 'City', dataType: 'cityLayout', direction: 'output', required: true }
  ],
  parameters: [],
  execute: async (inputs, params) => {
    const city = new City(inputs.blueprint);
    city.build();
    return { city };
  },
  preview: (inputs, params) => ({
    type: 'city-layout',
    data: inputs.city
  })
};

const WardOverrideNode: NodeDefinition = {
  type: 'ward-override',
  category: 'city',
  name: 'Ward Override',
  description: 'Override ward types for specific patches',
  inputs: [
    { id: 'city', name: 'City', dataType: 'cityLayout', direction: 'input', required: true }
  ],
  outputs: [
    { id: 'city', name: 'City', dataType: 'cityLayout', direction: 'output', required: true }
  ],
  parameters: [
    { id: 'patchIndex', type: 'number', min: 0, max: 100, default: 0 },
    { id: 'wardType', type: 'enum', options: ['alleys', 'castle', 'cathedral', 'market', 'farm', 'harbour', 'park', 'wilderness'], default: 'alleys' },
  ],
  execute: async (inputs, params) => {
    const city = inputs.city.clone();
    city.cells[params.patchIndex].setWard(params.wardType);
    city.rebuildGeometry();
    return { city };
  }
};

const BuildingExtractorNode: NodeDefinition = {
  type: 'building-extractor',
  category: 'city',
  name: 'Extract Buildings',
  description: 'Extract building footprints from city layout',
  inputs: [
    { id: 'city', name: 'City', dataType: 'cityLayout', direction: 'input', required: true }
  ],
  outputs: [
    { id: 'buildings', name: 'Buildings', dataType: 'geometry', direction: 'output', required: true },
    { id: 'streets', name: 'Streets', dataType: 'geometry', direction: 'output', required: true },
    { id: 'walls', name: 'Walls', dataType: 'geometry', direction: 'output', required: true },
  ],
  parameters: [
    { id: 'includeChurches', type: 'boolean', default: true },
    { id: 'includeTowers', type: 'boolean', default: true },
  ],
  execute: async (inputs, params) => {
    const city = inputs.city;
    return {
      buildings: extractBuildings(city),
      streets: extractStreets(city),
      walls: extractWalls(city),
    };
  }
};

7. Output Nodes
// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT & EXPORT NODES
// ═══════════════════════════════════════════════════════════════════════════

const SVGExportNode: NodeDefinition = {
  type: 'svg-export',
  category: 'output',
  name: 'SVG Export',
  description: 'Export to SVG format',
  inputs: [
    { id: 'geometry', name: 'Geometry', dataType: 'geometry', direction: 'input', required: true }
  ],
  outputs: [],
  parameters: [
    { id: 'width', type: 'number', min: 100, max: 4096, default: 1024 },
    { id: 'height', type: 'number', min: 100, max: 4096, default: 1024 },
    { id: 'strokeWidth', type: 'number', min: 0.1, max: 5, default: 1 },
    { id: 'fillBuildings', type: 'boolean', default: true },
  ],
  execute: async (inputs, params) => {
    const svg = renderToSVG(inputs.geometry, params);
    downloadFile(svg, 'city.svg', 'image/svg+xml');
    return {};
  }
};

const GeoJSONExportNode: NodeDefinition = {
  type: 'geojson-export',
  category: 'output',
  name: 'GeoJSON Export',
  description: 'Export to GeoJSON format',
  inputs: [
    { id: 'geometry', name: 'Geometry', dataType: 'geometry', direction: 'input', required: true }
  ],
  outputs: [],
  parameters: [
    { id: 'coordinateSystem', type: 'enum', options: ['local', 'wgs84'], default: 'local' },
    { id: 'origin', type: 'vec2', default: { x: 0, y: 0 } },
  ],
  execute: async (inputs, params) => {
    const geojson = convertToGeoJSON(inputs.geometry, params);
    downloadFile(JSON.stringify(geojson, null, 2), 'city.geojson', 'application/json');
    return {};
  }
};

const ThreeJSExportNode: NodeDefinition = {
  type: 'threejs-export',
  category: 'output',
  name: '3D Export',
  description: 'Export to 3D format (GLTF)',
  inputs: [
    { id: 'buildings', name: 'Buildings', dataType: 'geometry', direction: 'input', required: true },
    { id: 'heightmap', name: 'Heightmap', dataType: 'heightmap', direction: 'input', required: false },
  ],
  outputs: [],
  parameters: [
    { id: 'buildingHeight', type: 'number', min: 3, max: 20, default: 6 },
    { id: 'roofStyle', type: 'enum', options: ['flat', 'pitched', 'hipped'], default: 'pitched' },
    { id: 'embedTerrain', type: 'boolean', default: true },
  ],
  execute: async (inputs, params) => {
    const gltf = await exportToGLTF(inputs.buildings, inputs.heightmap, params);
    downloadFile(gltf, 'city.gltf', 'model/gltf+json');
    return {};
  }
};

Execution Engine
// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

interface ExecutionContext {
  graph: Graph;
  cache: Map<string, { hash: string; outputs: Record<string, unknown> }>;
  workers: Worker[];
  onNodeStateChange: (nodeId: string, state: NodeInstance['state']) => void;
  onProgress: (nodeId: string, progress: number, message: string) => void;
}

class ExecutionEngine {
  private context: ExecutionContext;
  private executionOrder: string[] = [];
  
  constructor(graph: Graph) {
    this.context = {
      graph,
      cache: new Map(),
      workers: this.createWorkerPool(navigator.hardwareConcurrency || 4),
      onNodeStateChange: () => {},
      onProgress: () => {},
    };
  }
  
  // Topological sort for execution order
  private computeExecutionOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    
    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      // Visit all upstream nodes first
      const upstreamConnections = this.context.graph.connections
        .filter(c => c.targetNodeId === nodeId);
      
      for (const conn of upstreamConnections) {
        visit(conn.sourceNodeId);
      }
      
      order.push(nodeId);
    };
    
    for (const node of this.context.graph.nodes) {
      visit(node.id);
    }
    
    return order;
  }
  
  // Compute hash of inputs + parameters for caching
  private computeNodeHash(node: NodeInstance): string {
    const inputs = this.gatherInputs(node);
    return hashObject({ inputs, parameters: node.parameters });
  }
  
  // Gather input values from upstream nodes
  private gatherInputs(node: NodeInstance): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const incomingConnections = this.context.graph.connections
      .filter(c => c.targetNodeId === node.id);
    
    for (const conn of incomingConnections) {
      const sourceNode = this.context.graph.nodes.find(n => n.id === conn.sourceNodeId);
      if (sourceNode?.outputs) {
        inputs[conn.targetPortId] = sourceNode.outputs[conn.sourcePortId];
      }
    }
    
    return inputs;
  }
  
  // Execute entire graph
  async executeGraph(): Promise<void> {
    this.executionOrder = this.computeExecutionOrder();
    
    for (const nodeId of this.executionOrder) {
      await this.executeNode(nodeId);
    }
  }
  
  // Execute single node (with caching)
  async executeNode(nodeId: string): Promise<void> {
    const node = this.context.graph.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const definition = NODE_REGISTRY[node.type];
    if (!definition) return;
    
    // Check cache
    const hash = this.computeNodeHash(node);
    const cached = this.context.cache.get(nodeId);
    
    if (cached && cached.hash === hash) {
      node.outputs = cached.outputs;
      node.state = 'complete';
      return;
    }
    
    // Execute
    node.state = 'running';
    this.context.onNodeStateChange(nodeId, 'running');
    
    try {
      const inputs = this.gatherInputs(node);
      const startTime = performance.now();
      
      // Run in Web Worker for heavy computations
      const outputs = await this.runInWorker(definition, inputs, node.parameters);
      
      node.outputs = outputs;
      node.executionTime = performance.now() - startTime;
      node.state = 'complete';
      
      // Cache result
      this.context.cache.set(nodeId, { hash, outputs });
      
      // Mark downstream nodes as stale
      this.markDownstreamStale(nodeId);
      
    } catch (error) {
      node.state = 'error';
      node.error = error.message;
    }
    
    this.context.onNodeStateChange(nodeId, node.state);
  }
  
  // Execute in Web Worker
  private async runInWorker(
    definition: NodeDefinition,
    inputs: Record<string, unknown>,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const worker = this.getAvailableWorker();
      
      worker.postMessage({
        type: 'execute',
        nodeType: definition.type,
        inputs: serializeForWorker(inputs),
        params,
      });
      
      worker.onmessage = (e) => {
        if (e.data.type === 'result') {
          resolve(deserializeFromWorker(e.data.outputs));
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.message));
        } else if (e.data.type === 'progress') {
          this.context.onProgress(e.data.nodeId, e.data.progress, e.data.message);
        }
      };
    });
  }
  
  // Mark all downstream nodes as needing re-execution
  private markDownstreamStale(nodeId: string): void {
    const downstream = this.context.graph.connections
      .filter(c => c.sourceNodeId === nodeId)
      .map(c => c.targetNodeId);
    
    for (const downstreamId of downstream) {
      const node = this.context.graph.nodes.find(n => n.id === downstreamId);
      if (node && node.state === 'complete') {
        node.state = 'stale';
        this.context.onNodeStateChange(downstreamId, 'stale');
        this.markDownstreamStale(downstreamId);
      }
    }
  }
}

React Components
Main App Structure
// ═══════════════════════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════════════════════

import { ReactFlowProvider } from 'reactflow';

function App() {
  const [graph, setGraph] = useState<Graph>(createEmptyGraph());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'2d' | '3d'>('2d');
  const engineRef = useRef<ExecutionEngine | null>(null);
  
  return (
    <div className="app">
      <Toolbar 
        onNewGraph={() => setGraph(createEmptyGraph())}
        onSaveGraph={() => saveGraph(graph)}
        onLoadGraph={(g) => setGraph(g)}
        onExecuteAll={() => engineRef.current?.executeGraph()}
      />
      
      <div className="main-content">
        <ReactFlowProvider>
          <NodeGraphEditor
            graph={graph}
            onChange={setGraph}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
          />
        </ReactFlowProvider>
        
        <PreviewPanel
          graph={graph}
          selectedNode={selectedNode}
          mode={previewMode}
          onModeChange={setPreviewMode}
        />
        
        <PropertiesPanel
          graph={graph}
          selectedNodeId={selectedNode}
          onChange={(nodeId, params) => {
            setGraph(updateNodeParams(graph, nodeId, params));
          }}
        />
      </div>
      
      <NodePalette
        categories={NODE_CATEGORIES}
        onDragStart={(nodeType) => {/* handled by ReactFlow */}}
      />
    </div>
  );
}

Node Graph Editor
// ═══════════════════════════════════════════════════════════════════════════
// NODE GRAPH EDITOR (using ReactFlow)
// ═══════════════════════════════════════════════════════════════════════════

import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
} from 'reactflow';

interface NodeGraphEditorProps {
  graph: Graph;
  onChange: (graph: Graph) => void;
  selectedNode: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

function NodeGraphEditor({ graph, onChange, selectedNode, onSelectNode }: NodeGraphEditorProps) {
  // Convert our graph format to ReactFlow format
  const rfNodes: Node[] = useMemo(() => 
    graph.nodes.map(node => ({
      id: node.id,
      type: 'customNode',
      position: node.position,
      data: {
        ...node,
        definition: NODE_REGISTRY[node.type],
      },
      selected: node.id === selectedNode,
    })),
    [graph.nodes, selectedNode]
  );
  
  const rfEdges: Edge[] = useMemo(() =>
    graph.connections.map(conn => ({
      id: conn.id,
      source: conn.sourceNodeId,
      sourceHandle: conn.sourcePortId,
      target: conn.targetNodeId,
      targetHandle: conn.targetPortId,
      animated: isExecuting(conn.sourceNodeId),
    })),
    [graph.connections]
  );
  
  const onConnect = useCallback((connection: Connection) => {
    // Validate connection types match
    const sourceNode = graph.nodes.find(n => n.id === connection.source);
    const targetNode = graph.nodes.find(n => n.id === connection.target);
    const sourceDef = NODE_REGISTRY[sourceNode?.type || ''];
    const targetDef = NODE_REGISTRY[targetNode?.type || ''];
    
    const sourcePort = sourceDef?.outputs.find(p => p.id === connection.sourceHandle);
    const targetPort = targetDef?.inputs.find(p => p.id === connection.targetHandle);
    
    if (sourcePort?.dataType !== targetPort?.dataType) {
      toast.error(`Cannot connect ${sourcePort?.dataType} to ${targetPort?.dataType}`);
      return;
    }
    
    onChange({
      ...graph,
      connections: [...graph.connections, {
        id: `${connection.source}-${connection.target}-${Date.now()}`,
        sourceNodeId: connection.source!,
        sourcePortId: connection.sourceHandle!,
        targetNodeId: connection.target!,
        targetPortId: connection.targetHandle!,
      }],
    });
  }, [graph, onChange]);
  
  const onNodesChange = useCallback((changes) => {
    // Handle position changes, deletions, etc.
    onChange(applyNodeChanges(graph, changes));
  }, [graph, onChange]);
  
  const onDrop = useCallback((event: DragEvent) => {
    const nodeType = event.dataTransfer?.getData('nodeType');
    if (!nodeType) return;
    
    const position = screenToGraphPosition(event.clientX, event.clientY);
    const newNode = createNodeInstance(nodeType, position);
    
    onChange({
      ...graph,
      nodes: [...graph.nodes, newNode],
    });
  }, [graph, onChange]);
  
  return (
    <div className="node-graph-editor" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        nodeTypes={{ customNode: CustomNodeComponent }}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background />
      </ReactFlow>
    </div>
  );
}

Custom Node Component
// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM NODE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

import { Handle, Position } from 'reactflow';

interface CustomNodeProps {
  data: NodeInstance & { definition: NodeDefinition };
  selected: boolean;
}

function CustomNodeComponent({ data, selected }: CustomNodeProps) {
  const { definition, state, executionTime, error } = data;
  
  const stateColors = {
    idle: 'bg-gray-100',
    stale: 'bg-yellow-100',
    running: 'bg-blue-100 animate-pulse',
    complete: 'bg-green-100',
    error: 'bg-red-100',
  };
  
  return (
    <div className={`
      custom-node 
      ${stateColors[state]} 
      ${selected ? 'ring-2 ring-blue-500' : ''}
      rounded-lg shadow-md p-3 min-w-[180px]
    `}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <CategoryIcon category={definition.category} />
        <span className="font-medium text-sm">{definition.name}</span>
        {state === 'running' && <Spinner size="sm" />}
        {state === 'complete' && executionTime && (
          <span className="text-xs text-gray-500">{executionTime.toFixed(0)}ms</span>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <div className="text-xs text-red-600 mb-2">{error}</div>
      )}
      
      {/* Input ports */}
      <div className="flex flex-col gap-1 mb-2">
        {definition.inputs.map(port => (
          <div key={port.id} className="flex items-center gap-2 relative">
            <Handle
              type="target"
              position={Position.Left}
              id={port.id}
              className={`w-3 h-3 ${getPortColor(port.dataType)}`}
            />
            <span className="text-xs text-gray-600">{port.name}</span>
            {!port.required && <span className="text-xs text-gray-400">(opt)</span>}
          </div>
        ))}
      </div>
      
      {/* Output ports */}
      <div className="flex flex-col gap-1">
        {definition.outputs.map(port => (
          <div key={port.id} className="flex items-center gap-2 justify-end relative">
            <span className="text-xs text-gray-600">{port.name}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={port.id}
              className={`w-3 h-3 ${getPortColor(port.dataType)}`}
            />
          </div>
        ))}
      </div>
      
      {/* Mini preview */}
      {data.outputs && definition.preview && (
        <div className="mt-2 border-t pt-2">
          <MiniPreview data={definition.preview(data.outputs, data.parameters)} />
        </div>
      )}
    </div>
  );
}

function getPortColor(dataType: DataType): string {
  const colors: Record<DataType, string> = {
    heightmap: 'bg-amber-500',
    flowField: 'bg-blue-500',
    biomeMap: 'bg-green-500',
    settlements: 'bg-purple-500',
    roadNetwork: 'bg-orange-500',
    cityLayout: 'bg-red-500',
    geometry: 'bg-pink-500',
    number: 'bg-gray-500',
    vec2: 'bg-cyan-500',
    polygon: 'bg-indigo-500',
    seed: 'bg-yellow-500',
  };
  return colors[dataType] || 'bg-gray-400';
}

Preview Panel
// ═══════════════════════════════════════════════════════════════════════════
// PREVIEW PANEL
// ═══════════════════════════════════════════════════════════════════════════

interface PreviewPanelProps {
  graph: Graph;
  selectedNode: string | null;
  mode: '2d' | '3d';
  onModeChange: (mode: '2d' | '3d') => void;
}

function PreviewPanel({ graph, selectedNode, mode, onModeChange }: PreviewPanelProps) {
  const previewData = useMemo(() => {
    if (!selectedNode) {
      // Show composite preview of entire pipeline
      return gatherAllPreviews(graph);
    }
    
    const node = graph.nodes.find(n => n.id === selectedNode);
    if (!node?.outputs) return null;
    
    const definition = NODE_REGISTRY[node.type];
    return definition?.preview?.(node.outputs, node.parameters);
  }, [graph, selectedNode]);
  
  return (
    <div className="preview-panel flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <span className="font-medium">Preview</span>
        <div className="flex gap-1">
          <button
            className={`px-2 py-1 text-sm rounded ${mode === '2d' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => onModeChange('2d')}
          >
            2D
          </button>
          <button
            className={`px-2 py-1 text-sm rounded ${mode === '3d' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => onModeChange('3d')}
          >
            3D
          </button>
        </div>
      </div>
      
      <div className="flex-1 relative">
        {mode === '2d' ? (
          <Canvas2DPreview data={previewData} />
        ) : (
          <Canvas3DPreview data={previewData} />
        )}
        
        {/* Overlay controls */}
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button className="p-1 bg-white rounded shadow" onClick={() => resetView()}>
            <FitIcon />
          </button>
          <button className="p-1 bg-white rounded shadow" onClick={() => zoomIn()}>
            <ZoomInIcon />
          </button>
          <button className="p-1 bg-white rounded shadow" onClick={() => zoomOut()}>
            <ZoomOutIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// 2D Canvas Preview using Canvas API
function Canvas2DPreview({ data }: { data: PreviewData | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);
    
    // Render based on preview type
    switch (data.type) {
      case 'image':
        ctx.drawImage(data.data, 0, 0);
        break;
        
      case 'polylines':
        ctx.strokeStyle = data.style?.stroke || '#000';
        ctx.lineWidth = data.style?.strokeWidth || 1;
        for (const line of data.data) {
          ctx.beginPath();
          ctx.moveTo(line[0].x, line[0].y);
          for (let i = 1; i < line.length; i++) {
            ctx.lineTo(line[i].x, line[i].y);
          }
          ctx.stroke();
        }
        break;
        
      case 'city-layout':
        renderCityLayout(ctx, data.data);
        break;
        
      case 'markers':
        for (const marker of data.data) {
          renderSettlementMarker(ctx, marker, data.iconMap);
        }
        break;
    }
    
    ctx.restore();
  }, [data, transform]);
  
  // Pan and zoom handlers
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(t => ({
      ...t,
      scale: Math.max(0.1, Math.min(10, t.scale * delta)),
    }));
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      onWheel={onWheel}
      onMouseDown={startPan}
      onMouseMove={pan}
      onMouseUp={endPan}
    />
  );
}

// 3D Preview using Three.js
function Canvas3DPreview({ data }: { data: PreviewData | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initialize Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const controls = new OrbitControls(camera, renderer.domElement);
    
    containerRef.current.appendChild(renderer.domElement);
    sceneRef.current = scene;
    
    // Lighting
    scene.add(new THREE.AmbientLight(0x404040));
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(100, 100, 50);
    scene.add(sun);
    
    camera.position.set(50, 50, 50);
    controls.update();
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    
    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);
  
  useEffect(() => {
    if (!sceneRef.current || !data) return;
    
    // Clear existing geometry
    while (sceneRef.current.children.length > 2) {
      sceneRef.current.remove(sceneRef.current.children[2]);
    }
    
    // Add new geometry based on data type
    if (data.type === 'city-layout') {
      const cityMesh = buildCityMesh(data.data);
      sceneRef.current.add(cityMesh);
    }
  }, [data]);
  
  return <div ref={containerRef} className="w-full h-full" />;
}

Properties Panel
// ═══════════════════════════════════════════════════════════════════════════
// PROPERTIES PANEL
// ═══════════════════════════════════════════════════════════════════════════

interface PropertiesPanelProps {
  graph: Graph;
  selectedNodeId: string | null;
  onChange: (nodeId: string, params: Record<string, unknown>) => void;
}

function PropertiesPanel({ graph, selectedNodeId, onChange }: PropertiesPanelProps) {
  const node = graph.nodes.find(n => n.id === selectedNodeId);
  const definition = node ? NODE_REGISTRY[node.type] : null;
  
  if (!node || !definition) {
    return (
      <div className="properties-panel p-4 text-gray-500">
        Select a node to edit its properties
      </div>
    );
  }
  
  return (
    <div className="properties-panel p-4 overflow-y-auto">
      <h3 className="font-bold text-lg mb-2">{definition.name}</h3>
      <p className="text-sm text-gray-600 mb-4">{definition.description}</p>
      
      <div className="space-y-4">
        {definition.parameters.map(param => (
          <ParameterControl
            key={param.id}
            definition={param}
            value={node.parameters[param.id] ?? param.default}
            onChange={(value) => {
              onChange(node.id, { ...node.parameters, [param.id]: value });
            }}
          />
        ))}
      </div>
      
      {/* Execution info */}
      <div className="mt-6 pt-4 border-t">
        <h4 className="font-medium mb-2">Execution</h4>
        <div className="text-sm space-y-1">
          <div>State: <span className={getStateClass(node.state)}>{node.state}</span></div>
          {node.executionTime && <div>Time: {node.executionTime.toFixed(0)}ms</div>}
          {node.error && <div className="text-red-600">Error: {node.error}</div>}
        </div>
        <button
          className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
          onClick={() => executeNode(node.id)}
        >
          Execute
        </button>
      </div>
    </div>
  );
}

function ParameterControl({ definition, value, onChange }: {
  definition: ParameterDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (definition.type) {
    case 'number':
      return (
        <div>
          <label className="text-sm font-medium">{definition.id}</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={definition.min}
              max={definition.max}
              step={definition.step || (definition.max - definition.min) / 100}
              value={value as number}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className="flex-1"
            />
            <input
              type="number"
              value={value as number}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className="w-20 px-2 py-1 border rounded text-sm"
            />
          </div>
        </div>
      );
      
    case 'boolean':
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-sm">{definition.id}</span>
        </label>
      );
      
    case 'enum':
      return (
        <div>
          <label className="text-sm font-medium">{definition.id}</label>
          <select
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          >
            {definition.options!.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );
      
    case 'vec2':
      const vec = value as { x: number; y: number };
      return (
        <div>
          <label className="text-sm font-medium">{definition.id}</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={vec.x}
              onChange={(e) => onChange({ ...vec, x: parseFloat(e.target.value) })}
              className="w-20 px-2 py-1 border rounded text-sm"
              placeholder="X"
            />
            <input
              type="number"
              value={vec.y}
              onChange={(e) => onChange({ ...vec, y: parseFloat(e.target.value) })}
              className="w-20 px-2 py-1 border rounded text-sm"
              placeholder="Y"
            />
          </div>
        </div>
      );
      
    case 'string':
      return (
        <div>
          <label className="text-sm font-medium">{definition.id}</label>
          <input
            type="text"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
      );
      
    default:
      return null;
  }
}

Web Worker for Heavy Computation
// ═══════════════════════════════════════════════════════════════════════════
// WEB WORKER (computation.worker.ts)
// ═══════════════════════════════════════════════════════════════════════════

import { City, Blueprint } from './mfcg-clean';
import { computeD8, computeFlowAccumulation } from './watershed';
import { classifyBiomes } from './biome';

// Import all node executors
const executors: Record<string, (inputs: any, params: any, progress: (p: number, msg: string) => void) => Promise<any>> = {
  'heightmap-input': async (inputs, params, progress) => {
    progress(0, 'Generating heightmap...');
    
    if (params.source === 'noise') {
      const heightmap = generateNoiseHeightmap(
        params.width,
        params.height,
        params.seed,
        params.octaves,
        params.persistence,
        params.lacunarity,
        params.scale
      );
      progress(100, 'Done');
      return { heightmap };
    }
    
    // File loading handled in main thread
    return {};
  },
  
  'flow-direction': async (inputs, params, progress) => {
    progress(0, 'Computing flow directions...');
    const d8 = computeD8(inputs.heightmap, params.seaLevel);
    
    if (params.resolveDafa) {
      progress(50, 'Resolving depressions...');
      resolveDafa(d8, inputs.heightmap, params.seaLevel);
    }
    
    progress(100, 'Done');
    return { flowField: d8 };
  },
  
  'flow-accumulation': async (inputs, params, progress) => {
    progress(0, 'Computing flow accumulation...');
    const accumulated = computeFlowAccumulation(inputs.flowField);
    progress(100, 'Done');
    return { flowField: accumulated };
  },
  
  'biome-classifier': async (inputs, params, progress) => {
    progress(0, 'Classifying biomes...');
    const biomeMap = classifyBiomes(inputs.heightmap, inputs.flowField, params);
    progress(100, 'Done');
    return { biomeMap };
  },
  
  'settlement-placer': async (inputs, params, progress) => {
    progress(0, 'Scoring terrain...');
    const scores = computeSettlementScores(inputs.heightmap, inputs.biomeMap, inputs.flowField, params);
    
    progress(50, 'Placing settlements...');
    const settlements = placeSettlements(scores, params);
    
    progress(100, 'Done');
    return { settlements };
  },
  
  'city-generator': async (inputs, params, progress) => {
    progress(0, 'Generating patches...');
    const city = new City(inputs.blueprint);
    
    progress(20, 'Building walls...');
    city.buildPatches();
    city.optimizeJunctions();
    city.buildWalls();
    
    progress(40, 'Creating streets...');
    city.buildStreets();
    
    progress(60, 'Assigning wards...');
    city.createWards();
    
    progress(80, 'Generating buildings...');
    city.buildGeometry();
    
    progress(100, 'Done');
    return { city: city.serialize() };
  },
  
  'road-routing': async (inputs, params, progress) => {
    progress(0, 'Finding routes...');
    const roads = routeRoads(inputs.topology, inputs.heightmap, inputs.biomeMap, params);
    progress(100, 'Done');
    return { roads };
  },
};

// Worker message handler
self.onmessage = async (e: MessageEvent) => {
  const { type, nodeType, inputs, params, requestId } = e.data;
  
  if (type === 'execute') {
    const executor = executors[nodeType];
    if (!executor) {
      self.postMessage({ type: 'error', message: `Unknown node type: ${nodeType}`, requestId });
      return;
    }
    
    try {
      const progress = (p: number, msg: string) => {
        self.postMessage({ type: 'progress', progress: p, message: msg, requestId });
      };
      
      const outputs = await executor(inputs, params, progress);
      self.postMessage({ type: 'result', outputs, requestId });
      
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message, requestId });
    }
  }
};

Preset Graphs (Templates)
// ═══════════════════════════════════════════════════════════════════════════
// PRESET GRAPH TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

const PRESET_GRAPHS: Record<string, () => Graph> = {
  'single-city': () => ({
    nodes: [
      createNode('city-blueprint', { x: 100, y: 200 }, { size: 25, walls: true, citadel: true }),
      createNode('city-generator', { x: 350, y: 200 }),
      createNode('building-extractor', { x: 600, y: 200 }),
      createNode('svg-export', { x: 850, y: 200 }),
    ],
    connections: [
      connect('node-0', 'blueprint', 'node-1', 'blueprint'),
      connect('node-1', 'city', 'node-2', 'city'),
      connect('node-2', 'buildings', 'node-3', 'geometry'),
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  }),
  
  'terrain-to-settlements': () => ({
    nodes: [
      createNode('heightmap-input', { x: 100, y: 100 }, { source: 'noise', width: 512, height: 512 }),
      createNode('flow-direction', { x: 350, y: 100 }),
      createNode('flow-accumulation', { x: 600, y: 100 }),
      createNode('river-extraction', { x: 850, y: 100 }),
      createNode('biome-classifier', { x: 350, y: 300 }),
      createNode('settlement-placer', { x: 600, y: 300 }),
      createNode('road-topology', { x: 850, y: 300 }),
      createNode('road-routing', { x: 1100, y: 300 }),
    ],
    connections: [
      connect('node-0', 'heightmap', 'node-1', 'heightmap'),
      connect('node-1', 'flowField', 'node-2', 'flowField'),
      connect('node-2', 'flowField', 'node-3', 'flowField'),
      connect('node-0', 'heightmap', 'node-3', 'heightmap'),
      connect('node-0', 'heightmap', 'node-4', 'heightmap'),
      connect('node-2', 'flowField', 'node-4', 'flowField'),
      connect('node-0', 'heightmap', 'node-5', 'heightmap'),
      connect('node-4', 'biomeMap', 'node-5', 'biomeMap'),
      connect('node-2', 'flowField', 'node-5', 'flowField'),
      connect('node-5', 'settlements', 'node-6', 'settlements'),
      connect('node-6', 'topology', 'node-7', 'topology'),
      connect('node-0', 'heightmap', 'node-7', 'heightmap'),
      connect('node-4', 'biomeMap', 'node-7', 'biomeMap'),
    ],
    viewport: { x: 0, y: 0, zoom: 0.8 },
  }),
  
  'full-pipeline': () => ({
    // Complete pipeline from heightmap to city geometry
    // ... extensive node setup
  }),
};

Interactive Features
Click-to-Place Settlement
// Enable click-to-place in preview panel
function useSettlementPlacer(graph: Graph, onChange: (graph: Graph) => void) {
  const [placingMode, setPlacingMode] = useState(false);
  const [placingType, setPlacingType] = useState<SettlementType>('village');
  
  const handlePreviewClick = useCallback((worldPos: { x: number; y: number }) => {
    if (!placingMode) return;
    
    // Find or create a manual-settlement node
    const manualNode = createNode('manual-settlement', { x: 100, y: 100 }, {
      position: worldPos,
      type: placingType,
      name: `${placingType}-${Date.now()}`,
      seed: Math.floor(Math.random() * 100000),
    });
    
    // Find merge node and connect
    const mergeNode = graph.nodes.find(n => n.type === 'merge-settlements');
    
    onChange({
      ...graph,
      nodes: [...graph.nodes, manualNode],
      connections: mergeNode ? [
        ...graph.connections,
        connect(manualNode.id, 'settlement', mergeNode.id, 'settlements2'),
      ] : graph.connections,
    });
    
    setPlacingMode(false);
  }, [placingMode, placingType, graph, onChange]);
  
  return { placingMode, setPlacingMode, placingType, setPlacingType, handlePreviewClick };
}

Ward Painting
// Click-to-paint ward types on city patches
function useWardPainter(city: City, onChange: (city: City) => void) {
  const [paintingWard, setPaintingWard] = useState<WardType | null>(null);
  
  const handlePatchClick = useCallback((patchIndex: number) => {
    if (!paintingWard) return;
    
    const newCity = city.clone();
    newCity.cells[patchIndex].setWard(paintingWard);
    newCity.rebuildGeometry();
    onChange(newCity);
  }, [paintingWard, city, onChange]);
  
  return { paintingWard, setPaintingWard, handlePatchClick };
}

File Structure
src/
├── App.tsx
├── components/
│   ├── NodeGraphEditor.tsx
│   ├── CustomNode.tsx
│   ├── PreviewPanel.tsx
│   ├── Canvas2DPreview.tsx
│   ├── Canvas3DPreview.tsx
│   ├── PropertiesPanel.tsx
│   ├── ParameterControl.tsx
│   ├── NodePalette.tsx
│   └── Toolbar.tsx
├── engine/
│   ├── ExecutionEngine.ts
│   ├── GraphSerializer.ts
│   └── computation.worker.ts
├── nodes/
│   ├── index.ts              # Node registry
│   ├── terrain/
│   │   ├── HeightmapInput.ts
│   │   └── TerrainModifier.ts
│   ├── watershed/
│   │   ├── FlowDirection.ts
│   │   ├── FlowAccumulation.ts
│   │   ├── RiverExtraction.ts
│   │   └── WatershedBasins.ts
│   ├── biome/
│   │   └── BiomeClassifier.ts
│   ├── settlement/
│   │   ├── SettlementPlacer.ts
│   │   ├── ManualSettlement.ts
│   │   └── MergeSettlements.ts
│   ├── roads/
│   │   ├── RoadTopology.ts
│   │   └── RoadRouting.ts
│   ├── city/
│   │   ├── CityBlueprint.ts
│   │   ├── CityGenerator.ts
│   │   ├── WardOverride.ts
│   │   └── BuildingExtractor.ts
│   └── output/
│       ├── SVGExport.ts
│       ├── GeoJSONExport.ts
│       └── ThreeJSExport.ts
├── algorithms/
│   ├── mfcg-clean/          # Ported MFCG library
│   │   ├── City.ts
│   │   ├── Blueprint.ts
│   │   ├── Cell.ts
│   │   ├── Ward.ts
│   │   ├── wards/
│   │   ├── geometry/
│   │   └── utils/
│   ├── watershed/
│   │   ├── d8.ts
│   │   ├── accumulation.ts
│   │   └── basins.ts
│   ├── biome/
│   │   └── classifier.ts
│   ├── roads/
│   │   ├── spaceColonization.ts
│   │   └── astar.ts
│   └── noise/
│       └── perlin.ts
├── types/
│   ├── graph.ts
│   ├── nodes.ts
│   └── data.ts
├── presets/
│   └── templates.ts
└── utils/
    ├── hash.ts
    ├── serialization.ts
    └── download.ts

Key Benefits of This Design
Feature	Benefit
Node-based	Visual pipeline, easy to understand data flow
Caching	Only re-runs nodes when inputs change
Web Workers	Heavy computation doesn't block UI
Live Preview	See changes as you tweak parameters
Composable	Combine auto + manual settlement placement
Export Options	SVG, GeoJSON, GLTF for different use cases
Templates	Quick start with common pipelines
Interactive	Click-to-place settlements, paint ward types
This design leverages the existing mfcg-clean JavaScript reference directly, so the core city generation algorithm is already available. The main work is building the UI layer and porting the watershed/biome algorithms from C++ to TypeScript.

