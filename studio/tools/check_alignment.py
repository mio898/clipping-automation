"""Grober, objektiver Timing-Check ohne Handbeschriftung: Liegt am Wortanfang wirklich ein Sprach-Einsatz?
Für jedes Wort: Energie der Stimme (Band 300–3400 Hz) in 120 ms NACH dem Start vs. 120 ms DAVOR.
Ein gut getimtes Wort zeigt meist einen Anstieg oder liegt mitten in Sprache. Vergleich alt (captions.json) vs. neu (captions_aligned.json).
Nutzung: python check_alignment.py <arbeitsordner>
"""
import json, os, sys, wave
import numpy as np

work = sys.argv[1]
with wave.open(os.path.join(work, "audio16k.wav")) as w:
    sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
# einfache Bandpass-Näherung über FFT-Maske, dann 10-ms-Energie
X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / sr); X[(f < 300) | (f > 3400)] = 0
v = np.fft.irfft(X, len(x)); hop = sr // 100
env = np.array([np.sqrt(np.mean(v[i:i + hop] ** 2)) for i in range(0, len(v) - hop, hop)])
floor = np.percentile(env, 30)

def score(caps):
    good = tot = 0; offs = []
    for c in caps:
        if c.get("startMs") is None or not c["text"].strip() or c.get("aligned") is False: continue
        i = int(c["startMs"] / 10); tot += 1
        before = env[max(0, i - 12):i].mean() if i > 0 else 0
        after = env[i:i + 12].mean() if i + 12 <= len(env) else 0
        if after > 1.5 * floor and after >= 0.8 * before: good += 1
        # nächster echter Einsatz (Energie steigt über 2× Grundrauschen) im Umkreis ±1 s
        lo, hi = max(1, i - 100), min(len(env) - 1, i + 100)
        on = [j for j in range(lo, hi) if env[j] > 2 * floor and env[j - 1] <= 2 * floor]
        if on: offs.append(min((j - i) * 10 for j in on) if False else min(on, key=lambda j: abs(j - i)) * 10 - i * 10)
    med = int(np.median(np.abs(offs))) if offs else None
    return tot, good, med

for name in ("captions.json", "captions_aligned.json"):
    p = os.path.join(work, name)
    if os.path.exists(p):
        tot, good, med = score(json.load(open(p)))
        print(f"{name:24s} {tot:4d} Wörter | Start in Sprache: {100*good/max(1,tot):5.1f}% | Abstand zum nächsten Spracheinsatz (Median): {med} ms")
