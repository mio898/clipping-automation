#!/bin/bash
# prep.sh <id> <vod_url> <start_s> <end_s> <lang>  → arbeit/<id>/raw.mp4, offset.txt, captions.json, transcript.txt, sheet.jpg
export PATH="/opt/homebrew/bin:$HOME/.local/bin:$PATH"
id=$1; url=$2; s=$3; e=$4; lang=${5:-de}
D="$HOME/Clipping/arbeit/$id"; mkdir -p "$D"; cd "$D" || exit 1
a=$(python3 -c "print(round(max(0,$s-15),1))"); b=$(python3 -c "print(round($e+5,1))")
echo "$a" > offset.txt
[ -s raw.mp4 ] || yt-dlp -q -f "1080p60/1080p/best" --force-keyframes-at-cuts --download-sections "*$a-$b" \
  --downloader-args "ffmpeg_o:-c:v libx264 -preset slow -crf 12 -pix_fmt yuv420p -c:a aac -b:a 256k" -o "raw.%(ext)s" "$url" 2>&1 | grep -v "JSON metadata"
ffmpeg -v error -y -i raw.mp4 -vf "fps=1/2,scale=480:-1,tile=6x5" -frames:v 1 sheet.jpg
echo "$id geladen: $(ffprobe -v error -show_entries format=duration -of csv=p=0 raw.mp4) s"
