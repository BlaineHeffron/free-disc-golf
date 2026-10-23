import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Course } from '../types';
import { ScoringApp } from './ScoringApp';
import { listRounds } from './storage';

const course: Course = {
  id: 'custom:park',
  name: 'Test Park',
  location: { lat: 0, lng: 0 },
  holes: [3, 4].map((par, i) => ({ number: i + 1, par })),
  source: 'custom',
};

const addPlayer = (name: string) => {
  fireEvent.change(screen.getByLabelText('Player name'), { target: { value: name } });
  fireEvent.click(screen.getByText('Add'));
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('ScoringApp', () => {
  it('adds players, scores holes, shows totals and final leaderboard', () => {
    const onExit = vi.fn();
    render(<ScoringApp course={course} onExit={onExit} />);
    addPlayer('Ann');
    addPlayer('Bo');
    fireEvent.click(screen.getByText(/Start round/));

    expect(screen.getByText('Hole 1')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Ann plus')); // first tap = par
    expect(screen.getByLabelText('Ann strokes')).toHaveTextContent('3');
    fireEvent.click(screen.getByLabelText('Ann minus'));
    expect(screen.getByLabelText('Ann strokes')).toHaveTextContent('2');
    fireEvent.click(screen.getByLabelText('Bo minus')); // first tap = par
    fireEvent.click(screen.getByLabelText('Bo plus'));
    expect(screen.getByText('-1 (2) thru 1')).toBeInTheDocument();
    expect(screen.getByText('+1 (4) thru 1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Next ›'));
    fireEvent.click(screen.getByLabelText('Par up'));
    expect(screen.getByText('Par 5')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Ann plus'));
    expect(screen.getByLabelText('Ann strokes')).toHaveTextContent('5');

    fireEvent.click(screen.getByText('Card'));
    expect(screen.getByText('7 (-1)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Finish'));
    const board = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(board[0]).toContain('Ann');
    expect(board[1]).toContain('Bo');
    expect(listRounds()[0].finishedAt).toBeTruthy();
    fireEvent.click(screen.getByText('Done'));
    expect(onExit).toHaveBeenCalled();
  });

  it('remembers players and resumes an unfinished round', () => {
    render(<ScoringApp course={course} onExit={() => {}} />);
    addPlayer('Ann');
    fireEvent.click(screen.getByText(/Start round/));
    fireEvent.click(screen.getByLabelText('Ann plus'));
    cleanup();

    render(<ScoringApp course={course} onExit={() => {}} />);
    expect(screen.getByText('+ Ann')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Resume round/));
    expect(screen.getByText('Hole 2')).toBeInTheDocument();
    expect(screen.getByText('E (3) thru 1')).toBeInTheDocument();
  });

  it('clears a stroke with the visible control and shows stats after finished rounds', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 5, 1));
    const play = (hole1: string[], hole2: string[]) => {
      render(<ScoringApp course={course} onExit={() => {}} />);
      addPlayer('Ann');
      fireEvent.click(screen.getByText(/Start round/));
      hole1.forEach((b) => fireEvent.click(screen.getByLabelText(b === 'Clear' ? 'Clear Ann' : `Ann ${b}`)));
      fireEvent.click(screen.getByText('Next ›'));
      hole2.forEach((b) => fireEvent.click(screen.getByLabelText(`Ann ${b}`)));
      fireEvent.click(screen.getByText('Finish'));
    };
    play(['plus', 'Clear', 'plus', 'minus'], ['plus']); // 3, cleared (next tap starts at par again), then 2, 4 → -1
    cleanup();
    vi.setSystemTime(Date.UTC(2026, 5, 2));
    play(['plus'], ['plus', 'plus']); // 3, 5 → +1
    vi.useRealTimers();

    fireEvent.click(screen.getByText('Stats'));
    const tile = (label: string) => screen.getByText(label).nextElementSibling;
    expect(tile('Rounds')).toHaveTextContent('2');
    expect(tile('Avg / 18 holes')).toHaveTextContent('E');
    expect(tile('Best round')).toHaveTextContent('6 (-1)');
    expect(tile('Birdie or better')).toHaveTextContent('25%');
    fireEvent.click(screen.getByText('Test Park'));
    const rows = screen.getAllByRole('row').map((r) => r.textContent);
    expect(rows.slice(1)).toEqual(['132.5-0.5', '244.5+0.5']);
  });
});
