import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Label} from './types';

const One: React.FC<{text: string; top: number}> = ({text, top}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 11, stiffness: 260}});
  // lange Labels kleiner setzen, damit nichts am Rand abgeschnitten wird (Impact ≈ 0,5 em pro Großbuchstabe)
  const size = Math.min(84, Math.floor(960 / ((text.length + 2) * 0.5)));
  return (
    <AbsoluteFill style={{top: top - 62, height: 124, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{
        transform: `scale(${0.6 + 0.4 * pop})`,
        fontFamily: 'Impact, "Anton", "Arial Black", sans-serif', fontSize: size, letterSpacing: 1,
        color: 'white', WebkitTextStroke: '12px black', paintOrder: 'stroke',
        textShadow: '0 4px 14px rgba(0,0,0,0.55)', textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>*{text}*</div>
    </AbsoluteFill>
  );
};

export const Labels: React.FC<{labels: Label[]; top: number}> = ({labels, top}) => {
  const {fps} = useVideoConfig();
  return (
    <>
      {labels.map((l, i) => (
        <Sequence key={i} from={Math.round(l.fromSeconds * fps)}
          durationInFrames={Math.max(1, Math.round((l.toSeconds - l.fromSeconds) * fps))} layout="none">
          <One text={l.text} top={top} />
        </Sequence>
      ))}
    </>
  );
};
