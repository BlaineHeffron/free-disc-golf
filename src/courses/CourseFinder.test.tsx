import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CourseFinder } from './CourseFinder';
import { overpassFixture } from './fixture.test-data';

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
  it('recognizes the course the user is standing at and starts it', async () => {
    stubGeolocation(45.5002, -122.6);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(overpassFixture)));
    vi.stubGlobal('fetch', fetchMock);
    const onSelect = vi.fn();
    render(<CourseFinder onSelect={onSelect} />);

    expect(await screen.findByRole('heading', { name: "You're at Pier Park DGC" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByText('Backyard Baskets')).toBeInTheDocument();
    expect(screen.getByText(/OpenStreetMap contributors/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'osm:way/1001', name: 'Pier Park DGC' }));
    expect(JSON.parse(localStorage.getItem('dg.courses.osm')!)).toHaveLength(3);
  });

  it('falls back to a custom course when location is denied', () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: (_: PositionCallback, fail: PositionErrorCallback) => fail({ code: 1 } as GeolocationPositionError) },
      configurable: true,
    });
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
