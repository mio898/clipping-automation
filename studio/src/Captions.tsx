import {useMemo} from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Caption} from '@remotion/captions';

type Token = {text: string; fromMs: number; toMs: number};
type Page = {startMs: number; endMs: number; tokens: Token[]};

// Eigene Seitenaufteilung: neue Seite bei Pause > 350 ms, nach 4 Wörtern, nach 1,6 s oder an einem Jump-Cut.
const buildPages = (captions: Caption[], breaksMs: number[]): Page[] => {
  const pages: Page[] = [];
  let cur: Page | null = null;
  let words = 0;
  for (const c of captions) {
    const isWord = /\w/.test(c.text) && /^\s/.test(c.text);
    const crossesCut = cur && breaksMs.some((b) => cur!.startMs < b && c.startMs >= b);
    const gap = cur ? c.startMs - cur.endMs : 0;
    if (!cur || crossesCut || (isWord && (gap > 350 || words >= 4 || c.startMs - cur.startMs > 1600))) {
      cur = {startMs: c.startMs, endMs: c.endMs, tokens: []};
      pages.push(cur);
      words = 0;
    }
    cur.tokens.push({text: cur.tokens.length === 0 ? c.text.trimStart() : c.text, fromMs: c.startMs, toMs: c.endMs});
    cur.endMs = Math.max(cur.endMs, c.endMs);
    if (isWord) words++;
  }
  return pages;
};

const PageView: React.FC<{page: Page; top: number}> = ({page, top}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nowMs = page.startMs + (frame / fps) * 1000;
  return (
    <AbsoluteFill style={{top, height: 140, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{fontFamily: '"Arial Black", sans-serif', fontWeight: 900, fontSize: 58, textAlign: 'center',
        padding: '0 70px', color: 'white', WebkitTextStroke: '8px black', paintOrder: 'stroke', textTransform: 'uppercase'}}>
        {page.tokens.map((t, i) => (
          <span key={i} style={{color: nowMs >= t.fromMs && nowMs < Math.max(t.toMs, t.fromMs + 120) ? '#FFD400' : 'white'}}>{t.text}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{captions: Caption[]; top: number; breaksMs: number[]}> = ({captions, top, breaksMs}) => {
  const {fps} = useVideoConfig();
  const pages = useMemo(() => buildPages(captions, breaksMs), [captions, breaksMs]);
  return (
    <>
      {pages.map((page, i) => {
        const next = pages[i + 1];
        const endMs = Math.min(next ? next.startMs : Infinity, page.endMs + 250);
        return (
          <Sequence key={i} from={Math.round((page.startMs / 1000) * fps)}
            durationInFrames={Math.max(1, Math.round(((endMs - page.startMs) / 1000) * fps))} layout="none">
            <PageView page={page} top={top} />
          </Sequence>
        );
      })}
    </>
  );
};
