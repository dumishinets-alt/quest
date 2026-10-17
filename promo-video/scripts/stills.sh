#!/usr/bin/env bash
# Контрольні кадри з кожної сцени в обох форматах -> out/stills/
# Кадри рахуються з таймлайну config.ts (тож працюють і після подовження сцен під голос).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/stills
FRAMES=$(node scripts/export-timeline.mts 2>/dev/null | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const t=JSON.parse(s), S=t.scenes;
  const shots={
    "s1-iskra": S.s1.from + S.s1.duration - 40,
    "s2-zapusk": S.s2.from + 62,
    "s2-glitch": S.s2.from + 100,
    "s2-litera-P": S.s2.from + 165,
    "s3-nazva": S.s3.from + 160,
    "s4-terminal": S.s4.from + t.enter + 60,
    "s5-tezy": S.s5.from + 165,
    "s6-final": S.s6.from + t.s6Flash - 15,
  };
  console.log(Object.entries(shots).map(([k,v])=>k+":"+v).join(" "));
});')
for comp in Promo PromoVertical; do
  for item in $FRAMES; do
    name=${item%%:*}; frame=${item##*:}
    npx remotion still "$comp" "out/stills/${comp}-${name}.png" --frame="$frame" --log=error
    echo "out/stills/${comp}-${name}.png (кадр $frame)"
  done
done
