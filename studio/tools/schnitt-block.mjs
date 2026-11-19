// Baut den SCHNITT:-Block für die <id>.txt – damit später ausgewertet werden kann, welcher Schnitt am besten läuft.
// Alles Messbare wird aus den echten Render-Daten (props) berechnet, nur hook_typ und pointe kommen aus der Spec.
// Nutzung als Modul: schnittBlock(spec, props)  ·  als CLI (nachtragen): node tools/schnitt-block.mjs <arbeitsordner> <txt-datei>
import fs from 'node:fs';
import path from 'node:path';

export const HOOK_TYPEN = ['Frage', 'Zitat', 'Aussage', 'Schock'];
const r1 = (x) => Math.round(x * 10) / 10;

export function schnittBlock(spec, props) {
  const segs = props.segments;
  let acc = 0;
  const map = segs.map((s) => { const m = {...s, at: acc}; acc += s.toSeconds - s.fromSeconds; return m; });
  const total = acc;
  const toClip = (t) => { for (const m of map) if (t >= m.fromSeconds - 1e-6 && t <= m.toSeconds + 1e-6) return m.at + (t - m.fromSeconds); return null; };

  const hook = HOOK_TYPEN.includes(spec.hook_typ) ? spec.hook_typ : `❓ nicht gesetzt (erlaubt: ${HOOK_TYPEN.join('/')})`;
  const p = typeof spec.pointe === 'number' ? toClip(spec.pointe) : null;
  const pointe = p !== null ? r1(p) : '❓ nicht gesetzt';

  const sfx = [...props.sfx].sort((a, b) => a.atSeconds - b.atSeconds)
    .map((x) => `${path.basename(x.file, '.wav')}@${r1(x.atSeconds)}`);
  const cuts = Math.max(0, segs.length - 1);
  const capStil = props.captions.length
    ? 'Wort für Wort, Arial Black 58px, GROSSBUCHSTABEN, weiß mit schwarzer Kontur, aktives Wort gelb'
    : 'keine';

  return [
    'SCHNITT:',
    `variante: ${spec.variante ?? 'B'}${spec.intro ? ' (Voice-Intro: "' + spec.intro.text + '")' : ''}`,
    `hook_typ: ${hook}`,
    `pointe_sekunde: ${pointe}`,
    `soundeffekte: ${sfx.length ? sfx.join(', ') : 'keine'} (name@sekunde; pop = Label-Wechsel, whoosh = Jump-Cut)`,
    `zooms: ${props.punches.length}`,
    `untertitel_stil: ${capStil}`,
    `schnitt_tempo: ${r1((cuts / Math.max(1, total)) * 10)} (${cuts} harte Schnitte; dazu ${props.labels.length} Label-Wechsel, ${props.flashes.length} Blitze)`,
    `laenge_sek: ${r1(total)}`,
  ].join('\n');
}

// Alten SCHNITT-Block entfernen, neuen anhängen
export function mitSchnitt(text, block) {
  return text.replace(/\n*SCHNITT:\n[\s\S]*$/, '').trimEnd() + '\n\n' + block + '\n';
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const [work, txt] = process.argv.slice(2);
  const spec = JSON.parse(fs.readFileSync(path.join(work, 'spec.json'), 'utf8'));
  const props = JSON.parse(fs.readFileSync(path.join(work, 'props.json'), 'utf8'));
  fs.writeFileSync(txt, mitSchnitt(fs.readFileSync(txt, 'utf8'), schnittBlock(spec, props)));
  console.log('SCHNITT eingetragen:', txt);
}
