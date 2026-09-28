#!/usr/bin/env bash
# Builds apps/player/public/demo/demo.zip from the phrases below using espeak-ng + ffmpeg.
# Only needed to regenerate the demo pack; the result is committed to the repo.
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/audio" apps/player/public/demo

phrases=(
  "Guten Morgen!|Good morning!"
  "Wie komme ich zum Bahnhof?|How do I get to the train station?"
  "Ich hätte gern einen Kaffee, bitte.|I would like a coffee, please."
  "Können Sie das bitte wiederholen?|Could you repeat that, please?"
  "Wo ist die nächste Apotheke?|Where is the nearest pharmacy?"
  "Vielen Dank für Ihre Hilfe.|Thank you very much for your help."
)

csv="$tmp/phrases.csv"
echo "file,text,translation,transcription,notes" > "$csv"
i=0
for p in "${phrases[@]}"; do
  i=$((i + 1))
  text=${p%%|*}
  tr=${p#*|}
  n=$(printf '%03d' "$i")
  espeak-ng -v de -s 140 -w "$tmp/$n.wav" "$text"
  ipa=$(espeak-ng -v de -q --ipa "$text" | tr -s ' \n' ' ' | sed 's/^ //; s/ $//')
  ffmpeg -loglevel error -y -i "$tmp/$n.wav" -ac 1 -ar 22050 -b:a 64k "$tmp/audio/$n.mp3"
  printf 'audio/%s.mp3,"%s","%s","[%s]",\n' "$n" "$text" "$tr" "$ipa" >> "$csv"
done

cat > "$tmp/pack.json" <<JSON
{ "id": "demo-de-en", "title": "Demo: German (espeak)", "lang": { "target": "de", "native": "en" } }
JSON

rm -f apps/player/public/demo/demo.zip
(cd "$tmp" && zip -q -0 -r "$OLDPWD/apps/player/public/demo/demo.zip" pack.json phrases.csv audio)
echo "apps/player/public/demo/demo.zip:"
unzip -l apps/player/public/demo/demo.zip
