import { Point, Polygon } from '../../types';
import { distance, polygonCentroid } from './Geometry';

// Delaunay triangle
interface Triangle {
  a: Point;
  b: Point;
  c: Point;
  circumcenter: Point;
  circumradius: number;
}

// Voronoi region (cell)
export interface VoronoiRegion {
  seed: Point;
  vertices: Point[];
  neighbors: VoronoiRegion[];
}

// Compute circumcircle of a triangle
function circumcircle(a: Point, b: Point, c: Point): { center: Point; radius: number } | null {
  const ax = a.x,
    ay = a.y;
  const bx = b.x,
    by = b.y;
  const cx = c.x,
    cy = c.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null;

  const ux =
    ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy =
    ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  return {
    center: { x: ux, y: uy },
    radius: Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy)),
  };
}

// Check if point is inside circumcircle
function isInsideCircumcircle(p: Point, t: Triangle): boolean {
  const dx = p.x - t.circumcenter.x;
  const dy = p.y - t.circumcenter.y;
  return dx * dx + dy * dy < t.circumradius * t.circumradius;
}

// Bowyer-Watson algorithm for Delaunay triangulation
function delaunayTriangulation(points: Point[], bounds: { width: number; height: number }): Triangle[] {
  // Create super triangle that contains all points
  const margin = Math.max(bounds.width, bounds.height) * 2;
  const superTriangle: Triangle = {
    a: { x: -margin, y: -margin },
    b: { x: bounds.width + margin, y: -margin },
    c: { x: bounds.width / 2, y: bounds.height + margin },
    circumcenter: { x: bounds.width / 2, y: bounds.height / 2 },
    circumradius: margin * 2,
  };

  let triangles: Triangle[] = [superTriangle];

  for (const point of points) {
    const badTriangles: Triangle[] = [];
    const polygon: [Point, Point][] = [];

    // Find all triangles whose circumcircle contains the point
    for (const t of triangles) {
      if (isInsideCircumcircle(point, t)) {
        badTriangles.push(t);
      }
    }

    // Find the boundary of the polygonal hole
    for (const t of badTriangles) {
      const edges: [Point, Point][] = [
        [t.a, t.b],
        [t.b, t.c],
        [t.c, t.a],
      ];

      for (const edge of edges) {
        let shared = false;
        for (const other of badTriangles) {
          if (t === other) continue;
          const otherEdges: [Point, Point][] = [
            [other.a, other.b],
            [other.b, other.c],
            [other.c, other.a],
          ];
          for (const otherEdge of otherEdges) {
            if (
              (distance(edge[0], otherEdge[0]) < 1e-10 && distance(edge[1], otherEdge[1]) < 1e-10) ||
              (distance(edge[0], otherEdge[1]) < 1e-10 && distance(edge[1], otherEdge[0]) < 1e-10)
            ) {
              shared = true;
              break;
            }
          }
          if (shared) break;
        }
        if (!shared) {
          polygon.push(edge);
        }
      }
    }

    // Remove bad triangles
    triangles = triangles.filter((t) => !badTriangles.includes(t));

    // Create new triangles from the boundary edges
    for (const edge of polygon) {
      const cc = circumcircle(edge[0], edge[1], point);
      if (cc) {
        triangles.push({
          a: edge[0],
          b: edge[1],
          c: point,
          circumcenter: cc.center,
          circumradius: cc.radius,
        });
      }
    }
  }

  // Remove triangles that share a vertex with the super triangle
  return triangles.filter((t) => {
    const superVerts = [superTriangle.a, superTriangle.b, superTriangle.c];
    for (const sv of superVerts) {
      if (distance(t.a, sv) < 1e-10 || distance(t.b, sv) < 1e-10 || distance(t.c, sv) < 1e-10) {
        return false;
      }
    }
    return true;
  });
}

// Generate Voronoi diagram from points
export function generateVoronoi(
  seeds: Point[],
  bounds: { width: number; height: number }
): VoronoiRegion[] {
  const triangles = delaunayTriangulation(seeds, bounds);

  // Map each seed to its triangles
  const seedTriangles = new Map<Point, Triangle[]>();
  for (const seed of seeds) {
    seedTriangles.set(seed, []);
  }

  for (const t of triangles) {
    for (const seed of seeds) {
      if (distance(t.a, seed) < 1e-10 || distance(t.b, seed) < 1e-10 || distance(t.c, seed) < 1e-10) {
        seedTriangles.get(seed)?.push(t);
      }
    }
  }

  // Build regions from circumcenters
  const regions: VoronoiRegion[] = [];
  const seedToRegion = new Map<Point, VoronoiRegion>();

  for (const seed of seeds) {
    const tris = seedTriangles.get(seed) || [];
    if (tris.length === 0) continue;

    // Sort triangles around the seed by angle
    const centers = tris.map((t) => t.circumcenter);
    const centroid = polygonCentroid(centers);
    centers.sort((a, b) => {
      const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
      const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
      return angleA - angleB;
    });

    // Clip to bounds
    const clipped = clipPolygonToBounds(centers, bounds);

    const region: VoronoiRegion = {
      seed,
      vertices: clipped,
      neighbors: [],
    };
    regions.push(region);
    seedToRegion.set(seed, region);
  }

  // Find neighbors (regions that share an edge in Delaunay triangulation)
  for (const t of triangles) {
    const regionA = seedToRegion.get(t.a);
    const regionB = seedToRegion.get(t.b);
    const regionC = seedToRegion.get(t.c);

    if (regionA && regionB && !regionA.neighbors.includes(regionB)) {
      regionA.neighbors.push(regionB);
      regionB.neighbors.push(regionA);
    }
    if (regionB && regionC && !regionB.neighbors.includes(regionC)) {
      regionB.neighbors.push(regionC);
      regionC.neighbors.push(regionB);
    }
    if (regionC && regionA && !regionC.neighbors.includes(regionA)) {
      regionC.neighbors.push(regionA);
      regionA.neighbors.push(regionC);
    }
  }

  return regions;
}

// Clip polygon to rectangular bounds
function clipPolygonToBounds(polygon: Polygon, bounds: { width: number; height: number }): Polygon {
  let result = [...polygon];

  // Sutherland-Hodgman algorithm
  const edges: { inside: (p: Point) => boolean; intersect: (a: Point, b: Point) => Point }[] = [
    {
      inside: (p) => p.x >= 0,
      intersect: (a, b) => ({ x: 0, y: a.y + ((b.y - a.y) * (0 - a.x)) / (b.x - a.x) }),
    },
    {
      inside: (p) => p.x <= bounds.width,
      intersect: (a, b) => ({
        x: bounds.width,
        y: a.y + ((b.y - a.y) * (bounds.width - a.x)) / (b.x - a.x),
      }),
    },
    {
      inside: (p) => p.y >= 0,
      intersect: (a, b) => ({ x: a.x + ((b.x - a.x) * (0 - a.y)) / (b.y - a.y), y: 0 }),
    },
    {
      inside: (p) => p.y <= bounds.height,
      intersect: (a, b) => ({
        x: a.x + ((b.x - a.x) * (bounds.height - a.y)) / (b.y - a.y),
        y: bounds.height,
      }),
    },
  ];

  for (const edge of edges) {
    if (result.length === 0) break;

    const input = result;
    result = [];

    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const next = input[(i + 1) % input.length];

      if (edge.inside(current)) {
        result.push(current);
        if (!edge.inside(next)) {
          result.push(edge.intersect(current, next));
        }
      } else if (edge.inside(next)) {
        result.push(edge.intersect(current, next));
      }
    }
  }

  return result;
}

// Lloyd relaxation - moves seeds toward region centroids
export function lloydRelax(regions: VoronoiRegion[]): Point[] {
  return regions.map((r) => {
    if (r.vertices.length === 0) return r.seed;
    return polygonCentroid(r.vertices);
  });
}

// Generate spiral seed points (like MFCG)
export function generateSpiralSeeds(
  count: number,
  center: Point,
  radius: number,
  random: { float: () => number }
): Point[] {
  const points: Point[] = [];

  // Golden angle for good distribution
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const r = radius * Math.sqrt(t) * (0.8 + 0.4 * random.float());
    const angle = i * goldenAngle + random.float() * 0.2;

    points.push({
      x: center.x + r * Math.cos(angle),
      y: center.y + r * Math.sin(angle),
    });
  }

  return points;
}
