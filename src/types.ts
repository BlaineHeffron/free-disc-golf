// Shared contract between the courses and scoring modules.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Hole {
  number: number; // 1-based
  par: number;
  lengthMeters?: number;
  tee?: LatLng;
  basket?: LatLng;
}

export interface Course {
  id: string; // e.g. "osm:way/123456" or "custom:<uuid>"
  name: string;
  location: LatLng; // course centroid
  holes: Hole[]; // may be generated defaults (par 3) when OSM has no hole data
  source: 'osm' | 'custom' | 'layout';
}

export interface Player {
  id: string;
  name: string;
}

export interface Round {
  id: string;
  courseId: string;
  courseName: string;
  holes: Hole[]; // snapshot of the layout played
  players: Player[];
  // scores[playerId][holeIndex] = strokes, or null when not yet entered
  scores: Record<string, (number | null)[]>;
  startedAt: string; // ISO
  finishedAt?: string; // ISO
}
