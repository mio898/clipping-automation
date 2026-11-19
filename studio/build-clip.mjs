// Baut aus einer Schnitt-Spezifikation (alle Zeiten in Sekunden ab Anfang von raw.mp4)
// die Remotion-Props (Zeiten auf der fertigen Clip-Zeitachse) und rendert den Clip.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {schnittBlock, mitSchnitt} from './tools/schnitt-block.mjs';

const specPath = path.resolve(process.argv[2]);
process.chdir(path.dirname(new URL(import.meta.url).pathname)); // immer aus dem studio-Ordner arbeiten
const OUT_ARG = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const work = path.dirname(specPath);
const id = path.basename(work);

const segs = spec.segments.map(([a, b]) => ({fromSeconds: a, toSeconds: b}));
let acc = 0;
const map = segs.map((s) => { const m = {...s, at: acc}; acc += s.toSeconds - s.fromSeconds; return m; });
const total = acc;
// raw-Zeit -> Clip-Zeit (null, wenn rausgeschnitten)
const toClip = (t) => { for (const m of map) if (t >= m.fromSeconds - 1e-6 && t <= m.toSeconds + 1e-6) return m.at + (t - m.fromSeconds); return null; };

const CENSOR = [[/fuck/gi, 'f*ck'], [/shit/gi, 'sh*t'], [/bitch/gi, 'b*tch'], [/dick/gi, 'd*ck']];
// Wortgenaue Zeiten aus Forced Alignment (tools/transcribe_aligned.py) bevorzugen; nicht zuordenbare Wörter weglassen statt falsch zeigen
const alignedFile = path.join(work, 'captions_aligned.json');
const useAligned = fs.existsSync(alignedFile);
const rawTokens = JSON.parse(fs.readFileSync(useAligned ? alignedFile : path.join(work, 'captions.json'), 'utf8')).filter((t) => t.aligned !== false && t.startMs !== null);
console.log('Untertitel-Quelle:', useAligned ? 'Forced Alignment' : 'Whisper (ungenau)');
// Whisper liefert Wortteile ("Dig" + "ga", "Quer"+"den"+"ker"): alles ohne führendes Leerzeichen an das vorige Wort hängen
const raw = [];
for (const t of rawTokens) {
  const prev = raw[raw.length - 1];
  if (prev && !/^\s/.test(t.text) && t.startMs - prev.endMs < 400) { prev.text += t.text; prev.endMs = Math.max(prev.endMs, t.endMs); }
  else raw.push({...t});
}
// Whisper-Halluzinationen bei wenig Sprache entfernen: "i", "ii", "i i i", Silben-Reste, dasselbe Wort ≥3× hintereinander
{
  const cleaned = [];
  for (let k = 0; k < raw.length; k++) {
    const w = raw[k].text.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (/^i+$/.test(w)) continue;
    const run = raw.slice(Math.max(0, k - 2), k + 1).map((x) => x.text.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
    if (run.length === 3 && run.every((x) => x === w) && w) continue;
    cleaned.push(raw[k]);
  }
  raw.length = 0; raw.push(...cleaned);
}
const captions = [];
let prevDropped = false;
for (const c of raw) {
  if (prevDropped && /^[\s!?.,]+$/.test(c.text)) continue; // Satzzeichen eines entfernten Worts
  prevDropped = true;
  if (/^\s*\w*--/.test(c.text) || !c.text.trim()) continue;
  if ((spec.dropCaptions ?? []).some(([x, y]) => c.startMs / 1000 >= x && c.startMs / 1000 < y)) continue; // falsch getimte Wörter // Whisper-Artefakte wie "s--"
  const a = toClip(c.startMs / 1000); if (a === null) continue;
  prevDropped = false;
  const b = toClip(Math.min(c.endMs / 1000, map.find((m) => a >= m.at && a <= m.at + m.toSeconds - m.fromSeconds).toSeconds));
  let text = c.text; for (const [r, x] of CENSOR) text = text.replace(r, x);
  captions.push({...c, text, startMs: Math.round(a * 1000), endMs: Math.round(Math.min(b ?? a + 0.3, a + 0.9) * 1000), timestampMs: null});
}

const span = (o) => { const a = toClip(o.from), b = toClip(o.to); return a === null || b === null ? null : [a, b]; };
const labels = spec.labels.map((l) => { const s = span(l); return s && {text: l.text, fromSeconds: s[0], toSeconds: s[1]}; }).filter(Boolean);
const flashes = spec.flashes.map((f) => { const a = toClip(f.at); return a !== null && {atSeconds: a, color: f.color ?? '#ff3b6b', durationSeconds: f.dur ?? 0.35}; }).filter(Boolean);
const punches = spec.punches.map((p) => { const s = span(p); return s && {fromSeconds: s[0], toSeconds: s[1], target: p.target, scale: p.scale}; }).filter(Boolean);
const grades = spec.grades.map((g) => { const a = toClip(g.at); return a !== null && {fromSeconds: a, style: g.style}; }).filter(Boolean);
const sfx = [
  ...spec.sfx.map((x) => ({file: `sfx/${x.file}.wav`, atSeconds: toClip(x.at), volume: x.vol ?? 0.6})),
  // Pop bei jedem Label-Wechsel, Whoosh an jedem Jump-Cut
  // Automatische Pops/Whooshs nur noch mit --auto-sounds (Mio 2026-11-19: zu repetitiv/aufdringlich)
  ...(!process.argv.includes('--auto-sounds') ? [] : [
  ...labels.filter((l) => !spec.sfx.some((x) => Math.abs((toClip(x.at) ?? -9) - l.fromSeconds) < 0.25))
    .map((l) => ({file: 'sfx/pop.wav', atSeconds: l.fromSeconds, volume: 0.35})),
  ...map.slice(1).map((m) => ({file: 'sfx/whoosh.wav', atSeconds: Math.max(0, m.at - 0.2), volume: 0.45})),
  ]),
].filter((x) => x.atSeconds !== null);

const pubDir = path.resolve('public/arbeit'); fs.mkdirSync(pubDir, {recursive: true});
const link = path.join(pubDir, `${id}.mp4`);
fs.rmSync(link, {force: true}); try { fs.linkSync(path.join(work, 'raw.mp4'), link); } catch { fs.copyFileSync(path.join(work, 'raw.mp4'), link); } // immer frisch verlinken, sonst bleibt alte Quelle hängen
// KI-geschärfte Facecam (tools/upscale-cam.mjs), falls vorhanden
let facecamVideo = null;
if (spec.facecam && !process.argv.includes('--ohne-upscale') && !process.env.OHNE_UPSCALE) {
  execFileSync('node', [path.resolve('tools/upscale-cam.mjs'), work], {stdio: 'inherit'});
  const camLink = path.join(pubDir, `${id}_cam.mp4`);
  fs.rmSync(camLink, {force: true}); try { fs.linkSync(path.join(work, 'cam_up.mp4'), camLink); } catch { fs.copyFileSync(path.join(work, 'cam_up.mp4'), camLink); }
  facecamVideo = {src: `arbeit/${id}_cam.mp4`, width: spec.facecam.w * 4, height: spec.facecam.h * 4};
}

// Variante A: gesprochener Hook (spec.intro = {audio: "intro.mp3" im Arbeitsordner, text}) – Länge aus der Audiodatei
let intro = null;
if (spec.intro) {
  const src = path.join(work, spec.intro.audio);
  const dst = path.join(pubDir, `${id}_intro${path.extname(src)}`);
  fs.copyFileSync(src, dst);
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString());
  intro = {audio: `arbeit/${path.basename(dst)}`, text: spec.intro.text, durationSeconds: Math.round((dur + 0.35) * 100) / 100, volume: spec.intro.volume ?? 1};
}
// Streamer-Stil „Dreieck“ (Mio 2026-11-19: Trymacs immer als „Dreimacs“) – Profil streamer/<name>.json → "dreieck": {...}
let facecamTri = null;
const streamerName = id.split('-')[1];
const profilPath = path.join(path.resolve('..'), 'streamer', `${streamerName}.json`);
const dreieck = fs.existsSync(profilPath) ? JSON.parse(fs.readFileSync(profilPath, 'utf8')).dreieck : null;
if (dreieck && facecamVideo && spec.dreieck !== false) {
  const tri = path.join(work, 'cam_tri.mp4');
  const camUp = path.join(work, 'cam_up.mp4');
  if (!fs.existsSync(tri) || fs.statSync(tri).mtimeMs < fs.statSync(camUp).mtimeMs) {
    const cw = facecamVideo.width, ch = facecamVideo.height;
    const k = Math.max(1080 / cw, 960 / ch) * (dreieck.zoom ?? 1.6);
    const sw = Math.round(cw * k / 2) * 2, sh = Math.round(ch * k / 2) * 2;
    const cx = Math.max(0, Math.min(sw - 1080, Math.round(sw * (dreieck.fx ?? 0.5) - 540)));
    const cy = Math.max(0, Math.min(sh - 960, Math.round(sh * (dreieck.fy ?? 0.3) - 480)));
    const faceX = Math.round(sw * (dreieck.fx ?? 0.5) - cx);
    execFileSync(path.resolve('../tools/whisperx-venv/bin/python'), [path.resolve('tools/dreieck_maps.py'), '1080', '960', work, String(faceX), String(dreieck.R ?? 380), String(dreieck.y1 ?? 0.95)]);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', camUp, '-i', path.join(work, 'xmap.pgm'), '-i', path.join(work, 'ymap.pgm'),
      '-filter_complex', `[0]scale=${sw}:${sh},crop=1080:960:${cx}:${cy}[c];[c][1][2]remap=fill=black`, '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p', tri]);
  }
  const triLink = path.join(pubDir, `${id}_tri.mp4`);
  fs.rmSync(triLink, {force: true}); try { fs.linkSync(tri, triLink); } catch { fs.copyFileSync(tri, triLink); }
  // Ganze Cam-Fläche = verzerrte Cam (nur der Kopf ist ein Dreieck, Rest normal) – kein Schriftzug, kein Gameplay dahinter (Mio 2026-11-19)
  facecamVideo = {src: `arbeit/${id}_tri.mp4`, width: 1080, height: 960};
  console.log('Facecam-Stil: Dreieck');
}
const props = {
  video: `arbeit/${id}.mp4`, sourceWidth: 1920, sourceHeight: 1080,
  facecam: spec.facecam, facecamVideo, gameplay: spec.gameplay, facecamShare: 0.5,
  segments: segs, labels, captions, flashes, punches, grades, sfx, cta: spec.cta, title: spec.title ?? null, titleSeconds: spec.titleSeconds ?? null, intro, facecamTri,
};
// Untertitel nur mit --mit-untertiteln (Mio 2026-11-19: Timing stimmt nicht – aus, bis Forced Alignment bewiesen ist)
if (!process.argv.includes('--mit-untertiteln') || !useAligned) { captions.length = 0; console.log(useAligned ? 'Untertitel aus (Standard)' : 'Untertitel aus (kein Forced Alignment vorhanden)'); }
// Zu wenig echte Sprache im Clip → lieber gar keine Untertitel als falsche
const wordsPerSec = captions.length / Math.max(1, total);
if (captions.length && (captions.length < 12 || wordsPerSec < 0.6)) {
  console.log(`WARNUNG: nur ${captions.length} Wörter in ${total.toFixed(1)} s – Untertitel werden weggelassen. Moment ohne Sprache → prüfen, ob er überhaupt taugt.`);
  captions.length = 0;
}
fs.writeFileSync(path.join(work, 'props.json'), JSON.stringify(props, null, 1));
console.log(id, 'Länge', total.toFixed(1), 's,', labels.length, 'Labels,', captions.length, 'Wörter,', sfx.length, 'Sounds');

const tmp = path.join(work, 'render.mp4');
execFileSync('npx', ['remotion', 'render', 'src/index.ts', 'ClipVertical', tmp, `--props=${path.join(work, 'props.json')}`, '--log=error', '--crf=18', '--timeout=120000', '--concurrency=2'], {stdio: 'inherit'});
// Lautheit auf Social-Standard (-14 LUFS) bringen, Video unverändert kopieren
const outDir = path.join(OUT_ARG || process.env.CLIP_OUT || path.resolve('..'), 'fertig', spec.date); fs.mkdirSync(outDir, {recursive: true}); // CLIP_OUT = Drive-Ordner im Automatik-Lauf
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', path.join(outDir, `${id}.mp4`)]);
fs.writeFileSync(path.join(outDir, `${id}.txt`), mitSchnitt(spec.text, schnittBlock(spec, props))); // SCHNITT-Block für die Auswertung
console.log('FERTIG', path.join(outDir, `${id}.mp4`));
