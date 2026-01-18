// Seeded random number generator (Mulberry32)
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  // Returns a random float between 0 and 1
  float(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns a random integer between 0 (inclusive) and max (exclusive)
  int(max: number): number {
    return Math.floor(this.float() * max);
  }

  // Returns a random float between min and max
  range(min: number, max: number): number {
    return min + this.float() * (max - min);
  }

  // Returns a random boolean with given probability
  bool(probability: number = 0.5): boolean {
    return this.float() < probability;
  }

  // Pick a random element from an array
  pick<T>(array: T[]): T {
    return array[this.int(array.length)];
  }

  // Shuffle an array in place
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Generate normally distributed random number (Box-Muller)
  gaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.float();
    const u2 = this.float();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }
}
