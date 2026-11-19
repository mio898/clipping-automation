#!/bin/bash
# Sofort nach jedem fertigen Clip: Clip + Text ins Drive, damit nichts bis zum Laufende wartet.
RC="gdrive:Clipping"; CLIP="$HOME/clip"
rclone copy "$CLIP/fertig" "$RC/fertig" --min-size 1b 2>/dev/null
for s in fehlversuche.txt variante_zaehler.txt; do [ -e "$HOME/Clipping/automation/$s" ] && rclone copyto "$HOME/Clipping/automation/$s" "$RC/scripts/state/$s" 2>/dev/null; done
echo "   ⬆️ $1 ins Drive hochgeladen"
