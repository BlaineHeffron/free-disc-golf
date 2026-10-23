import type { Round } from '../types';

/*
 Compact round storage: one localStorage key, `dg`, holding newline-separated text.

   line 1   format version: "dg1"
   line 2   course table:  id|name|id|name…   (a course is referenced by its pair index)
   line 3   name table:    name|name|…        (a player is referenced by index)
   line 4+  one round per line, most recently saved first:
              start|end|course|pars|player|scores|player|scores…
     start   start time, epoch seconds in base36 (also the round id)
     end     seconds from start to finish in base36; empty while unfinished
     course  base36 index into the course table
     pars    one base36 char per hole (1-9, a-z); hole count = its length
     player  base36 index into the name table
     scores  one char per hole: 1-9, a-z (10–35), '.' = not entered

 Names and ids have '|' and line breaks stripped; strokes and pars clamp to 1–35;
 holes are numbered 1..n and per-hole lengths/coordinates are not kept.
 An 18-hole, 4-player finished round is ~115 chars (see storage.test.ts).
*/
const KEY = 'dg';
const VERSION = 'dg1';
const LEGACY = ['dg.rounds', 'dg.recentPlayers'];

const clean = (s: string) => s.replace(/[|\r\n]/g, '');
const char = (n: number) => Math.min(35, Math.max(1, n)).toString(36);
const seconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const num = (s: string | undefined) => parseInt(s ?? '', 36);

export function encodeRounds(rounds: Round[]): string {
  const courses: string[] = [];
  const names: string[] = [];
  const ref = (table: string[], v: string) => (table.includes(v) ? table.indexOf(v) : table.push(v) - 1).toString(36);
  const lines = rounds.map((r) => {
    const start = seconds(r.startedAt);
    return [
      start.toString(36),
      r.finishedAt ? Math.max(0, seconds(r.finishedAt) - start).toString(36) : '',
      ref(courses, `${clean(r.courseId)}|${clean(r.courseName)}`),
      r.holes.map((h) => char(h.par)).join(''),
      ...r.players.flatMap((p) => [ref(names, clean(p.name)), r.scores[p.id].map((s) => (s === null ? '.' : char(s))).join('')]),
    ].join('|');
  });
  return [VERSION, courses.join('|'), names.join('|'), ...lines].join('\n');
}

export function decodeRounds(text: string): Round[] {
  const [version, courseLine = '', nameLine = '', ...lines] = text.split('\n');
  if (version !== VERSION) return [];
  const courses = courseLine.split('|');
  const names = nameLine.split('|');
  return lines.flatMap((line) => {
    const [start, end, course, pars, ...cards] = line.split('|');
    const t = num(start);
    const c = num(course) * 2;
    if (isNaN(t) || courses[c + 1] === undefined || !pars) return [];
    const players: Round['players'] = [];
    const scores: Round['scores'] = {};
    for (let i = 0; i + 1 < cards.length; i += 2) {
      const id = String(i / 2);
      players.push({ id, name: names[num(cards[i])] ?? '?' });
      scores[id] = [...pars].map((_, h) => num(cards[i + 1][h]) || null);
    }
    const round: Round = {
      id: start,
      courseId: courses[c],
      courseName: courses[c + 1],
      holes: [...pars].map((p, h) => ({ number: h + 1, par: num(p) || 3 })),
      players,
      scores,
      startedAt: new Date(t * 1000).toISOString(),
    };
    if (end) round.finishedAt = new Date((t + num(end)) * 1000).toISOString();
    return [round];
  });
}

/** All saved rounds, most recently saved first. */
export function listRounds(): Round[] {
  try {
    return decodeRounds(localStorage.getItem(KEY) ?? '');
  } catch {
    return [];
  }
}

export function saveRound(round: Round) {
  try {
    localStorage.setItem(KEY, encodeRounds([round, ...listRounds().filter((r) => r.id !== round.id)]));
    LEGACY.forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage unavailable or full: the app keeps working in memory
  }
}

export const findUnfinished = (courseId: string) =>
  listRounds().find((r) => r.courseId === courseId && !r.finishedAt);

/** Distinct player names from saved rounds, most recent first. */
export const recentPlayers = (): string[] =>
  [...new Set(listRounds().flatMap((r) => r.players.map((p) => p.name)))].slice(0, 12);
