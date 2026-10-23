import type { Round } from '../types';

const ROUNDS = 'dg.rounds';
const PLAYERS = 'dg.recentPlayers';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable or full: the app keeps working in memory
  }
}

/** All saved rounds, newest first. */
export const listRounds = (): Round[] => read<Round[]>(ROUNDS, []);

export function saveRound(round: Round) {
  write(ROUNDS, [round, ...listRounds().filter((r) => r.id !== round.id)]);
}

export const findUnfinished = (courseId: string) =>
  listRounds().find((r) => r.courseId === courseId && !r.finishedAt);

export const recentPlayers = (): string[] => read<string[]>(PLAYERS, []);

export function rememberPlayers(names: string[]) {
  write(PLAYERS, [...new Set([...names, ...recentPlayers()])].slice(0, 12));
}
