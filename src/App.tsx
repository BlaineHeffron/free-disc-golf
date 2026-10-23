import { useState } from 'react';
import type { Course } from './types';
import { CourseFinder } from './courses/CourseFinder';
import { ScoringApp } from './scoring/ScoringApp';

export default function App() {
  const [course, setCourse] = useState<Course | null>(null);
  return (
    <main className="app">
      <h1>Free Disc Golf</h1>
      {course ? (
        <ScoringApp course={course} onExit={() => setCourse(null)} />
      ) : (
        <CourseFinder onSelect={setCourse} />
      )}
    </main>
  );
}
