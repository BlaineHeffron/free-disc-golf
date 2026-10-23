import { useState } from 'react';
import type { Course, Round } from '../types';
import { createRound, finishRound, formatToPar, leaderboard, playerStats, setPar, setStroke } from './rounds';
import { findUnfinished, listRounds, recentPlayers, saveRound } from './storage';
import { Stats } from './Stats';
import './scoring.css';

type View = 'setup' | 'hole' | 'card' | 'done' | 'history' | 'stats';

export function ScoringApp({ course, onExit }: { course: Course; onExit: () => void }) {
  const [view, setView] = useState<View>('setup');
  const [round, setRound] = useState<Round | null>(null);
  const [hole, setHole] = useState(0);

  const update = (r: Round) => {
    setRound(r);
    saveRound(r);
  };
  const open = (r: Round) => {
    setRound(r);
    setHole(Math.max(0, r.holes.findIndex((_, i) => r.players.some((p) => r.scores[p.id][i] === null))));
    setView('hole');
  };

  if (view === 'history') return <History onBack={() => setView(round ? 'done' : 'setup')} />;
  if (view === 'stats') return <Stats onBack={() => setView(round ? 'done' : 'setup')} />;
  if (!round || view === 'setup')
    return (
      <Setup
        course={course}
        onStart={(names) => {
          const r = createRound(course, names);
          update(r);
          open(r);
        }}
        onResume={open}
        onHistory={() => setView('history')}
        onStats={() => setView('stats')}
        onExit={onExit}
      />
    );

  if (view === 'done')
    return (
      <section className="scoring">
        <h2>Final — {round.courseName}</h2>
        <Leaderboard round={round} />
        <Scorecard round={round} />
        <div className="row">
          <button onClick={() => setView('history')}>History</button>
          <button onClick={() => setView('stats')}>Stats</button>
          <button className="primary" onClick={onExit}>Done</button>
        </div>
      </section>
    );

  const last = hole === round.holes.length - 1;
  const h = round.holes[hole];
  return (
    <section className="scoring">
      <header className="row">
        <button onClick={() => setView('setup')} aria-label="Back to setup">‹</button>
        <strong>{round.courseName}</strong>
        <button onClick={() => setView(view === 'card' ? 'hole' : 'card')}>{view === 'card' ? 'Hole' : 'Card'}</button>
      </header>
      {view === 'card' ? (
        <Scorecard round={round} onPick={(i) => { setHole(i); setView('hole'); }} />
      ) : (
        <>
          <div className="hole-head">
            <h2>Hole {h.number}</h2>
            <div className="stepper">
              <button aria-label="Par down" onClick={() => update(setPar(round, hole, h.par - 1))}>−</button>
              <span>Par {h.par}</span>
              <button aria-label="Par up" onClick={() => update(setPar(round, hole, h.par + 1))}>+</button>
            </div>
          </div>
          <ul className="players">
            {round.players.map((p) => {
              const s = round.scores[p.id][hole];
              const st = playerStats(round, p);
              const bump = (d: number) => update(setStroke(round, p.id, hole, s === null ? h.par : s + d));
              return (
                <li key={p.id}>
                  <div className="who">
                    <span>{p.name}</span>
                    <small>{st.thru ? `${formatToPar(st.toPar)} (${st.total}) thru ${st.thru}` : '—'}</small>
                    {s !== null && (
                      <button className="link" aria-label={`Clear ${p.name}`} onClick={() => update(setStroke(round, p.id, hole, null))}>clear</button>
                    )}
                  </div>
                  <button className="big" aria-label={`${p.name} minus`} onClick={() => bump(-1)}>−</button>
                  <output aria-label={`${p.name} strokes`}>{s ?? '·'}</output>
                  <button className="big" aria-label={`${p.name} plus`} onClick={() => bump(1)}>+</button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <nav className="row nav">
        <button disabled={hole === 0} onClick={() => { setHole(hole - 1); setView('hole'); }}>‹ Prev</button>
        {last ? (
          <button className="primary" onClick={() => { update(finishRound(round)); setView('done'); }}>Finish</button>
        ) : (
          <button className="primary" onClick={() => { setHole(hole + 1); setView('hole'); }}>Next ›</button>
        )}
      </nav>
    </section>
  );
}

function Setup(props: {
  course: Course;
  onStart: (names: string[]) => void;
  onResume: (r: Round) => void;
  onHistory: () => void;
  onStats: () => void;
  onExit: () => void;
}) {
  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [recent] = useState(recentPlayers);
  const [unfinished] = useState(() => findUnfinished(props.course.id));
  const add = (n: string) => {
    n = n.trim();
    if (n && !names.includes(n)) setNames([...names, n]);
    setDraft('');
  };

  return (
    <section className="scoring">
      <header className="row">
        <button onClick={props.onExit} aria-label="Back to courses">‹</button>
        <strong>{props.course.name}</strong>
        <span className="row">
          <button onClick={props.onStats}>Stats</button>
          <button onClick={props.onHistory}>History</button>
        </span>
      </header>
      {unfinished && (
        <button className="primary wide" onClick={() => props.onResume(unfinished)}>
          Resume round from {new Date(unfinished.startedAt).toLocaleString()}
        </button>
      )}
      <form className="row" onSubmit={(e) => { e.preventDefault(); add(draft); }}>
        <input aria-label="Player name" placeholder="Player name" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit">Add</button>
      </form>
      <div className="chips">
        {recent.filter((n) => !names.includes(n)).map((n) => (
          <button key={n} onClick={() => add(n)}>+ {n}</button>
        ))}
      </div>
      <ul className="names">
        {names.map((n) => (
          <li key={n}>
            {n} <button aria-label={`Remove ${n}`} onClick={() => setNames(names.filter((x) => x !== n))}>×</button>
          </li>
        ))}
      </ul>
      <button className="primary wide" disabled={!names.length} onClick={() => props.onStart(names)}>
        Start round ({props.course.holes.length} holes)
      </button>
    </section>
  );
}

function Scorecard({ round, onPick }: { round: Round; onPick?: (hole: number) => void }) {
  return (
    <div className="card-wrap">
      <table className="card">
        <thead>
          <tr><th>#</th><th>Par</th>{round.players.map((p) => <th key={p.id}>{p.name}</th>)}</tr>
        </thead>
        <tbody>
          {round.holes.map((h, i) => (
            <tr key={i} onClick={() => onPick?.(i)}>
              <td>{h.number}</td>
              <td>{h.par}</td>
              {round.players.map((p) => {
                const s = round.scores[p.id][i];
                return <td key={p.id} className={s === null ? '' : s < h.par ? 'under' : s > h.par ? 'over' : ''}>{s ?? ''}</td>;
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={2}>Total</th>
            {round.players.map((p) => {
              const st = playerStats(round, p);
              return <th key={p.id}>{st.total} ({formatToPar(st.toPar)})</th>;
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Leaderboard({ round }: { round: Round }) {
  return (
    <ol className="board">
      {leaderboard(round).map((s) => (
        <li key={s.player.id}>
          <span>{s.player.name}</span>
          <strong>{formatToPar(s.toPar)}</strong>
          <small>{s.total} · thru {s.thru}</small>
        </li>
      ))}
    </ol>
  );
}

function History({ onBack }: { onBack: () => void }) {
  const [rounds] = useState(listRounds);
  return (
    <section className="scoring">
      <header className="row">
        <button onClick={onBack} aria-label="Back">‹</button>
        <strong>Round history</strong>
        <span />
      </header>
      {rounds.length === 0 && <p>No rounds yet.</p>}
      <ul className="history">
        {rounds.map((r) => (
          <li key={r.id}>
            <div><strong>{r.courseName}</strong> <small>{new Date(r.startedAt).toLocaleDateString()}{r.finishedAt ? '' : ' · in progress'}</small></div>
            <small>{leaderboard(r).map((s) => `${s.player.name} ${s.total} (${formatToPar(s.toPar)})`).join(' · ')}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
