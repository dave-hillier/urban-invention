import { Point, Polygon, WardType, CityLayout, CityPatch, Building, WallSegment } from '../../types';
import { Random } from './Random';
import { generateVoronoi, lloydRelax, generateSpiralSeeds, VoronoiRegion } from './Voronoi';
import {
  distance,
  polygonCentroid,
  polygonArea,
  insetPolygon,
  lerp,
} from './Geometry';

// Blueprint for city generation
export interface CityBlueprint {
  seed: number;
  size: number;
  walls: boolean;
  citadel: boolean;
  plaza: boolean;
  temple: boolean;
  river: boolean;
  coast: boolean;
  coastDirection: number;
}

// Cell in the city (Voronoi region)
interface Cell {
  id: number;
  region: VoronoiRegion;
  ward: WardType;
  withinWalls: boolean;
  neighbors: Cell[];
}

export class City {
  private blueprint: CityBlueprint;
  private random: Random;
  private cells: Cell[] = [];
  private innerCells: Cell[] = [];
  private wallShape: Polygon = [];
  private gates: Point[] = [];
  private streets: Polygon[] = [];
  private buildings: Building[] = [];

  private readonly cityRadius: number;
  private readonly center: Point;

  constructor(blueprint: CityBlueprint) {
    this.blueprint = blueprint;
    this.random = new Random(blueprint.seed);
    this.cityRadius = 30 + blueprint.size * 2;
    this.center = { x: this.cityRadius, y: this.cityRadius };
  }

  build(): CityLayout {
    this.buildPatches();
    this.optimizeJunctions();
    if (this.blueprint.walls) {
      this.buildWalls();
    }
    this.assignWards();
    this.buildStreets();
    this.buildBuildings();

    return this.toLayout();
  }

  private buildPatches(): void {
    const numPatches = this.blueprint.size;
    const bounds = { width: this.cityRadius * 2, height: this.cityRadius * 2 };

    // Generate spiral seed points
    let seeds = generateSpiralSeeds(numPatches, this.center, this.cityRadius * 0.9, this.random);

    // Lloyd relaxation for more uniform cells
    for (let i = 0; i < 2; i++) {
      const regions = generateVoronoi(seeds, bounds);
      seeds = lloydRelax(regions);
    }

    // Final Voronoi
    const regions = generateVoronoi(seeds, bounds);

    // Create cells from regions
    this.cells = regions.map((region, i) => ({
      id: i,
      region,
      ward: 'alleys' as WardType,
      withinWalls: false,
      neighbors: [],
    }));

    // Link neighbors
    for (const cell of this.cells) {
      cell.neighbors = cell.region.neighbors
        .map((r) => this.cells.find((c) => c.region === r))
        .filter((c): c is Cell => c !== undefined);
    }
  }

  private optimizeJunctions(): void {
    // Collapse very short edges by merging nearby vertices
    const threshold = 2;

    for (const cell of this.cells) {
      const verts = cell.region.vertices;
      const newVerts: Point[] = [];

      for (let i = 0; i < verts.length; i++) {
        const prev = newVerts[newVerts.length - 1];
        if (!prev || distance(prev, verts[i]) > threshold) {
          newVerts.push(verts[i]);
        }
      }

      // Check wrap-around
      if (newVerts.length > 1 && distance(newVerts[0], newVerts[newVerts.length - 1]) < threshold) {
        newVerts.pop();
      }

      cell.region.vertices = newVerts;
    }
  }

  private buildWalls(): void {
    // Find inner cells (close to center)
    const innerRadius = this.cityRadius * 0.6;
    this.innerCells = this.cells.filter((c) => {
      const centroid = polygonCentroid(c.region.vertices);
      return distance(centroid, this.center) < innerRadius;
    });

    // Mark as within walls
    for (const cell of this.innerCells) {
      cell.withinWalls = true;
    }

    // Build wall shape from circumference of inner cells
    this.wallShape = this.computeCircumference(this.innerCells);

    // Place gates (2-4)
    const numGates = 2 + this.random.int(3);
    const wallPerimeter = this.wallShape.length;
    const gateSpacing = Math.floor(wallPerimeter / numGates);

    for (let i = 0; i < numGates; i++) {
      const idx = (i * gateSpacing + this.random.int(gateSpacing / 2)) % wallPerimeter;
      this.gates.push(this.wallShape[idx]);
    }
  }

  private computeCircumference(cells: Cell[]): Polygon {
    // Find boundary edges (edges not shared with other inner cells)
    const edges: [Point, Point][] = [];
    const innerIds = new Set(cells.map((c) => c.id));

    for (const cell of cells) {
      const verts = cell.region.vertices;
      for (let i = 0; i < verts.length; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];

        // Check if this edge is shared with an inner neighbor
        let isShared = false;
        for (const neighbor of cell.neighbors) {
          if (!innerIds.has(neighbor.id)) continue;
          const nVerts = neighbor.region.vertices;
          for (let j = 0; j < nVerts.length; j++) {
            const na = nVerts[j];
            const nb = nVerts[(j + 1) % nVerts.length];
            if (
              (distance(a, na) < 0.1 && distance(b, nb) < 0.1) ||
              (distance(a, nb) < 0.1 && distance(b, na) < 0.1)
            ) {
              isShared = true;
              break;
            }
          }
          if (isShared) break;
        }

        if (!isShared) {
          edges.push([a, b]);
        }
      }
    }

    // Chain edges into a polygon
    if (edges.length === 0) return [];

    const result: Point[] = [edges[0][0], edges[0][1]];
    const used = new Set([0]);

    while (used.size < edges.length) {
      const last = result[result.length - 1];
      let found = false;

      for (let i = 0; i < edges.length; i++) {
        if (used.has(i)) continue;
        const [a, b] = edges[i];

        if (distance(last, a) < 0.1) {
          result.push(b);
          used.add(i);
          found = true;
          break;
        } else if (distance(last, b) < 0.1) {
          result.push(a);
          used.add(i);
          found = true;
          break;
        }
      }

      if (!found) break;
    }

    return result;
  }

  private assignWards(): void {
    // Assign ward types based on configuration and position

    if (this.blueprint.citadel) {
      // Find cell closest to center
      const castleCell = this.innerCells.reduce((best, cell) => {
        const d = distance(polygonCentroid(cell.region.vertices), this.center);
        const bestD = distance(polygonCentroid(best.region.vertices), this.center);
        return d < bestD ? cell : best;
      }, this.innerCells[0]);

      if (castleCell) {
        castleCell.ward = 'castle';
      }
    }

    if (this.blueprint.plaza) {
      // Place market near center but not on castle
      const candidates = this.innerCells.filter((c) => c.ward !== 'castle');
      if (candidates.length > 0) {
        const marketCell = candidates.reduce((best, cell) => {
          const d = distance(polygonCentroid(cell.region.vertices), this.center);
          const bestD = distance(polygonCentroid(best.region.vertices), this.center);
          return d < bestD ? cell : best;
        }, candidates[0]);
        marketCell.ward = 'market';
      }
    }

    if (this.blueprint.temple) {
      // Place cathedral in inner cells
      const candidates = this.innerCells.filter((c) => c.ward === 'alleys');
      if (candidates.length > 0) {
        const templeCell = this.random.pick(candidates);
        templeCell.ward = 'cathedral';
      }
    }

    // Outer cells are farms/wilderness
    for (const cell of this.cells) {
      if (!cell.withinWalls && cell.ward === 'alleys') {
        cell.ward = this.random.bool(0.7) ? 'farm' : 'wilderness';
      }
    }
  }

  private buildStreets(): void {
    if (this.gates.length < 2) return;

    // Connect gates through the center
    for (let i = 0; i < this.gates.length; i++) {
      const from = this.gates[i];
      const to = this.gates[(i + 1) % this.gates.length];

      // Simple path through center
      const street: Polygon = [from, this.center, to];
      this.streets.push(street);
    }
  }

  private buildBuildings(): void {
    for (const cell of this.cells) {
      if (cell.ward === 'wilderness' || cell.ward === 'market') {
        continue; // No buildings
      }

      const shape = cell.region.vertices;
      if (shape.length < 3) continue;

      if (cell.ward === 'castle') {
        // Large keep building
        const inset = insetPolygon(shape, 5);
        if (inset.length >= 3) {
          this.buildings.push({
            footprint: inset,
            ward: cell.ward,
            type: 'keep',
          });
        }
      } else if (cell.ward === 'cathedral') {
        // Church building
        const inset = insetPolygon(shape, 4);
        if (inset.length >= 3) {
          this.buildings.push({
            footprint: inset,
            ward: cell.ward,
            type: 'church',
          });
        }
      } else if (cell.ward === 'alleys') {
        // Subdivide into lots and place buildings
        this.subdivideCellIntoBuildings(cell);
      } else if (cell.ward === 'farm') {
        // Sparse farm buildings
        if (this.random.bool(0.3)) {
          const centroid = polygonCentroid(shape);
          const size = 3 + this.random.float() * 2;
          const building: Polygon = [
            { x: centroid.x - size, y: centroid.y - size },
            { x: centroid.x + size, y: centroid.y - size },
            { x: centroid.x + size, y: centroid.y + size },
            { x: centroid.x - size, y: centroid.y + size },
          ];
          this.buildings.push({
            footprint: building,
            ward: cell.ward,
            type: 'house',
          });
        }
      }
    }
  }

  private subdivideCellIntoBuildings(cell: Cell): void {
    const shape = cell.region.vertices;
    const area = polygonArea(shape);

    // Skip very small cells
    if (area < 30) return;

    // Inset from edges
    const inset = insetPolygon(shape, 2);
    if (inset.length < 3) return;

    // Subdivide into building lots
    const lots = this.recursiveSubdivide(inset, 20);

    for (const lot of lots) {
      if (polygonArea(lot) < 8) continue;

      // Create L-shaped or rectangular building
      const building = this.createBuilding(lot);
      if (building.length >= 3) {
        this.buildings.push({
          footprint: building,
          ward: cell.ward,
          type: 'house',
        });
      }
    }
  }

  private recursiveSubdivide(polygon: Polygon, minArea: number): Polygon[] {
    const area = polygonArea(polygon);
    if (area < minArea * 2 || polygon.length < 3) {
      return [polygon];
    }

    // Find longest edge
    let longestIdx = 0;
    let longestLen = 0;
    for (let i = 0; i < polygon.length; i++) {
      const len = distance(polygon[i], polygon[(i + 1) % polygon.length]);
      if (len > longestLen) {
        longestLen = len;
        longestIdx = i;
      }
    }

    // Find edge to split to (opposite-ish)
    const oppositeIdx = (longestIdx + Math.floor(polygon.length / 2)) % polygon.length;

    // Split points
    const t1 = 0.4 + this.random.float() * 0.2;
    const t2 = 0.4 + this.random.float() * 0.2;

    const splitA = lerp(
      polygon[longestIdx],
      polygon[(longestIdx + 1) % polygon.length],
      t1
    );
    const splitB = lerp(
      polygon[oppositeIdx],
      polygon[(oppositeIdx + 1) % polygon.length],
      t2
    );

    // Create two new polygons
    const poly1: Polygon = [];
    const poly2: Polygon = [];

    for (let i = 0; i <= longestIdx; i++) {
      poly1.push(polygon[i]);
    }
    poly1.push(splitA);
    poly1.push(splitB);
    for (let i = oppositeIdx + 1; i < polygon.length; i++) {
      poly1.push(polygon[i]);
    }

    poly2.push(splitA);
    for (let i = longestIdx + 1; i <= oppositeIdx; i++) {
      poly2.push(polygon[i]);
    }
    poly2.push(splitB);

    // Recurse
    const result: Polygon[] = [];
    if (poly1.length >= 3 && polygonArea(poly1) >= minArea) {
      result.push(...this.recursiveSubdivide(poly1, minArea));
    }
    if (poly2.length >= 3 && polygonArea(poly2) >= minArea) {
      result.push(...this.recursiveSubdivide(poly2, minArea));
    }

    return result.length > 0 ? result : [polygon];
  }

  private createBuilding(lot: Polygon): Polygon {
    // Create a slightly inset building
    const inset = insetPolygon(lot, 0.5);
    if (inset.length < 3) return lot;

    // Occasionally create L-shape by removing a corner
    if (inset.length === 4 && this.random.bool(0.3)) {
      const removeIdx = this.random.int(4);
      const corner = inset[removeIdx];
      const prev = inset[(removeIdx - 1 + 4) % 4];
      const next = inset[(removeIdx + 1) % 4];

      // Create L-shape
      const midPrev = lerp(corner, prev, 0.4);
      const midNext = lerp(corner, next, 0.4);
      const inner = lerp(midPrev, midNext, 0.5);

      const lShape: Polygon = [];
      for (let i = 0; i < 4; i++) {
        if (i === removeIdx) {
          lShape.push(midPrev);
          lShape.push(inner);
          lShape.push(midNext);
        } else {
          lShape.push(inset[i]);
        }
      }
      return lShape;
    }

    return inset;
  }

  private toLayout(): CityLayout {
    const patches: CityPatch[] = this.cells.map((cell) => ({
      id: cell.id,
      shape: cell.region.vertices,
      ward: cell.ward,
      withinWalls: cell.withinWalls,
    }));

    const walls: WallSegment[] = [];
    if (this.wallShape.length > 0) {
      for (let i = 0; i < this.wallShape.length; i++) {
        const j = (i + 1) % this.wallShape.length;
        walls.push({
          start: this.wallShape[i],
          end: this.wallShape[j],
          hasTower: i % 5 === 0, // Tower every 5 segments
        });
      }
    }

    // Compute bounds
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const cell of this.cells) {
      for (const v of cell.region.vertices) {
        minX = Math.min(minX, v.x);
        minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x);
        maxY = Math.max(maxY, v.y);
      }
    }

    return {
      patches,
      streets: this.streets,
      walls,
      buildings: this.buildings,
      gates: this.gates,
      bounds: { minX, minY, maxX, maxY },
    };
  }
}
