import type { Course, Player, Round } from '../types';

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function createRound(course: Course, names: string[]): Round {
  const players: Player[] = names.map((name) => ({ id: newId(), name }));
  return {
    id: newId(),
    courseId: course.id,
    courseName: course.name,
    holes: course.holes.map((h) => ({ ...h })),
    players,
    scores: Object.fromEntries(players.map((p) => [p.id, course.holes.map(() => null)])),
    startedAt: new Date().toISOString(),
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

export const finishRound = (round: Round): Round => ({ ...round, finishedAt: new Date().toISOString() });

export const formatToPar = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`);
