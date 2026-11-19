import {transcribe, toCaptions} from '@remotion/install-whisper-cpp';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.argv[2]);
process.chdir(path.dirname(new URL(import.meta.url).pathname));
const wav = path.join(dir, 'audio16k.wav');
execFileSync('ffmpeg', ['-loglevel','error','-y','-i', path.join(dir,'raw.mp4'), '-ar','16000','-ac','1', wav]);
const out = await transcribe({inputPath: wav, whisperPath: path.resolve('whisper.cpp'), whisperCppVersion: '1.7.6',
  model: 'large-v3-turbo', tokenLevelTimestamps: true, language: process.argv[3] || 'en', printOutput: false});
const {captions} = toCaptions({whisperCppOutput: out});
fs.writeFileSync(path.join(dir, 'captions.json'), JSON.stringify(captions));
const text = captions.map(c => `[${(c.startMs/1000).toFixed(1)}]${c.text}`).join('');
fs.writeFileSync(path.join(dir, 'transcript.txt'), text);
console.log(path.basename(dir), captions.length, 'Wörter');
