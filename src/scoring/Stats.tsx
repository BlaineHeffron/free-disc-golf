import { useState } from 'react';
import { formatToPar } from './rounds';
import { courseSummaries, playerNames, playerSummary } from './stats';
import { listRounds } from './storage';
import './scoring.css';

const one = (n: number | null) => (n === null ? '—' : n.toFixed(1));
const signed = (n: number | null) => (n === null ? '—' : formatToPar(Math.round(n * 10) / 10));
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function Stats({ onBack }: { onBack: () => void }) {
  const [rounds] = useState(listRounds);
  const names = playerNames(rounds);
  const [name, setName] = useState(names[0] ?? '');
  const [courseId, setCourseId] = useState<string | null>(null);
  const s = playerSummary(rounds, name);
  const courses = courseSummaries(rounds, name);
  const course = courses.find((c) => c.courseId === courseId);

  return (
    <section className="scoring">
      <header className="row">
        <button onClick={() => (course ? setCourseId(null) : onBack())} aria-label="Back">‹</button>
        <strong>{course ? course.courseName : 'Stats'}</strong>
        <span />
      </header>
      {!names.length ? (
        <p>Finish a round to see stats.</p>
      ) : course ? (
        <div className="card-wrap">
          <p>{course.rounds} rounds · best {course.best ?? '—'} · avg {one(course.avgTotal)} ({signed(course.avgToPar)}) · {course.holeCount} holes</p>
          <table className="card">
            <thead><tr><th>#</th><th>Par</th><th>Avg</th><th>To par</th></tr></thead>
            <tbody>
              {course.holes.map((h) => (
                <tr key={h.number}>
                  <td>{h.number}</td><td>{h.par}</td><td>{one(h.avg)}</td>
                  <td className={h.avgToPar === null ? '' : h.avgToPar < 0 ? 'under' : h.avgToPar > 0 ? 'over' : ''}>{signed(h.avgToPar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <select aria-label="Player" value={name} onChange={(e) => setName(e.target.value)}>
            {names.map((n) => <option key={n}>{n}</option>)}
          </select>
          <dl className="overall">
            <div><dt>Rounds</dt><dd>{s.rounds}</dd></div>
            <div><dt>Avg / 18 holes</dt><dd>{signed(s.toParPer18)}</dd></div>
            <div><dt>Last 5 / 18 holes</dt><dd>{signed(s.recentToParPer18)}</dd></div>
            <div><dt>Best round</dt><dd>{s.best ? `${s.best.total} (${formatToPar(s.best.toPar)})` : '—'}</dd></div>
            <div><dt>Birdie or better</dt><dd>{pct(s.birdieOrBetter)}</dd></div>
            <div><dt>Par</dt><dd>{pct(s.par)}</dd></div>
            <div><dt>Bogey</dt><dd>{pct(s.bogey)}</dd></div>
            <div><dt>Double+</dt><dd>{pct(s.doublePlus)}</dd></div>
            <div><dt>Aces</dt><dd>{s.aces}</dd></div>
          </dl>
          {s.best && <small>Best: {s.best.courseName}, {new Date(s.best.startedAt).toLocaleDateString()}</small>}
          <ul className="history">
            {courses.map((c) => (
              <li key={c.courseId}>
                <button className="link" onClick={() => setCourseId(c.courseId)}>{c.courseName}</button>
                <small>{c.rounds} rounds · best {c.best ?? '—'} · avg {one(c.avgTotal)} ({signed(c.avgToPar)})</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
