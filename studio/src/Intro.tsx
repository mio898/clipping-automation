import {AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// Variante A: großer Hook-Text mittig, während eine Stimme ihn spricht. Das Video dahinter ist geblurrt (ClipVertical).
export const Intro: React.FC<{text: string; durationSeconds: number; audio: string; volume: number}> = ({text, durationSeconds, audio, volume}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const end = Math.round(durationSeconds * fps);
  const pop = spring({frame, fps, config: {damping: 13, stiffness: 170}});
  const out = interpolate(frame, [end - 8, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <>
      <Audio src={staticFile(audio)} volume={volume} />
      <Sequence durationInFrames={end} layout="none">
        <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: '0 70px', opacity: Math.min(pop, out)}}>
          <div style={{
            fontFamily: '"Arial Black", sans-serif', fontWeight: 900, fontSize: 86, lineHeight: 1.08, textAlign: 'center',
            color: 'white', textTransform: 'uppercase', WebkitTextStroke: '10px black', paintOrder: 'stroke',
            transform: `scale(${interpolate(pop, [0, 1], [0.75, 1])})`, textShadow: '0 10px 30px rgba(0,0,0,0.6)',
          }}>{text}</div>
        </AbsoluteFill>
      </Sequence>
    </>
  );
};
