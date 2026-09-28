#!/usr/bin/env bash
# Builds apps/player/public/demo/demo.zip (pack format v1) from the phrases below
# using espeak-ng + ffmpeg. Only needed to regenerate the demo pack; the result is committed.
set -euo pipefail
cd "$(dirname "$0")/.."

out=apps/player/public/demo/demo.zip
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/audio" "$(dirname "$out")"

# text|translation|literal|notes|repeats
phrases=(
  "Guten Morgen!|Good morning!|Good morning!||"
  "Wie komme ich zum Bahnhof?|How do I get to the train station?|How come I to-the station?|zum = zu dem|2"
  "Ich hätte gern einen Kaffee, bitte.|I would like a coffee, please.|I would-have gladly a coffee, please.|hätte gern — a polite way to order|"
  "Können Sie das bitte wiederholen?|Could you repeat that, please?|Can you that please repeat?||2"
  "Wo ist die nächste Apotheke?|Where is the nearest pharmacy?|Where is the next pharmacy?||"
  "Vielen Dank für Ihre Hilfe.|Thank you very much for your help.|Many thanks for your help.||"
)

csv="$tmp/phrases.csv"
printf '\xef\xbb\xbfid,file,text,transcription,translation,literal,notes,repeats\r\n' > "$csv"
i=0
for p in "${phrases[@]}"; do
  i=$((i + 1))
  IFS='|' read -r text tr literal notes repeats <<< "$p"
  n=$(printf '%04d' "$i")
  espeak-ng -v de -s 140 -w "$tmp/$n.wav" "$text"
  ipa=$(espeak-ng -v de -q --ipa "$text" | tr -s ' \n' ' ' | sed 's/^ //; s/ $//')
  ffmpeg -loglevel error -y -i "$tmp/$n.wav" -ac 1 -ar 24000 -b:a 64k "$tmp/audio/$n.mp3"
  printf 'p%s,audio/%s.mp3,"%s","[%s]","%s","%s","%s",%s\r\n' "$n" "$n" "$text" "$ipa" "$tr" "$literal" "$notes" "$repeats" >> "$csv"
done

cat > "$tmp/pack.json" <<'JSON'
{
  "format": "lang-train-pack",
  "version": 1,
  "id": "demo-de-en",
  "title": "Demo: German (espeak)",
  "lang": { "target": "de", "native": "en" },
  "fields": [
    { "key": "text", "label": "Original", "role": "primary", "lang": "de" },
    { "key": "transcription", "label": "Transcription" },
    { "key": "translation", "label": "Translation", "role": "translation", "lang": "en" },
    { "key": "literal", "label": "Word by word", "lang": "en" },
    { "key": "notes", "label": "Notes", "multiline": true }
  ],
  "defaults": { "pauseFactor": 1.2, "pauseExtra": 1.0, "repeats": 1 },
  "generator": "scripts/make-demo-pack.sh"
}
JSON

rm -f "$out"
(cd "$tmp" && zip -q -0 -r "$OLDPWD/$out" pack.json phrases.csv audio)
echo "$out:"
unzip -l "$out"
