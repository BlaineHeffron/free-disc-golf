import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Course, LatLng } from '../types';
import { formatDistance, haversine, recognize } from './geo';
import { fetchCourses } from './overpass';
import { LayoutError, readLayoutFile } from './layout';
import './courses.css';

const CACHE_KEY = 'dg.courses.osm';
const CUSTOM_KEY = 'dg.courses.custom';
const LAYOUT_KEY = 'dg.courses.layouts';

function load(key: string): Course[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as Course[];
  } catch {
    return [];
  }
}
function save(key: string, courses: Course[]) {
  try {
    localStorage.setItem(key, JSON.stringify(courses));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

type Status = 'locating' | 'loading' | 'ready' | 'denied' | 'error';

export function CourseFinder({ onSelect }: { onSelect: (course: Course) => void }) {
  const [osm, setOsm] = useState(() => load(CACHE_KEY));
  const [custom, setCustom] = useState(() => load(CUSTOM_KEY));
  const [layouts, setLayouts] = useState(() => load(LAYOUT_KEY));
  const [pos, setPos] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<Status>('locating');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [newHoles, setNewHoles] = useState(18);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    let live = true;
    if (!navigator.geolocation) {
      setStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!live) return;
        const here = { lat: coords.latitude, lng: coords.longitude };
        setPos(here);
        setStatus('loading');
        fetchCourses(here).then(
          (found) => {
            if (!live) return;
            setOsm(found);
            save(CACHE_KEY, found);
            setStatus('ready');
          },
          (e: unknown) => {
            if (!live) return;
            setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Course lookup timed out');
            setStatus('error');
          },
        );
      },
      () => live && setStatus('denied'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
    return () => {
      live = false;
    };
  }, []);

  const all = useMemo(() => [...layouts, ...custom, ...osm], [layouts, custom, osm]);
  const here = pos ? recognize(osm, pos) : null;
  const list = all
    .filter((c) => c !== here?.course && c.name.toLowerCase().includes(query.trim().toLowerCase()))
    .map((course) => ({ course, meters: pos ? haversine(pos, course.location) : null }))
    .sort((a, b) => (a.meters ?? 0) - (b.meters ?? 0) || a.course.name.localeCompare(b.course.name));

  function createCustom(e: FormEvent) {
    e.preventDefault();
    const count = Math.max(1, Math.min(99, Math.round(newHoles) || 18));
    const course: Course = {
      id: `custom:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name: newName.trim() || 'Custom course',
      location: pos ?? { lat: 0, lng: 0 },
      holes: Array.from({ length: count }, (_, i) => ({ number: i + 1, par: 3 })),
      source: 'custom',
    };
    const next = [course, ...custom];
    setCustom(next);
    save(CUSTOM_KEY, next);
    onSelect(course);
  }

  async function importLayout(file: File | undefined) {
    if (!file) return;
    try {
      const course = await readLayoutFile(file);
      const next = [course, ...layouts.filter((c) => c.id !== course.id)];
      setLayouts(next);
      save(LAYOUT_KEY, next);
      setImportError('');
    } catch (e: unknown) {
      setImportError(e instanceof LayoutError ? e.message : 'Could not read that layout file');
    }
  }

  return (
    <section className="course-finder">
      {status === 'locating' && <p className="cf-status">Finding your location…</p>}
      {status === 'loading' && <p className="cf-status">Looking for nearby courses…</p>}
      {status === 'denied' && (
        <p className="cf-status">Location unavailable. Search saved courses or create a custom one.</p>
      )}
      {status === 'error' && (
        <p className="cf-status cf-error" role="alert">
          {error}. {osm.length ? 'Showing saved courses.' : ''}
        </p>
      )}

      {here && (
        <div className="cf-here">
          <h2>You're at {here.course.name}</h2>
          <p>{here.course.holes.length} holes</p>
          <button className="primary" onClick={() => onSelect(here.course)}>
            Start
          </button>
        </div>
      )}

      <input
        className="cf-search"
        type="search"
        placeholder="Search courses"
        aria-label="Search courses"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="cf-list">
        {list.map(({ course, meters }) => (
          <li key={course.id}>
            <button onClick={() => onSelect(course)}>
              <span className="cf-name">{course.name}</span>
              <span className="cf-meta">
                {course.holes.length} holes
                {meters !== null && course.source === 'osm' ? ` · ${formatDistance(meters)}` : ''}
                {course.source === 'custom' ? ' · custom' : ''}
                {course.source === 'layout' ? ' · saved layout' : ''}
              </span>
            </button>
          </li>
        ))}
        {!list.length && status === 'ready' && !here && <li className="cf-empty">No courses found within 25 km.</li>}
      </ul>

      <form className="cf-custom" onSubmit={createCustom}>
        <h3>Create custom course</h3>
        <input aria-label="Course name" placeholder="Course name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input
          aria-label="Hole count"
          type="number"
          min={1}
          max={99}
          value={newHoles}
          onChange={(e) => setNewHoles(e.target.valueAsNumber)}
        />
        <button type="submit">Create &amp; start</button>
      </form>

      <div className="cf-import">
        <label htmlFor="cf-layout-file">Import course layout (.json)</label>
        <input
          id="cf-layout-file"
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            void importLayout(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {importError && (
          <p className="cf-error" role="alert">
            {importError}
          </p>
        )}
      </div>

      <p className="cf-attribution">
        Course data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
      </p>
    </section>
  );
}
