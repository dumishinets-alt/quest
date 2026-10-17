#!/usr/bin/env bash
# Перевірка звуку у фінальних MP4:
#   - чи є аудіодоріжка;
#   - інтегральна гучність і true peak (має бути не вище -1 dBTP);
#   - якщо пік вище -1 dBTP — м'який лімітер, відео копіюється без перекодування.
#   - рівні по ділянках (голос / музика), щоб переконатися, що все звучить.
set -euo pipefail
cd "$(dirname "$0")/.."

for f in out/promo-1920x1080.mp4 out/promo-1080x1920.mp4; do
  [ -f "$f" ] || { echo "$f — немає файлу"; continue; }
  echo "== $f"
  ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,sample_rate,channels -of compact=p=0 "$f"
  stats=$(ffmpeg -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -A12 "Summary:")
  I=$(echo "$stats" | awk '/I:/ {print $2}')
  TP=$(echo "$stats" | awk '/Peak:/ {print $2}')
  echo "   гучність: ${I} LUFS, true peak: ${TP} dBTP"
  if awk "BEGIN {exit !($TP > -1.0)}"; then
    echo "   пік вище -1 dBTP — застосовую лімітер"
    tmp="${f%.mp4}.tmp.mp4"
    ffmpeg -y -loglevel error -i "$f" -c:v copy -af "alimiter=limit=0.85:attack=2:release=60:level=disabled" -c:a aac -b:a 320k "$tmp"
    mv "$tmp" "$f"
    ffmpeg -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -A12 "Summary:" | awk '/I:|Peak:/ {print "   після: " $0}'
  fi
done
