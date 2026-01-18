// Perlin noise implementation based on Ken Perlin's improved noise
// Reference: https://mrl.cs.nyu.edu/~perlin/noise/

// Permutation table
const p = new Uint8Array(512);
const permutation = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142,
  8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203,
  117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74,
  165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220,
  105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132,
  187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3,
  64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
  47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221,
  153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185,
  112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51,
  145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
  50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78,
  66, 215, 61, 156, 180,
];

// Initialize permutation table
for (let i = 0; i < 256; i++) {
  p[i] = permutation[i];
  p[256 + i] = permutation[i];
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

// 3D Perlin noise
function noise3D(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;

  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);

  const u = fade(x);
  const v = fade(y);
  const w = fade(z);

  const A = p[X] + Y;
  const AA = p[A] + Z;
  const AB = p[A + 1] + Z;
  const B = p[X + 1] + Y;
  const BA = p[B] + Z;
  const BB = p[B + 1] + Z;

  return lerp(
    w,
    lerp(
      v,
      lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
      lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))
    ),
    lerp(
      v,
      lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
      lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))
    )
  );
}

// 2D noise (using z=0)
export function noise2D(x: number, y: number): number {
  return noise3D(x, y, 0);
}

// Fractal Brownian Motion (fBm) for more natural terrain
export function fbm(
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
  scale: number
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

// Heightmap data structure
export interface Heightmap {
  width: number;
  height: number;
  data: Float32Array;
}

// Generate a heightmap using fractal noise
export function generateNoiseHeightmap(
  width: number,
  height: number,
  seed: number,
  octaves: number = 6,
  persistence: number = 0.5,
  lacunarity: number = 2.0,
  scale: number = 0.01
): Heightmap {
  const data = new Float32Array(width * height);

  // Use seed to offset the noise space
  const offsetX = (seed % 1000) * 100;
  const offsetY = Math.floor(seed / 1000) * 100;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x + offsetX;
      const ny = y + offsetY;

      // Generate base noise
      let value = fbm(nx, ny, octaves, persistence, lacunarity, scale);

      // Normalize from [-1, 1] to [0, 1]
      value = (value + 1) * 0.5;

      // Apply island mask (optional - creates island-like terrain)
      const dx = (x / width - 0.5) * 2;
      const dy = (y / height - 0.5) * 2;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const falloff = Math.max(0, 1 - distFromCenter * 0.8);
      value *= falloff;

      data[y * width + x] = value;
    }
  }

  return { width, height, data };
}

// Get height at a specific point (with bounds checking)
export function sampleHeightmap(heightmap: Heightmap, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);

  if (ix < 0 || ix >= heightmap.width || iy < 0 || iy >= heightmap.height) {
    return 0;
  }

  return heightmap.data[iy * heightmap.width + ix];
}

// Bilinear interpolation for smooth sampling
export function sampleHeightmapBilinear(heightmap: Heightmap, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, heightmap.width - 1);
  const y1 = Math.min(y0 + 1, heightmap.height - 1);

  const fx = x - x0;
  const fy = y - y0;

  const v00 = sampleHeightmap(heightmap, x0, y0);
  const v10 = sampleHeightmap(heightmap, x1, y0);
  const v01 = sampleHeightmap(heightmap, x0, y1);
  const v11 = sampleHeightmap(heightmap, x1, y1);

  const v0 = v00 * (1 - fx) + v10 * fx;
  const v1 = v01 * (1 - fx) + v11 * fx;

  return v0 * (1 - fy) + v1 * fy;
}

// Compute slope at a point
export function computeSlope(heightmap: Heightmap, x: number, y: number): number {
  const hL = sampleHeightmap(heightmap, x - 1, y);
  const hR = sampleHeightmap(heightmap, x + 1, y);
  const hU = sampleHeightmap(heightmap, x, y - 1);
  const hD = sampleHeightmap(heightmap, x, y + 1);

  const dx = (hR - hL) / 2;
  const dy = (hD - hU) / 2;

  return Math.sqrt(dx * dx + dy * dy);
}

// Compute slope map for entire heightmap
export function computeSlopeMap(heightmap: Heightmap): Float32Array {
  const slopes = new Float32Array(heightmap.width * heightmap.height);

  for (let y = 0; y < heightmap.height; y++) {
    for (let x = 0; x < heightmap.width; x++) {
      slopes[y * heightmap.width + x] = computeSlope(heightmap, x, y);
    }
  }

  return slopes;
}
