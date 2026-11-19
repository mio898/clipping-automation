#!/bin/bash
# voice.sh <arbeitsordner> "<hook-text>"  → <arbeitsordner>/intro.mp3 (ElevenLabs, Stimme Liam – Mios Wahl 2026-11-19)
K="${ELEVENLABS_API_KEY:-$(cat "$HOME/Clipping/automation/elevenlabs.key" 2>/dev/null)}"; [ -n "$K" ] || { echo "kein ElevenLabs-Schlüssel"; exit 1; }
VOICE=TX3LPaxmHKxFdv7VOQHJ
TEXT=$(jq -Rn --arg t "$2" '$t')
code=$(curl -s -o "$1/intro.mp3" -w "%{http_code}" -H "xi-api-key: $K" -H "Content-Type: application/json" -X POST \
  "https://api.elevenlabs.io/v1/text-to-speech/$VOICE?output_format=mp3_44100_128" \
  -d "{\"text\":$TEXT,\"model_id\":\"eleven_multilingual_v2\",\"language_code\":\"de\",\"voice_settings\":{\"stability\":0.4,\"similarity_boost\":0.8,\"style\":0.35,\"use_speaker_boost\":true}}")
[ "$code" = 200 ] && echo "intro.mp3 ok" || { echo "ElevenLabs Fehler $code: $(head -c 300 "$1/intro.mp3")"; rm -f "$1/intro.mp3"; exit 1; }
