#!/bin/bash
# Dauerbereitschaft: launchd startet das alle 3 Minuten. Ohne neue Datei nur ein kurzer Blick in den Ordner – kostet keine Token.
# Grok gibt nur fertige Momente frei → hier wird nur geschnitten. Pro Moment eine eigene, kurze Claude-Sitzung.
# Postet nie etwas.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
AUTO="$HOME/Clipping/automation"; STUDIO="$HOME/Clipping/studio"

CLIP="${CLIP_OVERRIDE:-$(find "$HOME/Library/CloudStorage" -maxdepth 3 -type d -name Clipping \( -path '*Meine Ablage*' -o -path '*My Drive*' \) 2>/dev/null | head -1)}"
if [ -z "$CLIP" ] || [ ! -d "$CLIP/eingang" ]; then
  echo "$(date "+%F %T") Drive-Ordner nicht gefunden. Diagnose: $(ls "$HOME/Library/CloudStorage/"*/ 2>&1 | tr "\n" " ")"; exit 0
fi
cd "$CLIP" || exit 1

# Neue oder angefangene Dateien? Sonst sofort still beenden
[ -n "$(find eingang -maxdepth 2 -name 'momente_*.jsonl' -not -path '*/erledigt/*' -print -quit 2>/dev/null)" ] || exit 0

LOCK="$AUTO/.lock"
if ! mkdir "$LOCK" 2>/dev/null; then exit 0; fi   # läuft schon
trap 'rmdir "$LOCK"' EXIT
command -v caffeinate >/dev/null && caffeinate -dims -w $$ &

mkdir -p eingang/erledigt eingang/in_arbeit arbeit scripts fertig abgelehnt log
cp -f "$AUTO/cut_inbox.sh" "$AUTO/cut_moment_prompt.md" scripts/ 2>/dev/null
LOG="log/$(date +%F).md"; MAX="${MAX_PRO_LAUF:-999}"; GESCHNITTEN=0   # MAX_PRO_LAUF: auf GitHub höchstens N Clips pro Lauf (6-h-Grenze); FEHL="$AUTO/fehlversuche.txt"; touch "$FEHL"
say() { echo "$(date '+%F %T') $*"; echo "- $(date '+%H:%M') $*" >> "$LOG"; }

# Neue Dateien übernehmen (Grok kann währenddessen weitere ablegen – die holt der nächste Durchgang)
for f in eingang/momente_*.jsonl; do [ -e "$f" ] && mv "$f" eingang/in_arbeit/; done

for f in eingang/in_arbeit/momente_*.jsonl; do
  [ -e "$f" ] || continue
  say "Datei $(basename "$f")"
  offen=0
  while IFS= read -r line <&3; do
    [ -z "${line// }" ] && continue
    id=$(jq -r '.id // empty' <<<"$line" 2>/dev/null)
    if ! [[ "$id" =~ ^[A-Za-z0-9_-]+$ ]]; then say "⚠️ Zeile ohne gültige id übersprungen"; continue; fi
    [ -n "$(find fertig -name "$id.mp4" -print -quit)" ] && continue          # schon geschnitten
    if [ "$GESCHNITTEN" -ge "$MAX" ]; then offen=1; continue; fi              # Rest im nächsten Lauf
    [ -e "abgelehnt/$id.txt" ] && continue                                     # Notbremse hat gegriffen
    n=$(grep -cx "$id" "$FEHL"); if [ "$n" -ge 2 ]; then say "⚠️ $id nach 2 Fehlversuchen ausgelassen"; continue; fi

    url=$(jq -r '.vod_url // ""' <<<"$line"); s=$(jq -r '.start_s' <<<"$line"); e=$(jq -r '.end_s' <<<"$line")
    lang=$(jq -r '.language // "de"' <<<"$line"); [ "$lang" = en ] || lang=de
    if [[ "$url" =~ ^https://(www\.)?twitch\.tv/videos/[0-9]+$ ]]; then
      bash "$STUDIO/tools/prep.sh" "$id" "$url" "$s" "$e" "$lang" </dev/null
      [ -d "$STUDIO/whisper.cpp" ] && [ ! -s "$HOME/Clipping/arbeit/$id/captions.json" ] && node "$STUDIO/transcribe.mjs" "$HOME/Clipping/arbeit/$id" "$lang" </dev/null >/dev/null
      # Wortgenaue Zeiten per Forced Alignment (WhisperX) – Grundlage für Untertitel
      [ -s "$HOME/Clipping/arbeit/$id/captions_aligned.json" ] || "$HOME/Clipping/tools/whisperx-venv/bin/python" "$STUDIO/tools/transcribe_aligned.py" "$HOME/Clipping/arbeit/$id" "$lang" </dev/null >/dev/null 2>&1
    fi

    # Variante verteilen: jeder 4. Clip A (Voice-Intro), sonst B (Überschrift, blendet aus) – Mio 2026-11-19
    ZF="$AUTO/variante_zaehler.txt"; z=$(( $(cat "$ZF" 2>/dev/null || echo 0) + 1 )); echo $z > "$ZF"
    if [ $((z % 4)) = 0 ]; then VAR=A; else VAR=B; fi
    GESCHNITTEN=$((GESCHNITTEN+1)); say "✂️ schneide $id (Variante $VAR)"
    antwort=$( { cat "$AUTO/cut_moment_prompt.md"
                 printf '\n\n---\nArbeitsordner (CLIP): %s\nDatum für die Spec: %s\nVariante: %s\nMoment:\n%s\n' "$CLIP" "$(date +%F)" "$VAR" "$line"; } | \
      claude -p --output-format text --settings "$AUTO/settings.json" --permission-mode dontAsk \
        --add-dir "$HOME/Clipping" "$CLIP" 2>&1 )
    if [ -n "$(find fertig -name "$id.mp4" -print -quit)" ]; then say "✅ $id fertig – $(echo "$antwort" | tail -3 | tr '\n' ' ')"
    elif [ -e "abgelehnt/$id.txt" ]; then say "🛑 $id Notbremse: $(head -1 "abgelehnt/$id.txt")"
    else echo "$id" >> "$FEHL"; offen=1; say "❌ $id kein Clip entstanden – $(echo "$antwort" | tail -2 | tr '\n' ' ')"; fi
  done 3< "$f"
  # Fertig, wenn nichts mehr offen ist (Fehlversuche werden beim nächsten Durchgang noch einmal probiert)
  [ "$offen" = 0 ] && mv "$f" eingang/erledigt/ && say "Datei $(basename "$f") erledigt"
done

# Rohmaterial 3 Tage aufheben (für Korrekturen nach Mios Feedback)
find "$HOME/Clipping/arbeit" -mindepth 1 -maxdepth 1 -type d -name 'twitch-*' -mtime +3 -exec rm -rf {} + 2>/dev/null
