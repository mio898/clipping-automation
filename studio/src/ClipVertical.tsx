import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {CropView} from './CropView';
import {Title} from './Title';
import {Labels} from './Labels';
import {Captions} from './Captions';
import {Intro} from './Intro';
import type {ClipProps, Punch} from './types';

const W = 1080;
const H = 1920;

const GRADES = {
  wasted: 'sepia(0.55) saturate(1.6) hue-rotate(-12deg) contrast(1.15) brightness(1.05)',
  hype: 'saturate(1.5) contrast(1.12)',
  none: undefined,
};

const punchZoom = (punches: Punch[], target: Punch['target'], t: number) =>
  punches.filter((p) => p.target === target).reduce((z, p) => {
    const ramp = 0.12;
    const k = interpolate(t, [p.fromSeconds, p.fromSeconds + ramp, p.toSeconds - ramp, p.toSeconds], [0, 1, 1, 0],
      {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    return z * (1 + (p.scale - 1) * k);
  }, 1);

export const ClipVertical: React.FC<ClipProps> = (p) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = frame / fps;

  const faceH = p.facecam ? Math.round(H * p.facecamShare) : 0;
  const gameH = H - faceH;
  const faceZoom = punchZoom(p.punches, 'face', t);
  const gameZoom = punchZoom(p.punches, 'game', t);
  const grade = [...p.grades].reverse().find((g) => t >= g.fromSeconds);
  const filter = grade ? GRADES[grade.style] : undefined;
  // Variante A: Blur + leiserer Originalton, solange der Hook gesprochen wird
  const introEnd = p.intro ? p.intro.durationSeconds : 0;
  const blur = p.intro ? interpolate(t, [0, introEnd - 0.25, introEnd], [22, 22, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
  const gameVolume = (f: number) => (p.intro ? interpolate(f / fps, [0, introEnd - 0.3, introEnd], [0.18, 0.18, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1);

  // Segmente hintereinander legen (Jump-Cuts)
  let cursor = 0;
  const parts = p.segments.map((s) => {
    const len = Math.round((s.toSeconds - s.fromSeconds) * fps);
    const part = {from: cursor, len, startFrom: Math.round(s.fromSeconds * fps)};
    cursor += len;
    return part;
  });

  return (
    <AbsoluteFill style={{backgroundColor: 'black'}}>
      <AbsoluteFill style={{filter: blur > 0.1 ? `blur(${blur}px) brightness(${1 - blur / 80})` : undefined, transform: blur > 0.1 ? 'scale(1.06)' : undefined}}>
      {parts.map((part, i) => (
        <Sequence key={i} from={part.from} durationInFrames={part.len} layout="none">
          {p.facecam && p.facecamTri && (
            <div style={{position: 'absolute', top: 0, left: 0, width: W, height: faceH, overflow: 'hidden'}}>
              <CropView video={p.video} box={p.facecamTri.bgBox} sourceWidth={p.sourceWidth} sourceHeight={p.sourceHeight}
                width={W} height={faceH} muted startFrom={part.startFrom} filter={filter} />
              <div style={{position: 'absolute', inset: 0, clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
                transform: `scale(${faceZoom})`, transformOrigin: '50% 100%'}}>
                <CropView video={p.facecamTri.src} box={{x: 0, y: 0, w: 1080, h: 960}} sourceWidth={1080} sourceHeight={960}
                  width={W} height={faceH} muted startFrom={part.startFrom} filter={filter} />
              </div>
            </div>
          )}
          {p.facecam && !p.facecamTri && (
            <div style={{position: 'absolute', top: 0, left: 0}}>
              <CropView
                video={p.facecamVideo ? p.facecamVideo.src : p.video}
                box={p.facecamVideo ? {x: 0, y: 0, w: p.facecamVideo.width, h: p.facecamVideo.height} : p.facecam}
                sourceWidth={p.facecamVideo ? p.facecamVideo.width : p.sourceWidth}
                sourceHeight={p.facecamVideo ? p.facecamVideo.height : p.sourceHeight}
                width={W} height={faceH} zoom={faceZoom} muted startFrom={part.startFrom} filter={filter} />
            </div>
          )}
          <div style={{position: 'absolute', top: faceH, left: 0}}>
            <CropView video={p.video} box={p.gameplay} sourceWidth={p.sourceWidth} sourceHeight={p.sourceHeight}
              width={W} height={gameH} zoom={gameZoom} startFrom={part.startFrom} filter={filter} volume={(f: number) => gameVolume(f + part.from)} />
          </div>
        </Sequence>
      ))}
      </AbsoluteFill>

      {p.flashes.map((f, i) => {
        const a = Math.round(f.atSeconds * fps);
        const d = Math.max(2, Math.round(f.durationSeconds * fps));
        const o = interpolate(frame, [a, a + 1, a + d], [0, 0.55, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return <AbsoluteFill key={i} style={{backgroundColor: f.color, opacity: o, mixBlendMode: 'screen'}} />;
      })}

      {p.facecamTri?.tag && (
        <div style={{position: 'absolute', top: 40, width: '100%', textAlign: 'center', fontFamily: '"Arial Rounded MT Bold", "Arial", sans-serif',
          fontSize: 64, color: 'white', letterSpacing: 2, textShadow: '0 3px 10px rgba(0,0,0,0.8)'}}>{p.facecamTri.tag}</div>
      )}
      {p.title && <Title text={p.title} top={150} untilSeconds={p.titleSeconds ?? null} />}
      {p.intro && <Intro text={p.intro.text} durationSeconds={p.intro.durationSeconds} audio={p.intro.audio} volume={p.intro.volume ?? 1} />}
      <Labels labels={p.labels} top={p.facecam ? faceH : H * 0.42} />
      {p.captions.length > 0 && <Captions captions={p.captions} top={H - 420} breaksMs={parts.slice(1).map((x) => Math.round((x.from / fps) * 1000))} />}

      {p.cta && (
        <Sequence from={durationInFrames - Math.round(2.2 * fps)} layout="none">
          <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90}}>
            <div style={{background: '#FF0033', color: 'white', borderRadius: 20, padding: '16px 32px',
              fontFamily: '"Arial Black", sans-serif', fontWeight: 900, fontSize: 48}}>▶ {p.cta}</div>
          </AbsoluteFill>
        </Sequence>
      )}

      {p.sfx.map((s, i) => (
        <Sequence key={i} from={Math.round(s.atSeconds * fps)} layout="none">
          <Audio src={staticFile(s.file)} volume={s.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
