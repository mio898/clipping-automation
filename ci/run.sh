#!/bin/bash
# GitHub-Lauf: Drive-Ordner "Clipping" spiegeln → schneiden (automation/cut_inbox.sh) → Ergebnisse zurück ins Drive.
# Postet nie etwas. Gibt keine Geheimnisse aus.
set -uo pipefail
RC="gdrive:Clipping"
CLIP="$HOME/clip"            # lokale Arbeitskopie des Drive-Ordners
mkdir -p "$CLIP"/{eingang/in_arbeit,eingang/erledigt,fertig,abgelehnt,log,kampagnen,scripts/state}

neu=$(rclone lsf "$RC/eingang" --include "momente_*.jsonl" --files-only 2>/dev/null)
offen=$(rclone lsf "$RC/eingang/in_arbeit" --include "momente_*.jsonl" --files-only 2>/dev/null)
if [ -z "$neu$offen" ]; then echo "Nichts Neues im Eingang."; echo "arbeit=nein" >> "$GITHUB_OUTPUT"; exit 0; fi
echo "arbeit=ja" >> "$GITHUB_OUTPUT"

# Neue Dateien im Drive als "in Arbeit" markieren (kein Doppellauf)
for f in $neu; do rclone moveto "$RC/eingang/$f" "$RC/eingang/in_arbeit/$f"; done
rclone copy "$RC/eingang/in_arbeit" "$CLIP/eingang/in_arbeit" --include "momente_*.jsonl"
rclone copy "$RC/kampagnen" "$CLIP/kampagnen"
rclone copy "$RC/README_FUER_CLAUDE.md" "$CLIP/" 2>/dev/null
rclone copy "$RC/scripts/state" "$HOME/Clipping/automation/" 2>/dev/null   # fehlversuche.txt, variante_zaehler.txt
# Platzhalter für schon Erledigtes (nur Namen, 0 Byte) – damit nichts doppelt geschnitten wird
rclone lsf -R "$RC/fertig" --include "*.mp4" --files-only | while read -r p; do mkdir -p "$CLIP/fertig/$(dirname "$p")"; : > "$CLIP/fertig/$p"; done
rclone lsf "$RC/abgelehnt" --include "*.txt" --files-only | while read -r p; do : > "$CLIP/abgelehnt/$p"; done

CLIP_OVERRIDE="$CLIP" MAX_PRO_LAUF="${MAX_PRO_LAUF:-4}" bash "$HOME/Clipping/automation/cut_inbox.sh"

# Ergebnisse hochladen (nur echte Dateien, keine 0-Byte-Platzhalter)
rclone copy "$CLIP/fertig" "$RC/fertig" --min-size 1b
rclone copy "$CLIP/abgelehnt" "$RC/abgelehnt" --min-size 1b --ignore-existing
for f in "$CLIP"/log/*.md; do [ -e "$f" ] && rclone copyto "$f" "$RC/log/$(basename "$f" .md)_github-$(date +%H%M).md"; done
for f in "$CLIP"/eingang/erledigt/momente_*.jsonl; do [ -e "$f" ] && rclone moveto "$RC/eingang/in_arbeit/$(basename "$f")" "$RC/eingang/erledigt/$(basename "$f")"; done
for s in fehlversuche.txt variante_zaehler.txt; do [ -e "$HOME/Clipping/automation/$s" ] && rclone copyto "$HOME/Clipping/automation/$s" "$RC/scripts/state/$s"; done
echo "Lauf fertig."
