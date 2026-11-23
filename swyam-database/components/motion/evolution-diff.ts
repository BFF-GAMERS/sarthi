import { STAGGER } from "./tokens";

/** What changed between two orderings of the same stage. */
export interface StageDiff {
  /** Keys present now that were not before, in their new order. */
  entered: string[];
  /** Keys that were present and are gone. */
  left: string[];
  /**
   * The few keys worth pointing at: those that climbed furthest, then the
   * earliest newcomers. At most `maxPromoted` of them.
   */
  promoted: string[];
  /** False when the two orderings are identical. */
  changed: boolean;
}

/**
 * Compares two key orderings and says who was promoted.
 *
 * "Promoted" is judged against the items that stayed. If a section jumps from
 * fifth to first, it was promoted; the four it passed were merely displaced.
 * Ranks are taken among survivors only, so a newcomer arriving at the top
 * does not make every existing section look as though it dropped, and a
 * removal does not make the sections below it look as though they climbed.
 *
 * Only a handful are returned. Highlighting every section that shifted would
 * turn a considered re-ordering into a light show, which is the opposite of
 * "the interface is thinking".
 *
 * Pure and framework-free, so it can be unit-tested and reused by the Lab.
 */
export function diffStageKeys(
  prev: readonly string[],
  next: readonly string[],
  maxPromoted = 2,
): StageDiff {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);

  const entered = next.filter((k) => !prevSet.has(k));
  const left = prev.filter((k) => !nextSet.has(k));

  const prevRank = new Map<string, number>();
  prev.filter((k) => nextSet.has(k)).forEach((k, i) => prevRank.set(k, i));
  const nextRank = new Map<string, number>();
  next.filter((k) => prevSet.has(k)).forEach((k, i) => nextRank.set(k, i));

  const climbers = [...nextRank.entries()]
    .map(([key, rank]) => ({
      key,
      gain: (prevRank.get(key) ?? rank) - rank,
      at: next.indexOf(key),
    }))
    .filter((c) => c.gain > 0)
    .sort((a, b) => b.gain - a.gain || a.at - b.at)
    .map((c) => c.key);

  const promoted = [...climbers, ...entered].slice(0, Math.max(0, maxPromoted));
  const changed = prev.length !== next.length || prev.some((k, i) => k !== next[i]);

  return { entered, left, promoted, changed };
}

/**
 * When each item should start moving, in seconds, for one evolution.
 *
 * The promoted item goes first, then its neighbours follow top to bottom a
 * few frames apart, so the list reads as making room for it. The delay is
 * capped: the last item starts moving within `STAGGER.max` however long the
 * list is.
 */
export function staggerDelays(
  keys: readonly string[],
  promoted: ReadonlySet<string>,
): Map<string, number> {
  const delays = new Map<string, number>();
  keys.forEach((key, index) => {
    delays.set(
      key,
      promoted.has(key) ? 0 : Math.min(STAGGER.lead + index * STAGGER.step, STAGGER.max),
    );
  });
  return delays;
}

/** An item that sits somewhere else than it did, as far as its peers are concerned. */
export interface GhostPick {
  key: string;
  /** Rank among the items present in both orderings, now minus before: negative = moved up. */
  delta: number;
}

/**
 * Which items leave a ghost at their old slot when one ordering becomes another (Time-Scrub, Try-On).
 *
 * Ranks are taken among survivors only, like `diffStageKeys`, so a newcomer arriving at the top does not make
 * every neighbour a "mover". The biggest travellers win and only a few are returned: three faint outlines
 * explain a re-order, a dozen of them are noise.
 */
export function pickGhosts(prev: readonly string[], next: readonly string[], max = 3): GhostPick[] {
  const nextSet = new Set(next);
  const prevSet = new Set(prev);
  const prevRank = new Map<string, number>();
  prev.filter((k) => nextSet.has(k)).forEach((k, i) => prevRank.set(k, i));
  const out: GhostPick[] = [];
  next
    .filter((k) => prevSet.has(k))
    .forEach((key, rank) => {
      const delta = rank - (prevRank.get(key) ?? rank);
      if (delta !== 0) out.push({ key, delta });
    });
  return out
    .sort(
      (a, b) => Math.abs(b.delta) - Math.abs(a.delta) || prev.indexOf(a.key) - prev.indexOf(b.key),
    )
    .slice(0, Math.max(0, max));
}
