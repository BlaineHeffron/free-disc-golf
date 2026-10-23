import { describe, expect, it } from 'vitest';
import type { Course } from '../types';
import { createRound, finishRound, formatToPar, leaderboard, playerStats, setPar, setStroke } from './rounds';

const course: Course = {
  id: 'custom:1',
  name: 'Test Park',
  location: { lat: 0, lng: 0 },
  holes: [3, 3, 4].map((par, i) => ({ number: i + 1, par })),
  source: 'custom',
};

describe('rounds', () => {
  it('creates a round with empty scores and a hole snapshot', () => {
    const r = createRound(course, ['Ann', 'Bo']);
    expect(r.players.map((p) => p.name)).toEqual(['Ann', 'Bo']);
    expect(r.scores[r.players[0].id]).toEqual([null, null, null]);
    expect(r.holes).not.toBe(course.holes);
    expect(r.finishedAt).toBeUndefined();
  });

  it('sets, clamps, and clears strokes without mutating', () => {
    const r = createRound(course, ['Ann']);
    const id = r.players[0].id;
    const r2 = setStroke(r, id, 1, 0);
    expect(r2.scores[id]).toEqual([null, 1, null]);
    expect(r.scores[id]).toEqual([null, null, null]);
    expect(setStroke(r2, id, 1, null).scores[id]).toEqual([null, null, null]);
  });

  it('computes totals and to-par over entered holes only', () => {
    let r = createRound(course, ['Ann']);
    const p = r.players[0];
    r = setStroke(r, p.id, 0, 2);
    r = setStroke(r, p.id, 2, 6);
    expect(playerStats(r, p)).toMatchObject({ total: 8, toPar: 1, thru: 2 });
  });

  it('par edits change the snapshot and to-par, not the course', () => {
    let r = createRound(course, ['Ann']);
    const p = r.players[0];
    r = setPar(setStroke(r, p.id, 0, 4), 0, 4);
    expect(r.holes[0].par).toBe(4);
    expect(course.holes[0].par).toBe(3);
    expect(playerStats(r, p).toPar).toBe(0);
  });

  it('sorts leaderboard by to-par, then holes played', () => {
    let r = createRound(course, ['Ann', 'Bo', 'Cy']);
    const [a, b, c] = r.players;
    r = setStroke(r, a.id, 0, 4); // +1
    r = setStroke(r, b.id, 0, 2); // -1
    r = setStroke(r, c.id, 0, 3);
    r = setStroke(r, c.id, 1, 5); // +2
    expect(leaderboard(r).map((s) => s.player.name)).toEqual(['Bo', 'Ann', 'Cy']);
    r = setStroke(r, a.id, 1, 2); // Ann E thru 2, ties nobody
    r = setStroke(r, b.id, 1, 4); // Bo E thru 2
    expect(leaderboard(r).map((s) => s.player.name).slice(0, 2)).toEqual(['Ann', 'Bo']);
  });

  it('finishes a round and formats to-par', () => {
    expect(finishRound(createRound(course, ['Ann'])).finishedAt).toBeTruthy();
    expect([formatToPar(0), formatToPar(2), formatToPar(-3)]).toEqual(['E', '+2', '-3']);
  });
});
