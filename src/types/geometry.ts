// Basic 2D point
export interface Point {
  x: number;
  y: number;
}

// Polygon as array of points
export type Polygon = Point[];

// Vec2 for parameters
export interface Vec2 {
  x: number;
  y: number;
}

// Settlement types
export type SettlementType = 'hamlet' | 'village' | 'town' | 'fishingVillage';

export interface Settlement {
  id: string;
  type: SettlementType;
  position: Vec2;
  radius: number;
  name: string;
  seed: number;
  features?: string[];
}

// Ward types for city generation
export type WardType =
  | 'alleys'
  | 'castle'
  | 'cathedral'
  | 'market'
  | 'farm'
  | 'harbour'
  | 'park'
  | 'wilderness';

// City layout output
export interface CityLayout {
  patches: CityPatch[];
  streets: Polygon[];
  walls: WallSegment[];
  buildings: Building[];
  gates: Point[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface CityPatch {
  id: number;
  shape: Polygon;
  ward: WardType;
  withinWalls: boolean;
}

export interface WallSegment {
  start: Point;
  end: Point;
  hasTower: boolean;
}

export interface Building {
  footprint: Polygon;
  ward: WardType;
  type?: 'house' | 'church' | 'keep' | 'tower';
}
