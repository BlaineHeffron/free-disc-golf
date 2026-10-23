import { useState } from 'react';
import type { Course } from './types';
import { CourseFinder } from './courses/CourseFinder';
import { ScoringApp } from './scoring/ScoringApp';
import { Stats } from './scoring/Stats';

export default function App() {
  const [course, setCourse] = useState<Course | null>(null);
  const [stats, setStats] = useState(false);
  return (
    <main className="app">
      <header className="top">
        <h1>Free Disc Golf</h1>
        {!course && !stats && <button onClick={() => setStats(true)}>Stats</button>}
      </header>
      {course ? (
        <ScoringApp course={course} onExit={() => setCourse(null)} />
      ) : stats ? (
        <Stats onBack={() => setStats(false)} />
      ) : (
        <CourseFinder onSelect={setCourse} />
      )}
    </main>
  );
}
