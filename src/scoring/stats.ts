import type { Round } from '../types';

// Aggregates over finished rounds only. Players match across rounds by case-insensitive trimmed name.
// Holes without an entered score are excluded everywhere; a "complete" card has every hole scored.

export const playerKey = (name: string) => name.trim().toLowerCase();

interface Card {
  round: Round;
  scores: (number | null)[];
}

const complete = (c: Card) => c.scores.every((s) => s !== null);
const total = (c: Card) => c.scores.reduce<number>((t, s) => t + (s ?? 0), 0);
const toPar = (c: Card) => c.scores.reduce<number>((t, s, i) => t + (s === null ? 0 : s - c.round.holes[i].par), 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const played = (cs: Card[]) => cs.flatMap((c) => c.scores.flatMap((s, i) => (s === null ? [] : [{ s, d: s - c.round.holes[i].par }])));

/** Average strokes relative to par per hole played, scaled to 18 holes. */
const per18 = (cs: Card[]) => {
  const d = avg(played(cs).map((h) => h.d));
  return d === null ? null : d * 18;
};

/** A player's cards from finished rounds, oldest first, skipping cards with nothing entered. */
function cards(rounds: Round[], name: string): Card[] {
  const k = playerKey(name);
  return rounds
    .filter((r) => r.finishedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .flatMap((round) => round.players.filter((p) => playerKey(p.name) === k).map((p) => ({ round, scores: round.scores[p.id] })))
    .filter((c) => c.scores.some((s) => s !== null));
}

/** Distinct players in finished rounds (latest spelling), in the given round order. */
export function playerNames(rounds: Round[]): string[] {
  const names = new Map<string, string>();
  rounds.filter((r) => r.finishedAt).forEach((r) => r.players.forEach((p) => {
    if (!names.has(playerKey(p.name))) names.set(playerKey(p.name), p.name.trim());
  }));
  return [...names.values()];
}

export interface PlayerSummary {
  rounds: number;
  holes: number; // holes with a score
  toParPer18: number | null; // average to par, normalized to 18 holes
  recentToParPer18: number | null; // same, over the last 5 rounds
  best: { courseName: string; startedAt: string; total: number; toPar: number } | null; // lowest to par among complete cards
  // fractions of holes played
  birdieOrBetter: number;
  par: number;
  bogey: number;
  doublePlus: number;
  aces: number;
}

export function playerSummary(rounds: Round[], name: string): PlayerSummary {
  const cs = cards(rounds, name);
  const holes = played(cs);
  const rate = (f: (d: number) => boolean) => (holes.length ? holes.filter((h) => f(h.d)).length / holes.length : 0);
  const best = cs.filter(complete).sort((a, b) => toPar(a) - toPar(b))[0];
  return {
    rounds: cs.length,
    holes: holes.length,
    toParPer18: per18(cs),
    recentToParPer18: per18(cs.slice(-5)),
    best: best ? { courseName: best.round.courseName, startedAt: best.round.startedAt, total: total(best), toPar: toPar(best) } : null,
    birdieOrBetter: rate((d) => d < 0),
    par: rate((d) => d === 0),
    bogey: rate((d) => d === 1),
    doublePlus: rate((d) => d > 1),
    aces: holes.filter((h) => h.s === 1).length,
  };
}

export interface CourseSummary {
  courseId: string;
  courseName: string;
  rounds: number; // all finished rounds here
  holeCount: number; // layout of the latest round; totals and per-hole stats use only rounds with this hole count
  best: number | null; // lowest total, complete cards
  avgTotal: number | null; // complete cards
  avgToPar: number | null; // per round, complete cards
  holes: { number: number; par: number; avg: number | null; avgToPar: number | null }[]; // par from the latest round
}

/** Per-course stats for a player, most recently played course first. */
export function courseSummaries(rounds: Round[], name: string): CourseSummary[] {
  const byCourse = new Map<string, Card[]>();
  cards(rounds, name).reverse().forEach((c) => byCourse.set(c.round.courseId, [...(byCourse.get(c.round.courseId) ?? []), c]));
  return [...byCourse.values()].map((cs) => {
    const latest = cs[0].round;
    const same = cs.filter((c) => c.scores.length === latest.holes.length);
    const full = same.filter(complete);
    return {
      courseId: latest.courseId,
      courseName: latest.courseName,
      rounds: cs.length,
      holeCount: latest.holes.length,
      best: full.length ? Math.min(...full.map(total)) : null,
      avgTotal: avg(full.map(total)),
      avgToPar: avg(full.map(toPar)),
      holes: latest.holes.map((h, i) => {
        const hs = same.flatMap((c) => (c.scores[i] === null ? [] : [{ s: c.scores[i]!, d: c.scores[i]! - c.round.holes[i].par }]));
        return { number: h.number, par: h.par, avg: avg(hs.map((x) => x.s)), avgToPar: avg(hs.map((x) => x.d)) };
      }),
    };
  });
}
