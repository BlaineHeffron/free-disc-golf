import { beforeEach, describe, expect, it } from 'vitest';
import type { Round } from '../types';
import { decodeRounds, encodeRounds, findUnfinished, listRounds, recentPlayers, saveRound } from './storage';

const t0 = Date.UTC(2026, 9, 23, 15, 4, 5) / 1000;
const iso = (s: number) => new Date(s * 1000).toISOString();

function round(pars: number[], names: string[], score: (p: number, h: number) => number | null, start = t0, finished = true): Round {
  const players = names.map((name, i) => ({ id: String(i), name }));
  return {
    id: start.toString(36),
    courseId: 'osm:way/123456789',
    courseName: 'Maple Hill Disc Golf Course',
    holes: pars.map((par, i) => ({ number: i + 1, par })),
    players,
    scores: Object.fromEntries(players.map((p, pi) => [p.id, pars.map((_, h) => score(pi, h))])),
    startedAt: iso(start),
    ...(finished ? { finishedAt: iso(start + 2 * 3600 + 17) } : {}),
  };
}

const par18 = [3, 3, 4, 3, 3, 5, 3, 4, 3, 3, 3, 4, 3, 3, 5, 3, 4, 3];
const realistic = round(par18, ['Blaine', 'Alex', 'Sam', 'Jordan'], (p, h) => par18[h] + ((p + h) % 3) - 1);

beforeEach(() => localStorage.clear());

describe('round codec', () => {
  it('encodes an 18-hole 4-player finished round in 115 chars', () => {
    const text = encodeRounds([realistic]);
    const roundLine = text.split('\n')[3];
    expect(roundLine.length).toBe(115);
    expect(text.length).toBe(188); // whole key: version, course and name tables, round
    expect(JSON.stringify(realistic).length).toBeGreaterThan(850); // same round as JSON, even with 1-char ids
    expect(decodeRounds(text)).toEqual([realistic]);
  });

  it('round-trips null scores, 10+ strokes, and unfinished rounds', () => {
    const r = round([3, 3, 4], ['Ann', 'Bo'], (p, h) => [[null, 12, 35], [1, null, null]][p][h], t0, false);
    expect(decodeRounds(encodeRounds([r]))).toEqual([r]);
  });

  it('round-trips 9- and 27-hole layouts and shares course/name tables across rounds', () => {
    const nine = round(Array(9).fill(3), ['Ann'], () => 3, t0);
    const big = round(Array.from({ length: 27 }, (_, i) => 3 + (i % 3)), ['Ann', 'Cy'], (p, h) => 2 + p + (h % 4), t0 + 99);
    const text = encodeRounds([big, nine]);
    expect(text.split('\n').slice(1, 3)).toEqual(['osm:way/123456789|Maple Hill Disc Golf Course', 'Ann|Cy']);
    expect(decodeRounds(text)).toEqual([big, nine]);
  });

  it('strips separators from names and clamps strokes to 35', () => {
    const r = round([3, 3], ['A|n\nn', '  Émile 🥏 ', ''], (p) => (p === 0 ? 40 : 3));
    const [back] = decodeRounds(encodeRounds([r]));
    expect(back.players.map((p) => p.name)).toEqual(['Ann', '  Émile 🥏 ', '']);
    expect(back.scores['0']).toEqual([35, 35]);
    expect(back.scores['2']).toEqual([3, 3]);
  });

  it('ignores unknown versions and malformed lines', () => {
    expect(decodeRounds('')).toEqual([]);
    expect(decodeRounds('[{"id":"x"}]')).toEqual([]);
    const good = encodeRounds([realistic]);
    expect(decodeRounds(`${good}\n|||\nzz|1|9|333|0|333`)).toEqual([realistic]);
  });
});

describe('storage', () => {
  it('saves, replaces by id, lists most recent first, and derives recent players', () => {
    const a = round([3], ['Ann'], () => 3, t0, false);
    const b = round([3], ['Bo', 'Ann'], () => 2, t0 + 60);
    saveRound(a);
    saveRound(b);
    saveRound({ ...a, scores: { '0': [4] } });
    expect(listRounds().map((r) => r.scores['0'])).toEqual([[4], [2]]);
    expect(findUnfinished(a.courseId)?.id).toBe(a.id);
    expect(recentPlayers()).toEqual(['Ann', 'Bo']);
  });

  it('drops the legacy JSON key without crashing on it', () => {
    localStorage.setItem('dg.rounds', '[{"broken":');
    expect(listRounds()).toEqual([]);
    saveRound(realistic);
    expect(localStorage.getItem('dg.rounds')).toBeNull();
    expect(listRounds()).toEqual([realistic]);
  });
});
