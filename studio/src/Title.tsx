import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

// Feste Überschrift oben (wie bei anderen Clippern): weiße Box, schwarze fette Schrift, ploppt am Anfang rein.
export const Title: React.FC<{text: string; top: number; untilSeconds?: number | null}> = ({text, top, untilSeconds}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame, fps, config: {damping: 14, stiffness: 180}});
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  // Variante B: Überschrift nur am Anfang, dann ausblenden
  const out = untilSeconds ? interpolate(frame, [untilSeconds * fps - 9, untilSeconds * fps], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;
  if (out <= 0) return null;
  return (
    <div style={{position: 'absolute', top, left: 0, width: '100%', display: 'flex', justifyContent: 'center', opacity: Math.min(s, out)}}>
      <div style={{
        maxWidth: 940, background: 'white', color: '#111', borderRadius: 18, padding: "12px 24px",
        fontFamily: '"Arial Black", sans-serif', fontWeight: 900, fontSize: 44, lineHeight: 1.1,
        textAlign: 'center', textTransform: 'uppercase', transform: `scale(${scale})`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
      }}>{text}</div>
    </div>
  );
};
