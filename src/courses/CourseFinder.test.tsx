import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CourseFinder } from './CourseFinder';
import type { CourseRow } from './osm';

const dataset: { courses: CourseRow[] } = {
  courses: [
    ['n5001', 'Backyard Baskets', 45.59, -122.6, 9], // ~10 km
    ['n5002', 'Faraway Woods', 46.5, -122.6, 18], // ~111 km
    ['w1001', 'Pier Park DGC', 45.5, -122.6, [[1, 3, 45.4992, -122.601, 45.4997, -122.601], [2, 4]]],
  ],
};

function stubGeolocation(lat: number, lng: number) {
  const geolocation = {
    getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition),
  };
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('CourseFinder', () => {
  it('recognizes the course the user is standing at from the bundled dataset and starts it', async () => {
    stubGeolocation(45.5002, -122.6);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(dataset)));
    vi.stubGlobal('fetch', fetchMock);
    const onSelect = vi.fn();
    render(<CourseFinder onSelect={onSelect} />);

    expect(await screen.findByRole('heading', { name: "You're at Pier Park DGC" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/courses.json');
    expect(screen.getByRole('link', { name: 'Improve this course on OpenStreetMap' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/way/1001',
    );
    expect(screen.getByRole('button', { name: /Backyard Baskets.*9 holes · 10\.0 km/ })).toBeInTheDocument();
    expect(screen.queryByText('Faraway Woods')).not.toBeInTheDocument(); // beyond 50 km
    expect(screen.getByText(/OpenStreetMap contributors/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'osm:way/1001', name: 'Pier Park DGC' }));
    expect(onSelect.mock.calls[0][0].holes).toEqual([
      { number: 1, par: 3, lengthMeters: 56, tee: { lat: 45.4992, lng: -122.601 }, basket: { lat: 45.4997, lng: -122.601 } },
      { number: 2, par: 4 },
    ]);
  });

  it('searches the whole dataset by name without a location', async () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(dataset)));
    render(<CourseFinder onSelect={vi.fn()} />);
    expect(await screen.findByText(/Location unavailable/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Loading course data…')).not.toBeInTheDocument());
    expect(screen.queryByText('Faraway Woods')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search courses'), { target: { value: 'woods' } });
    expect(screen.getByRole('button', { name: /Faraway Woods/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search courses'), { target: { value: 'zzz' } });
    expect(screen.getByText('No courses match.')).toBeInTheDocument();
  });

  it('reports when the dataset cannot be loaded', async () => {
    stubGeolocation(45.5, -122.6);
    vi.stubGlobal('fetch', async () => Promise.reject(new TypeError('Failed to fetch')));
    render(<CourseFinder onSelect={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Course data unavailable');
  });

  it('falls back to a custom course when location is denied', () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: (_: PositionCallback, fail: PositionErrorCallback) => fail({ code: 1 } as GeolocationPositionError) },
      configurable: true,
    });
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(dataset)));
    const onSelect = vi.fn();
    render(<CourseFinder onSelect={onSelect} />);
    expect(screen.getByText(/Location unavailable/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Course name'), { target: { value: 'Back Field' } });
    fireEvent.change(screen.getByLabelText('Hole count'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create & start' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Back Field', source: 'custom', holes: expect.any(Array) }));
    expect(onSelect.mock.calls[0][0].holes).toHaveLength(9);
  });
});
