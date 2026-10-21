/**
 * Seeded pseudo-random numbers so every experiment is reproducible.
 * mulberry32 is small, fast and statistically adequate for Monte-Carlo noise.
 */
export class Rng {
  private state: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  uniform(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Standard normal N(0, 1) via the Box–Muller transform. */
  gaussian(): number {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return s;
    }
    const u1 = 1 - this.uniform(); // (0, 1] so log() stays finite
    const u2 = this.uniform();
    const r = Math.sqrt(-2 * Math.log(u1));
    this.spare = r * Math.sin(2 * Math.PI * u2);
    return r * Math.cos(2 * Math.PI * u2);
  }

  /** Uniform in [min, max]. */
  range(min: number, max: number): number {
    return min + (max - min) * this.uniform();
  }
}

/** Mix several integers into one 32-bit seed (FNV-1a followed by an avalanche step). */
export function hashSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    let v = Math.floor(p) >>> 0;
    for (let i = 0; i < 4; i++) {
      h ^= v & 0xff;
      h = Math.imul(h, 0x01000193);
      v >>>= 8;
    }
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
