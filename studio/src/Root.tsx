import {Composition} from 'remotion';
import {ClipVertical} from './ClipVertical';
import {clipDuration, type ClipProps} from './types';

const FPS = 60;

// Testdaten im Stil des Referenz-Shorts (Kai Cenat Zug-Mission)
export const defaultClip: ClipProps = {
  video: 'test/test.mp4',
  sourceWidth: 1920,
  sourceHeight: 1080,
  facecam: {x: 1440, y: 0, w: 480, h: 300},
  gameplay: {x: 420, y: 0, w: 1080, h: 1080},
  facecamShare: 0.5,
  segments: [{fromSeconds: 0, toSeconds: 3}, {fromSeconds: 4.5, toSeconds: 8}],
  labels: [
    {text: 'Easiest mission', fromSeconds: 0, toSeconds: 1.4},
    {text: 'First try', fromSeconds: 1.4, toSeconds: 2.6},
    {text: 'Fails', fromSeconds: 2.6, toSeconds: 3.8},
    {text: 'Second try', fromSeconds: 3.8, toSeconds: 5.4},
    {text: 'Failed mission', fromSeconds: 5.4, toSeconds: 6.5},
  ],
  captions: [],
  flashes: [{atSeconds: 2.6, color: '#ff3b6b', durationSeconds: 0.35}],
  punches: [
    {fromSeconds: 2.6, toSeconds: 3.6, target: 'face', scale: 1.18},
    {fromSeconds: 5.4, toSeconds: 6.5, target: 'face', scale: 1.25},
  ],
  grades: [{fromSeconds: 5.4, style: 'wasted'}],
  sfx: [],
  cta: null,
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="ClipVertical"
    component={ClipVertical}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={Math.round(clipDuration(defaultClip) * FPS)}
    defaultProps={defaultClip}
    calculateMetadata={({props}) => ({durationInFrames: Math.round(clipDuration(props) * FPS)})}
  />
);
