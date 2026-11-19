// Schärft die Facecam per KI (Real-ESRGAN, Modell realesr-animevideov3 x4) und mischt 40 % Original
// zurück, damit das Gesicht natürlich bleibt. Ergebnis: arbeit/<id>/cam_up.mp4 (gleiche Zeitachse wie raw.mp4).
// Seit 2026-11-19 (Mio): erst schneiden, dann schärfen – nur Frames innerhalb der Spec-Segmente (+0,25 s) gehen durch die KI,
// alle anderen Frames kommen im Clip nie vor und werden nur als Platzhalter gefüllt.
// Aufruf: node tools/upscale-cam.mjs ../arbeit/<id>
import fs from 'node:fs'; import path from 'node:path'; import {execFileSync} from 'node:child_process';
const work = path.resolve(process.argv[2]);
const spec = JSON.parse(fs.readFileSync(path.join(work, 'spec.json'), 'utf8'));
const f = spec.facecam; if (!f) { console.log('keine Facecam – nichts zu tun'); process.exit(0); }
const R = path.resolve(process.env.HOME, 'Clipping/tools/realesrgan');
const raw = path.join(work, 'raw.mp4'), out = path.join(work, 'cam_up.mp4');
const key = JSON.stringify({f, segs: spec.segments});
const keyFile = path.join(work, 'cam_up.key');
if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(raw).mtimeMs && fs.existsSync(keyFile) && fs.readFileSync(keyFile, 'utf8') === key) { console.log('cam_up.mp4 aktuell'); process.exit(0); }
const fin = path.join(work, 'cam_in'), fout = path.join(work, 'cam_out');
for (const d of [fin, fout]) { fs.rmSync(d, {recursive: true, force: true}); fs.mkdirSync(d); }
const W = f.w * 4, H = f.h * 4;
const run = (cmd, args) => execFileSync(cmd, args, {stdio: ['ignore', 'ignore', 'inherit']});
console.log('1/3 Facecam-Frames ausschneiden');
run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-vf', `crop=${f.w}:${f.h}:${f.x}:${f.y}`, '-fps_mode', 'passthrough', path.join(fin, '%06d.png')]);
const fpsStr = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', raw]).toString().trim();
const [fa, fb] = fpsStr.split('/').map(Number); const fpsNum = fb ? fa / fb : fa;
const all = fs.readdirSync(fin).filter((n) => n.endsWith('.png')).sort();
const needed = (n) => { const t = (parseInt(n, 10) - 1) / fpsNum; return spec.segments.some(([a, b]) => t >= a - 0.25 && t <= b + 0.25); };
const fskip = path.join(work, 'cam_skip'); fs.rmSync(fskip, {recursive: true, force: true}); fs.mkdirSync(fskip);
const skipped = all.filter((n) => !needed(n));
for (const n of skipped) fs.renameSync(path.join(fin, n), path.join(fskip, n));
console.log('2/3 KI-Hochskalierung', all.length - skipped.length, 'von', all.length, 'Frames (Rest wird weggeschnitten)');
run(path.join(R, 'realesrgan-ncnn-vulkan'), ['-i', fin, '-o', fout, '-n', 'realesr-animevideov3', '-s', '4', '-m', path.join(R, 'models'), '-j', '2:2:2']);
// Platzhalter für weggeschnittene Frames (werden im Clip nie gezeigt)
if (skipped.length) {
  const ph = path.join(work, 'cam_platzhalter.png');
  run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}`, '-frames:v', '1', ph]);
  for (const n of skipped) fs.copyFileSync(ph, path.join(fout, n));
  fs.rmSync(ph, {force: true});
}
console.log('3/3 Video bauen + 40 % Original einmischen');
const fps = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', raw]).toString().trim();
run('ffmpeg', ['-v', 'error', '-y', '-framerate', fps, '-i', path.join(fout, '%06d.png'), '-i', raw,
  '-filter_complex', `[1:v]crop=${f.w}:${f.h}:${f.x}:${f.y},scale=${W}:${H}:flags=lanczos,format=yuv444p[o];[0:v]scale=${W}:${H},format=yuv444p[u];[o][u]blend=all_expr='A*0.4+B*0.6',format=yuv420p[v]`,
  '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', out]);
for (const d of [fin, fout, fskip]) fs.rmSync(d, {recursive: true, force: true});
fs.writeFileSync(keyFile, key);
console.log('FERTIG', out);
