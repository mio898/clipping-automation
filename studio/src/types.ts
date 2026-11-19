import type {Caption} from '@remotion/captions';

export type Box = {x: number; y: number; w: number; h: number};

// Ein Stück aus dem Quellvideo. Mehrere Stücke hintereinander = Jump-Cuts.
export type Segment = {fromSeconds: number; toSeconds: number};

// Zeiten unten beziehen sich immer auf die FERTIGE Clip-Zeitachse (Sekunde 0 = Clip-Anfang).
export type Label = {text: string; fromSeconds: number; toSeconds: number};     // *FAILS*, *FIRST TRY* …
export type Flash = {atSeconds: number; color: string; durationSeconds: number}; // Farbblitz bei Fail/Hype
export type Punch = {fromSeconds: number; toSeconds: number; target: 'face' | 'game'; scale: number};
export type Grade = {fromSeconds: number; style: 'wasted' | 'hype' | 'none'};             // Farbstimmung ab Zeitpunkt
export type Sfx = {file: string; atSeconds: number; volume: number};

export type ClipProps = {
  video: string;
  facecamVideo?: {src: string; width: number; height: number} | null;
  sourceWidth: number;
  sourceHeight: number;
  facecam: Box | null;
  gameplay: Box;
  facecamShare: number;       // Anteil Facecam an der Höhe, Referenz-Short: 0.5
  segments: Segment[];
  labels: Label[];
  captions: Caption[];        // Wort-Untertitel (klein, unten), leer = aus
  flashes: Flash[];
  punches: Punch[];
  grades: Grade[];
  sfx: Sfx[];
  cta: string | null;
  title?: string | null;
  titleSeconds?: number | null;
  // „Dreimacs“-Look: Facecam als Dreieck (vorgerendert per tools/dreieck_maps.py), Spiel dahinter, Schriftzug oben
  facecamTri?: {src: string; tag: string | null; bgBox: Box} | null; // Überschrift nach x Sekunden ausblenden (null = ganzer Clip)
  // Variante A: gesprochener Hook am Anfang, Video dahinter geblurrt
  intro?: {audio: string; durationSeconds: number; text: string; volume?: number} | null;
};

export const clipDuration = (p: ClipProps) =>
  p.segments.reduce((s, x) => s + (x.toSeconds - x.fromSeconds), 0);
