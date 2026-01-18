import { Heightmap } from '../terrain/noise';

// D8 flow direction encoding
// 7 0 1
// 6 X 2
// 5 4 3
// Value 8 = pit or flat (no flow)

export const D8_DIRECTIONS = [
  { dx: 0, dy: -1 }, // 0: N
  { dx: 1, dy: -1 }, // 1: NE
  { dx: 1, dy: 0 }, // 2: E
  { dx: 1, dy: 1 }, // 3: SE
  { dx: 0, dy: 1 }, // 4: S
  { dx: -1, dy: 1 }, // 5: SW
  { dx: -1, dy: 0 }, // 6: W
  { dx: -1, dy: -1 }, // 7: NW
];

// Flow field data structure
export interface FlowField {
  width: number;
  height: number;
  directions: Uint8Array; // D8 direction for each cell (0-7, or 8 for pit)
  accumulation: Float32Array; // Flow accumulation (upstream area)
}

// Compute D8 flow direction for each cell
export function computeD8FlowDirection(
  heightmap: Heightmap,
  seaLevel: number = 0
): FlowField {
  const { width, height, data } = heightmap;
  const directions = new Uint8Array(width * height);
  const accumulation = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const h = data[idx];

      // If below sea level, mark as pit
      if (h <= seaLevel) {
        directions[idx] = 8;
        continue;
      }

      // Find steepest downhill neighbor
      let steepestDir = 8;
      let steepestDrop = 0;

      for (let dir = 0; dir < 8; dir++) {
        const { dx, dy } = D8_DIRECTIONS[dir];
        const nx = x + dx;
        const ny = y + dy;

        // Bounds check
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          // Edge of map - allow flow off edge
          const drop = h;
          if (drop > steepestDrop) {
            steepestDrop = drop;
            steepestDir = dir;
          }
          continue;
        }

        const nh = data[ny * width + nx];
        const dist = dir % 2 === 0 ? 1 : Math.SQRT2; // Diagonal distance
        const drop = (h - nh) / dist;

        if (drop > steepestDrop) {
          steepestDrop = drop;
          steepestDir = dir;
        }
      }

      directions[idx] = steepestDir;
    }
  }

  return { width, height, directions, accumulation };
}

// Resolve depressions and flat areas by finding outlets
export function resolvePitsAndFlats(
  flowField: FlowField,
  heightmap: Heightmap
): void {
  const { width, height, directions } = flowField;
  const { data } = heightmap;

  // Find all pits (cells with direction 8 that aren't sea level)
  const pits: number[] = [];
  for (let i = 0; i < directions.length; i++) {
    if (directions[i] === 8 && data[i] > 0) {
      pits.push(i);
    }
  }

  // For each pit, find the lowest outlet by BFS
  for (const pitIdx of pits) {
    const pitHeight = data[pitIdx];
    const visited = new Set<number>();
    const queue: number[] = [pitIdx];
    let lowestOutlet = -1;
    let lowestOutletHeight = Infinity;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const x = current % width;
      const y = Math.floor(current / width);
      const h = data[current];

      // Check all neighbors
      for (let dir = 0; dir < 8; dir++) {
        const { dx, dy } = D8_DIRECTIONS[dir];
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
          // Edge - this is an outlet
          if (h < lowestOutletHeight) {
            lowestOutletHeight = h;
            lowestOutlet = current;
          }
          continue;
        }

        const nIdx = ny * width + nx;
        const nh = data[nIdx];

        // If neighbor is lower and drains somewhere, it's an outlet
        if (nh < pitHeight && directions[nIdx] !== 8) {
          if (h < lowestOutletHeight) {
            lowestOutletHeight = h;
            lowestOutlet = current;
          }
        } else if (nh <= pitHeight + 0.01 && !visited.has(nIdx)) {
          // Part of the depression - continue searching
          queue.push(nIdx);
        }
      }
    }

    // Route the pit toward the outlet
    if (lowestOutlet >= 0 && lowestOutlet !== pitIdx) {
      // Simple: point toward outlet (this is a simplification)
      const px = pitIdx % width;
      const py = Math.floor(pitIdx / width);
      const ox = lowestOutlet % width;
      const oy = Math.floor(lowestOutlet / width);

      const dx = ox - px;
      const dy = oy - py;

      // Find closest D8 direction
      const angle = Math.atan2(dy, dx);
      const dirIndex = Math.round((angle / Math.PI + 1) * 4) % 8;
      // Map angle to D8: E=2, SE=3, S=4, SW=5, W=6, NW=7, N=0, NE=1
      const angleToD8 = [2, 3, 4, 5, 6, 7, 0, 1];
      directions[pitIdx] = angleToD8[dirIndex];
    }
  }
}

// Compute flow accumulation using upstream area counting
export function computeFlowAccumulation(flowField: FlowField): void {
  const { width, height, directions, accumulation } = flowField;

  // Initialize all cells with 1 (itself)
  accumulation.fill(1);

  // Count how many cells flow into each cell
  const inflow = new Uint32Array(width * height);
  for (let i = 0; i < directions.length; i++) {
    const dir = directions[i];
    if (dir < 8) {
      const { dx, dy } = D8_DIRECTIONS[dir];
      const x = i % width;
      const y = Math.floor(i / width);
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        inflow[ny * width + nx]++;
      }
    }
  }

  // Process cells with no inflow first (sources), then propagate
  const queue: number[] = [];
  for (let i = 0; i < inflow.length; i++) {
    if (inflow[i] === 0) {
      queue.push(i);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dir = directions[current];

    if (dir < 8) {
      const { dx, dy } = D8_DIRECTIONS[dir];
      const x = current % width;
      const y = Math.floor(current / width);
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        accumulation[nIdx] += accumulation[current];
        inflow[nIdx]--;

        if (inflow[nIdx] === 0) {
          queue.push(nIdx);
        }
      }
    }
  }
}

// Extract river polylines from flow accumulation
export interface River {
  points: { x: number; y: number }[];
  order: number; // Strahler stream order
}

export function extractRivers(
  flowField: FlowField,
  minAccumulation: number = 100
): River[] {
  const { width, height, directions, accumulation } = flowField;
  const rivers: River[] = [];
  const visited = new Set<number>();

  // Find river sources (high accumulation cells with no upstream high-accumulation neighbors)
  const sources: number[] = [];
  for (let i = 0; i < accumulation.length; i++) {
    if (accumulation[i] >= minAccumulation) {
      // Check if any upstream neighbor also has high accumulation
      const x = i % width;
      const y = Math.floor(i / width);
      let hasUpstreamRiver = false;

      for (let dir = 0; dir < 8; dir++) {
        const { dx, dy } = D8_DIRECTIONS[dir];
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          // Check if neighbor flows into this cell and is also a river
          const nDir = directions[nIdx];
          if (nDir < 8) {
            const { dx: ndx, dy: ndy } = D8_DIRECTIONS[nDir];
            if (nx + ndx === x && ny + ndy === y && accumulation[nIdx] >= minAccumulation) {
              hasUpstreamRiver = true;
              break;
            }
          }
        }
      }

      if (!hasUpstreamRiver) {
        sources.push(i);
      }
    }
  }

  // Trace each river from source to outlet
  for (const source of sources) {
    if (visited.has(source)) continue;

    const points: { x: number; y: number }[] = [];
    let current = source;

    while (current >= 0 && !visited.has(current)) {
      visited.add(current);
      const x = current % width;
      const y = Math.floor(current / width);
      points.push({ x, y });

      const dir = directions[current];
      if (dir >= 8) break;

      const { dx, dy } = D8_DIRECTIONS[dir];
      const nx = x + dx;
      const ny = y + dy;

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) break;

      current = ny * width + nx;
    }

    if (points.length >= 2) {
      rivers.push({ points, order: 1 });
    }
  }

  return rivers;
}

// Delineate watershed basins
export interface WatershedBasins {
  width: number;
  height: number;
  labels: Uint32Array; // Basin ID for each cell
  basinCount: number;
}

export function delineateWatersheds(flowField: FlowField): WatershedBasins {
  const { width, height, directions } = flowField;
  const labels = new Uint32Array(width * height);
  let nextLabel = 1;

  // Find outlets (cells that flow off grid or into pits)
  for (let i = 0; i < directions.length; i++) {
    const dir = directions[i];
    const x = i % width;
    const y = Math.floor(i / width);

    let isOutlet = false;

    if (dir === 8) {
      // Pit
      isOutlet = true;
    } else {
      const { dx, dy } = D8_DIRECTIONS[dir];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        isOutlet = true;
      }
    }

    if (isOutlet && labels[i] === 0) {
      // Label this outlet and all cells that drain to it
      const queue: number[] = [i];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (labels[current] !== 0) continue;
        labels[current] = nextLabel;

        const cx = current % width;
        const cy = Math.floor(current / width);

        // Find all neighbors that flow into this cell
        for (let d = 0; d < 8; d++) {
          const { dx, dy } = D8_DIRECTIONS[d];
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nIdx = ny * width + nx;
            if (labels[nIdx] === 0) {
              const nDir = directions[nIdx];
              if (nDir < 8) {
                const { dx: ndx, dy: ndy } = D8_DIRECTIONS[nDir];
                if (nx + ndx === cx && ny + ndy === cy) {
                  queue.push(nIdx);
                }
              }
            }
          }
        }
      }
      nextLabel++;
    }
  }

  return { width, height, labels, basinCount: nextLabel - 1 };
}
