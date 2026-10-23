import { describe, expect, it } from 'vitest';
import type { Round } from '../types';
import { courseSummaries, playerNames, playerSummary } from './stats';

let clock = 0;
function round(courseId: string, pars: number[], cards: Record<string, (number | null)[]>, finished = true): Round {
  const names = Object.keys(cards);
  const start = new Date(Date.UTC(2026, 0, 1) + ++clock * 86400000).toISOString();
  return {
    id: String(clock),
    courseId,
    courseName: `Course ${courseId}`,
    holes: pars.map((par, i) => ({ number: i + 1, par })),
    players: names.map((name, i) => ({ id: String(i), name })),
    scores: Object.fromEntries(names.map((n, i) => [String(i), cards[n]])),
    startedAt: start,
    ...(finished ? { finishedAt: start } : {}),
  };
}

describe('stats', () => {
  it('matches players by trimmed case-insensitive name and ignores unfinished rounds', () => {
    const rounds = [
      round('a', [3, 3], { ann: [2, 3], Bo: [3, 3] }),
      round('a', [3, 3], { ' Ann ': [4, 4] }),
      round('a', [3, 3], { Cy: [3, 3] }, false),
    ].reverse(); // storage order: newest first
    expect(playerNames(rounds)).toEqual(['Ann', 'Bo']); // latest spelling, trimmed
    expect(playerSummary(rounds, 'ANN').rounds).toBe(2);
    expect(playerSummary(rounds, 'Cy').rounds).toBe(0);
  });

  it('computes overall to-par per 18, rates, aces, best and recent trend', () => {
    const rounds = [
      round('a', [3, 3, 3], { Ann: [1, 3, 5] }), // -2 +0 +2 → E over 3
      round('a', [3, 3, 3], { Ann: [4, 4, null] }), // +2 over 2 holes, incomplete
      round('b', [3, 4], { Ann: [2, 4] }), // -1, best complete by to-par
      ...Array.from({ length: 5 }, () => round('b', [3, 4], { Ann: [3, 4] })), // last 5: all par
    ];
    const s = playerSummary(rounds, 'Ann');
    expect(s.rounds).toBe(8);
    expect(s.holes).toBe(17);
    expect(s.toParPer18).toBeCloseTo((1 / 17) * 18);
    expect(s.recentToParPer18).toBe(0);
    expect(s.best).toMatchObject({ courseName: 'Course b', total: 6, toPar: -1 });
    expect([s.birdieOrBetter, s.par, s.bogey, s.doublePlus]).toEqual([2 / 17, 12 / 17, 2 / 17, 1 / 17]);
    expect(s.aces).toBe(1);
  });

  it('summarizes courses with per-hole averages for the latest layout only', () => {
    const rounds = [
      round('a', [3, 3], { Ann: [2, 4] }),
      round('b', [3], { Ann: [3] }),
      round('a', [3, 4], { Ann: [3, null] }), // incomplete: per-hole only
      round('a', [3, 3, 3], { Ann: [9, 9, 9] }), // other layout: counted as a round only
      round('a', [3, 3], { Ann: [4, 3] }), // latest at a
    ];
    const [a, b] = courseSummaries(rounds, 'Ann');
    expect(b).toMatchObject({ courseId: 'b', rounds: 1, best: 3, avgTotal: 3, avgToPar: 0 });
    expect(a).toMatchObject({ courseId: 'a', rounds: 4, holeCount: 2, best: 6, avgTotal: 6.5, avgToPar: 0.5 });
    expect(a.holes).toEqual([
      { number: 1, par: 3, avg: 3, avgToPar: 0 },
      { number: 2, par: 3, avg: 3.5, avgToPar: 0.5 },
    ]);
  });

  it('returns empty stats for unknown players', () => {
    expect(playerSummary([], 'Nobody')).toMatchObject({ rounds: 0, toParPer18: null, best: null, aces: 0 });
    expect(courseSummaries([], 'Nobody')).toEqual([]);
  });
});
