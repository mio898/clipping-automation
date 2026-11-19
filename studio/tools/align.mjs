// Findet die Verschiebung (Sekunden), um die "lang" später beginnt als "ref" fehlt: lang[t+shift] == ref[t]
import {execFileSync} from 'node:child_process';
const [ref, lang] = process.argv.slice(2);
const SR = 1000;
const pcm = f => { const b = execFileSync('ffmpeg',['-v','error','-i',f,'-t','40','-ac','1','-ar','8000','-f','s16le','-'],{maxBuffer:1e9});
  const s = new Int16Array(b.buffer,b.byteOffset,b.length/2); const n = Math.floor(s.length/8); const e = new Float64Array(n);
  for (let i=0;i<n;i++){let a=0;for(let j=0;j<8;j++)a+=Math.abs(s[i*8+j]);e[i]=a;} const m=e.reduce((x,y)=>x+y)/n; return e.map(v=>v-m); };
const A = pcm(ref), B = pcm(lang); const L = 20000; let best=-Infinity, bl=0;
for (let lag=0; lag<=12*SR; lag++){ let s=0; const n=Math.min(L, B.length-lag); for(let i=0;i<n;i++) s+=A[i]*B[i+lag]; if(s>best){best=s;bl=lag;} }
console.log((bl/SR).toFixed(3));
