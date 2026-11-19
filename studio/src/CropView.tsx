import {OffthreadVideo, staticFile} from 'remotion';
import type {Box} from './types';

export const CropView: React.FC<{
  video: string; box: Box; sourceWidth: number; sourceHeight: number;
  width: number; height: number; zoom?: number; muted?: boolean; startFrom: number; filter?: string; volume?: number | ((f: number) => number);
}> = ({video, box, sourceWidth, sourceHeight, width, height, zoom = 1, muted, startFrom, filter, volume}) => {
  const scale = Math.max(width / box.w, height / box.h) * zoom;
  const offsetX = -(box.x + box.w / 2) * scale + width / 2;
  const offsetY = -(box.y + box.h / 2) * scale + height / 2;
  return (
    <div style={{width, height, overflow: 'hidden', position: 'relative'}}>
      <OffthreadVideo
        src={staticFile(video)}
        startFrom={startFrom}
        muted={muted}
        volume={volume}
        style={{position: 'absolute', width: sourceWidth * scale, height: sourceHeight * scale,
          left: offsetX, top: offsetY, maxWidth: 'none', filter}}
      />
    </div>
  );
};
