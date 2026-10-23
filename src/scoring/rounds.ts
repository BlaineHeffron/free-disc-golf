import type { Course, Player, Round } from '../types';

// Times are whole seconds and ids are derived from them so rounds survive the compact storage codec unchanged.
const nowSeconds = () => Math.floor(Date.now() / 1000);
const isoAt = (s: number) => new Date(s * 1000).toISOString();

export function createRound(course: Course, names: string[]): Round {
  const players: Player[] = names.map((name, i) => ({ id: String(i), name }));
  const start = nowSeconds();
  return {
    id: start.toString(36),
    courseId: course.id,
    courseName: course.name,
    holes: course.holes.map((h) => ({ ...h })),
    players,
    scores: Object.fromEntries(players.map((p) => [p.id, course.holes.map(() => null)])),
    startedAt: isoAt(start),
  };
}

export function setStroke(round: Round, playerId: string, hole: number, strokes: number | null): Round {
  const row = [...round.scores[playerId]];
  row[hole] = strokes === null ? null : Math.max(1, strokes);
  return { ...round, scores: { ...round.scores, [playerId]: row } };
}

export function setPar(round: Round, hole: number, par: number): Round {
  return { ...round, holes: round.holes.map((h, i) => (i === hole ? { ...h, par: Math.max(1, par) } : h)) };
}

export interface Stats {
  player: Player;
  total: number;
  toPar: number; // relative to par over entered holes only
  thru: number;
}

export function playerStats(round: Round, player: Player): Stats {
  let total = 0, par = 0, thru = 0;
  round.scores[player.id].forEach((s, i) => {
    if (s === null) return;
    total += s;
    par += round.holes[i].par;
    thru++;
  });
  return { player, total, toPar: total - par, thru };
}

/** Best (lowest) score relative to par first; ties broken by more holes played. */
export function leaderboard(round: Round): Stats[] {
  return round.players.map((p) => playerStats(round, p)).sort((a, b) => a.toPar - b.toPar || b.thru - a.thru);
}

export const finishRound = (round: Round): Round => ({ ...round, finishedAt: isoAt(nowSeconds()) });

export const formatToPar = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`);
