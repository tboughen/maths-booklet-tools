// Seeded random inputs for property tests (improvement list L18). Every run is reproducible: the
// seed is fixed unless PROPERTY_SEED is set, and a failure names the seed and the run that broke,
// so `PROPERTY_SEED=<seed> npx vitest run <file>` replays it exactly. PROPERTY_RUNS multiplies the
// number of runs for a longer local search.

export type Random = {
  /** A float in [0, 1). */
  next(): number;
  /** An integer from lo to hi inclusive. */
  int(lo: number, hi: number): number;
  /** A bigint from lo to hi inclusive. */
  big(lo: bigint, hi: bigint): bigint;
  pick<T>(items: readonly T[]): T;
  bool(chance?: number): boolean;
};

/** mulberry32: small, fast and good enough for test inputs. */
export function random(seed: number): Random {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) =>
    lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    big: (lo, hi) => {
      const span = hi - lo + 1n;
      let r = 0n;
      for (let i = 0; i < 4; i++) r = (r << 32n) | BigInt(int(0, 0xffffffff));
      return lo + (r % span);
    },
    pick: (items) => items[int(0, items.length - 1)],
    bool: (chance = 0.5) => next() < chance,
  };
}

export const propertySeed = Number(process.env.PROPERTY_SEED ?? 20261108);
const scale = Math.max(1, Number(process.env.PROPERTY_RUNS ?? 1));

/**
 * Checks a property over `runs` seeded inputs. Each run gets its own generator, so one run can be
 * replayed without the others. The property throws (or fails an expect) to report a counterexample.
 */
export function forAll(
  runs: number,
  property: (r: Random, run: number) => void,
  seed = propertySeed,
) {
  for (let run = 0; run < runs * scale; run++) {
    try {
      property(random(seed + run * 7919), run);
    } catch (error) {
      const e = error as Error;
      e.message = `Property failed on run ${run} (PROPERTY_SEED=${seed}): ${e.message}`;
      throw e;
    }
  }
}
