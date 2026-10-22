# Pack format v1

A **pack** is a single ZIP archive with phrase clips and their texts. The editor (`apps/editor`)
produces packs; the player (`apps/player`) consumes them. This document is the contract between the two.

Status: **draft**, implemented by `packages/pack` and the player. The player also accepts the
prototype format (`phrases.csv` without `pack.json`), see [Compatibility](#compatibility).

## Archive layout

```
lesson-03.zip
├── pack.json          metadata and field model (required in v1)
├── phrases.csv        one row per phrase, in playback order (required)
└── audio/
    ├── 0001.mp3
    ├── 0002.mp3
    └── ...
```

- The file name of the archive does not matter; the extension should be `.zip`
  (Android file pickers may hide unknown extensions).
- All three entries may be nested inside one top-level folder (what you get when you zip a folder).
  Readers locate `phrases.csv` at the shallowest depth and resolve every other path relative to it.
- Path matching is case-insensitive. Entries under `__MACOSX/` are ignored.
- Audio files should be stored without compression (ZIP method *store*): MP3 does not compress further,
  and unpacking becomes instant.

## pack.json

```json
{
  "format": "lang-train-pack",
  "version": 1,
  "id": "3f1c2a9e-5d0b-4e57-9a51-0c6f3b1d2e84",
  "title": "Dialogues A2 — Unit 3",
  "description": "Optional free text",
  "lang": { "target": "de", "native": "en" },
  "fields": [
    { "key": "text",          "label": "Original",      "role": "primary", "lang": "de" },
    { "key": "transcription", "label": "Transcription" },
    { "key": "translation",   "label": "Translation",   "role": "translation", "lang": "en" },
    { "key": "notes",         "label": "Notes",         "multiline": true, "display": "toggle" }
  ],
  "defaults": { "pauseFactor": 1.2, "pauseExtra": 1.0, "repeats": 1 },
  "sources": [
    { "id": "s1", "name": "unit3-dialogue.mp3", "duration": 812.35 }
  ],
  "generator": "lang-train-editor 0.1.0",
  "created": "2026-09-29T10:00:00Z",
  "modified": "2026-09-29T10:00:00Z"
}
```

| Key | Required | Meaning |
|---|---|---|
| `format` | yes | Always `"lang-train-pack"`. |
| `version` | yes | Integer format version. Readers refuse packs with a higher version than they support. |
| `id` | yes | Stable unique id (UUID recommended). The player stores per-phrase settings and progress under it, so it must **not change** when the pack is edited or appended to. |
| `title` | yes | Human-readable name. |
| `description` | no | Free text. |
| `lang` | no | BCP 47 codes: `target` is the language being learned, `native` the learner's language. |
| `fields` | yes | The field model, see below. Order = display order. |
| `defaults` | no | Suggested playback defaults for this pack. Used by the player only until the user changes their own settings. |
| `sources` | no | Original recordings the clips were cut from (provenance, used by the editor). |
| `generator`, `created`, `modified` | no | Informational. |

Unknown keys must be ignored by readers and preserved by the editor when it rewrites a pack.

### Field model

Each entry of `fields` describes one text column of `phrases.csv`.

| Key | Required | Meaning |
|---|---|---|
| `key` | yes | Column name in `phrases.csv`. Pattern `^[a-z][a-z0-9_]*$`, must not be a [reserved column](#reserved-columns). Unique. |
| `label` | yes | Name shown in the UI. |
| `role` | no | `"primary"` — the main phrase text: shown largest, used as the title in the media notification. `"translation"` — used as the subtitle in the media notification. At most one field per role. If no field has `primary`, the first field is primary. |
| `multiline` | no | `true` if the value may contain line breaks (editor uses a textarea, player keeps line breaks). Default `false`. |
| `display` | no | How the player shows it: `"always"` (no toggle), `"toggle"` (shown, with a show/hide switch; default), `"hidden"` (kept in the data, not shown). The primary field is always `"always"`. |
| `lang` | no | BCP 47 code of the field's content (for fonts, hyphenation, `lang` attribute). |
| `dir` | no | `"ltr"` or `"rtl"`; default derived from `lang`, else `ltr`. |

Readers must handle any number of fields with any keys; nothing in the player may depend on
specific field names.

## phrases.csv

- RFC 4180 CSV: comma separator, `"` quoting, doubled `""` inside quoted values,
  line breaks allowed inside quoted values.
- First row is the header. Column names are matched case-insensitively after trimming.
- Encoding: **UTF-8**. Writers emit a UTF-8 BOM so that Excel opens the file correctly;
  readers strip it. Readers also fall back to Windows-1251 if the file is not valid UTF-8
  (Excel on Russian-locale Windows).
- Row order is playback order. Empty lines are skipped.

### Reserved columns

| Column | Required | Meaning |
|---|---|---|
| `file` | yes | Path of the clip, relative to `phrases.csv`, e.g. `audio/0001.mp3`. |
| `id` | no | Stable unique phrase id. Default: the value of `file`. The player keys per-phrase settings by it, so the editor keeps ids unchanged across edits. |
| `pause` | no | Per-phrase extra pause in seconds (overrides `pauseExtra`). |
| `repeats` | no | Per-phrase number of plays, integer ≥ 1 (overrides `repeats`). |
| `source` | no | `sources[].id` of the recording the clip was cut from. |
| `start`, `end` | no | Position of the clip in that source, seconds with millisecond precision (before padding). |

Every other column is a field column. A column that is not declared in `pack.json` `fields` is
treated as an extra field with `label` = column name and `display: "toggle"`, appended after the
declared fields. A declared field without a column is treated as empty.

Example:

```csv
id,file,text,transcription,translation,notes,pause,repeats,source,start,end
p0001,audio/0001.mp3,Guten Morgen!,[ɡˈuːtən mˈɔɾɡən],Good morning!,,,,s1,12.340,13.420
p0002,audio/0002.mp3,Wie komme ich zum Bahnhof?,[viː kˈɔmə ɪç tsʊm bˈɑːnhoːf],How do I get to the train station?,"zum = zu dem",2.5,2,s1,15.100,17.030
```

## Audio

- **MP3** is the only format the editor produces and the only one the player guarantees.
  Recommended: mono, 24 kHz or higher, 48–64 kbit/s CBR for speech.
- Other formats the browser can decode (`.m4a`, `.ogg`, `.wav`) may work but are not guaranteed.
- One clip per phrase. A clip contains the phrase plus a short padding (the editor default is 100 ms)
  with a few-millisecond fade in/out to avoid clicks.
- Naming: `audio/NNNN.mp3`, zero-padded, numbered in creation order. Names carry no meaning;
  order comes from `phrases.csv`.

## Player behaviour required by this format

- Show fields in `fields` order: the primary field largest, then the others.
- Offer a show/hide switch per field with `display: "toggle"`; remember the choice per pack.
- Never show `display: "hidden"` fields.
- Use `role: primary` / `role: translation` for the media notification title / subtitle.
- Apply `pause` / `repeats` columns as per-phrase defaults; the user's own per-phrase changes
  (stored locally under `pack.id` + phrase `id`) take precedence.
- Apply `defaults` until the user has changed the corresponding setting.

## Appending to an existing pack

The editor can add phrases to an existing pack instead of creating a new one:

- `id`, `title`, `created` are kept; `modified` is updated.
- Existing rows and audio files are kept byte-for-byte; new clips continue the numbering
  (`audio/0043.mp3`, …) and new ids never reuse existing ones.
- Fields are merged by `key`: existing fields keep their definition; new fields are appended and
  are empty for old rows.
- The new recording is added to `sources` with a new id.

## Compatibility

- **Prototype format** (no `pack.json`): readers generate an id from a hash of `phrases.csv` and use
  the default field model `text` (primary), `transcription`, `translation` (role translation),
  `notes` (multiline).
- **Future versions**: minor additions (new optional keys, new roles) keep `version: 1`.
  Anything an older reader would misinterpret bumps `version`.
