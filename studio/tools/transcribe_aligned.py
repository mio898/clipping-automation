"""Wortgenaue Untertitel: WhisperX (faster-whisper) transkribiert, dann Forced Alignment per wav2vec2-Phonemmodell.
Nutzung:  whisperx-venv/bin/python transcribe_aligned.py <arbeitsordner> <de|en>
Schreibt  <arbeitsordner>/captions_aligned.json  im selben Format wie captions.json (Remotion-Caption: text mit führendem Leerzeichen).
Wörter, die das Alignment nicht zuordnen kann (z. B. Zahlen), bekommen KEINE geschätzte Zeit, sondern werden markiert (aligned=false),
damit build-clip.mjs sie weglassen kann statt sie falsch einzublenden.
"""
import json, os, sys

import whisperx

work, lang = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "de")
wav = os.path.join(work, "audio16k.wav")
if not os.path.exists(wav):
    import subprocess
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", os.path.join(work, "raw.mp4"), "-ar", "16000", "-ac", "1", wav], check=True)

audio = whisperx.load_audio(wav)
model = whisperx.load_model("large-v3-turbo", "cpu", compute_type="int8", language=lang)
result = model.transcribe(audio, batch_size=8, language=lang)
align_model, meta = whisperx.load_align_model(language_code=lang, device="cpu")
aligned = whisperx.align(result["segments"], align_model, meta, audio, "cpu", return_char_alignments=False)

caps = []
for seg in aligned["segments"]:
    for w in seg.get("words", []):
        ok = "start" in w and "end" in w
        caps.append({
            "text": " " + w["word"].strip(),
            "startMs": round(w["start"] * 1000) if ok else None,
            "endMs": round(w["end"] * 1000) if ok else None,
            "timestampMs": None,
            "confidence": w.get("score"),
            "aligned": ok,
        })
with open(os.path.join(work, "captions_aligned.json"), "w") as f:
    json.dump(caps, f, ensure_ascii=False)
with open(os.path.join(work, "transcript_aligned.txt"), "w") as f:
    f.write("".join(f"[{c['startMs']/1000:.2f}]{c['text']}" if c["aligned"] else f"[?]{c['text']}" for c in caps))
print(os.path.basename(work.rstrip("/")), len(caps), "Wörter,", sum(c["aligned"] for c in caps), "ausgerichtet")
