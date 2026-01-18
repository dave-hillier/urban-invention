import { Point, Polygon } from '../../types';

// Point operations
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s };
}

export function normalize(p: Point): Point {
  const len = Math.sqrt(p.x * p.x + p.y * p.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: p.x / len, y: p.y / len };
}

export function perpendicular(p: Point): Point {
  return { x: -p.y, y: p.x };
}

export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

// Polygon operations
export function polygonCentroid(polygon: Polygon): Point {
  let cx = 0;
  let cy = 0;
  let area = 0;

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const a = polygon[i];
    const b = polygon[j];
    const f = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
    area += f;
  }

  area *= 0.5;
  if (Math.abs(area) < 1e-10) {
    // Degenerate polygon - return average of points
    const sum = polygon.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
    return scale(sum, 1 / polygon.length);
  }

  const factor = 1 / (6 * area);
  return { x: cx * factor, y: cy * factor };
}

export function polygonArea(polygon: Polygon): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area) / 2;
}

export function polygonPerimeter(polygon: Polygon): number {
  let perimeter = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    perimeter += distance(polygon[i], polygon[j]);
  }
  return perimeter;
}

export function isPointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function shrinkPolygon(polygon: Polygon, amount: number): Polygon {
  const centroid = polygonCentroid(polygon);
  return polygon.map((p) => lerp(p, centroid, amount / distance(p, centroid)));
}

export function expandPolygon(polygon: Polygon, amount: number): Polygon {
  return shrinkPolygon(polygon, -amount);
}

// Inset polygon by moving edges inward
export function insetPolygon(polygon: Polygon, inset: number): Polygon {
  const n = polygon.length;
  if (n < 3) return [...polygon];

  const result: Point[] = [];

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    // Compute inward normals for adjacent edges
    const edge1 = normalize(subtract(curr, prev));
    const edge2 = normalize(subtract(next, curr));

    const normal1 = perpendicular(edge1);
    const normal2 = perpendicular(edge2);

    // Average the normals
    const avgNormal = normalize(add(normal1, normal2));

    // Move point inward
    const factor = inset / Math.max(0.1, Math.abs(dot(avgNormal, normal1)));
    result.push(add(curr, scale(avgNormal, Math.min(factor, inset * 3))));
  }

  return result;
}

// Compute bounding box of polygon
export function polygonBounds(polygon: Polygon): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
