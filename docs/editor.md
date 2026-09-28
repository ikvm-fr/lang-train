# Editor

`apps/editor`, served at `/lang-train/editor/`. A desktop-first web app that turns one audio recording
into a [pack](pack-format.md): mark phrases as regions on a waveform, fill in the text fields,
and export a ZIP with one MP3 clip per phrase. No server: everything runs in the browser.

Status: MVP implemented (both iterations).

## Scope

In the MVP:

- Open one `.mp3` or `.wav` file from disk (one project = one recording).
- Waveform with overview and zoom (peaks.js), regions that can be created, moved, resized, split,
  merged and deleted.
- Text fields per region, defined by an editable field model (see [pack format](pack-format.md#field-model)).
- Automatic silence detection to propose regions.
- Export: cut regions, encode MP3, write `pack.json` + `phrases.csv`, download a ZIP.
- Append the regions to an existing pack ZIP instead of creating a new one.
- Autosave of the project in the browser.

Not in the MVP (possible later):

- Mobile layout (the editor targets a desktop browser; it should open on a phone but need not be comfortable).
- Several recordings in one project (use *append to existing pack* instead).
- Automatic transcription / alignment (Whisper in the browser via transformers.js + WebGPU).
- Machine translation.
- Undo history beyond the last destructive action.

## Workflow

1. **Open** an audio file. It is decoded once into a mono PCM buffer (see [Audio pipeline](#audio-pipeline)).
2. **Mark** phrases: run silence detection and/or mark manually (drag on the waveform, or `I`/`O` while listening).
3. **Adjust** boundaries by dragging or with the keyboard; listen to each region (`Enter`, `L` to loop).
4. **Fill in** the fields in the region table (original, transcription, translation, …).
5. **Export** → new pack, or **Append** → choose an existing pack ZIP; the result downloads as a ZIP.

## Layout (desktop)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ File: unit3.mp3 · 13:32 · 42 regions     [Detect pauses] [Fields] [Export ▾]│
├───────────────────────────────────────────────────────────────────────────┤
│ overview  ▁▂▅▇▅▂▁▁▃▆▇▆▃▁▁▂▅▇▅▂▁▁▃▆▇▆▃▁▁▂▅▇▅▂▁▁▃▆▇▆▃▁▁▂▅▇▅▂▁ [====]        │
│ zoom      ▁▂▅▇█▇▅▂▁   ▁▃▆███▆▃▁      ▁▂▅▇█▇▅▂▁                            │
│             [ 12 ]      [  13  ]  |    [ 14 ]         ◀ playhead           │
├───────────────────────────────────────────────────────────────────────────┤
│  #  │ start   end    │ Original            │ Transcription │ Translation   │
│ 12  │ 1:02.34 1:03.42│ Guten Morgen!       │ [ɡˈuːtən …]   │ Good morning! │
│▶13  │ 1:05.10 1:07.03│ Wie komme ich …     │               │               │
│ 14  │ 1:09.88 1:11.20│                     │               │               │
└───────────────────────────────────────────────────────────────────────────┘
```

- The table and the waveform share one selection: clicking a row selects and plays its region,
  selecting a region scrolls to its row.
- Columns of the table = fields of the model, in order. Multiline fields expand when focused.
- A region with an empty primary field is highlighted (it can still be exported).

## Waveform and regions (peaks.js)

- **peaks.js 4** with its peer dependencies `konva` and `waveform-data`, wrapped in a React component
  that creates the instance in an effect and destroys it on unmount.
- **Source of truth** is the editor's own state (a store with the regions array).
  peaks.js segment events (drag, resize) update the store; store changes are pushed back to peaks.js.
- **Waveform data** is computed from the already decoded PCM buffer (no second decode).
- **Playback** goes through a custom peaks.js player adapter built on Web Audio and the same decoded
  buffer, instead of an `<audio>` element. Seeking in a VBR MP3 through `<audio>` is imprecise, and
  the playhead could drift from what the export cuts; with the adapter what you hear is exactly what gets cut.
- Regions may touch but not overlap; dragging a boundary into a neighbour stops at the neighbour's edge.
- Minimum region length: 100 ms.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause from the playhead |
| `I` | Mark phrase start at the playhead (while playing) |
| `O` | Mark phrase end at the playhead → creates a region from the last `I` |
| `Enter` | Play the selected region |
| `L` | Loop the selected region on/off |
| `↑` / `↓` | Select previous / next region |
| `←` / `→` | Move the selected region's start boundary by 10 ms (`Shift`: 100 ms) |
| `Alt+←` / `Alt+→` | Move the end boundary by 10 ms (`Shift`: 100 ms) |
| `S` | Split the selected region at the playhead |
| `M` | Merge the selected region with the next one |
| `Delete` | Delete the selected region |
| `Ctrl+Z` | Undo the last destructive action (delete / split / merge / detection run) |
| `+` / `−` | Zoom in / out |
| `Tab` (in the table) | Next field; at the last field, first field of the next region |

Shortcuts are disabled while a text field has focus, except `Tab`, `Esc` (leave the field) and `Ctrl+Enter` (play the region).

## Silence detection

Proposes regions by finding pauses in speech.

Algorithm:

1. Split the (mono, decoded) signal into 20 ms frames and compute each frame's RMS level in dBFS.
2. Estimate the noise floor as a low percentile (10th) of the frame levels.
3. A frame is *silent* if its level is below `threshold`. The default threshold is relative:
   noise floor + 12 dB, clamped to the range −60…−25 dBFS.
4. A run of silent frames at least `minSilence` long is a pause; shorter dips (between words,
   on stop consonants) are ignored.
5. Everything between pauses is speech; speech runs shorter than `minPhrase` are dropped (coughs, clicks).
6. Each speech run becomes a region, extended by `padding` on both sides but never past the middle of the adjacent pause.

Parameters (sliders; the proposal is redrawn live on the waveform before it is applied):

| Parameter | Default | Range |
|---|---|---|
| `threshold` | auto (noise floor + 12 dB) | −60…−20 dBFS |
| `minSilence` | 400 ms | 100…2000 ms |
| `minPhrase` | 300 ms | 100…2000 ms |
| `padding` | 100 ms | 0…500 ms |

- Scope: the whole file, or only the part currently visible in the zoomed waveform.
- Existing regions are never modified. Proposed regions that would overlap an existing region are skipped.
- The run can be undone with `Ctrl+Z`.
- Works best on clean speech (textbook audio, TTS, audiobooks). With background music or fast
  connected speech expect to merge and split by hand.

## Field model editor

- Opened from the **Fields** button. Lists fields with key, label, role, multiline, display.
- Default model for a new project: `text` (Original, primary), `transcription`, `translation`
  (role translation), `notes` (multiline).
- Fields can be added, renamed (label), reordered and removed.
- Keys are generated from the label on creation and are then fixed.
- Removing a field that has values asks for confirmation; the values stay in the regions (and come back if the field is re-added with the same key) but are not exported.
- The last used model is remembered and offered for new projects.

## Audio pipeline

- **Decode**: `decodeAudioData` in an `AudioContext` created with `sampleRate: 24000`, then downmix to mono.
  24 kHz mono keeps speech quality and needs ~350 MB per hour of audio.
  Files longer than 90 minutes show a warning.
- **Cut**: for each region take `[start − padding, end + padding]` from the PCM buffer,
  apply a 5 ms linear fade in and out.
- **Encode**: MP3 with `@breezystack/lamejs` (maintained fork of lamejs), mono, 24 kHz, 64 kbit/s CBR.
  Encoding runs in a Web Worker, with a progress bar, so the UI stays responsive.
- **Pack**: `fflate`, audio stored without compression. `phrases.csv` written with a UTF-8 BOM.

Export options (dialog): padding (default 100 ms), bitrate (48 / 64 / 96 kbit/s), pack title,
target/native language codes.

## Append to an existing pack

**Export ▾ → Append to pack…** asks for an existing pack ZIP, then:

- reads it with the shared `packages/pack` reader (must be a valid v1 pack or a prototype pack);
- merges the field model (see [pack format](pack-format.md#appending-to-an-existing-pack));
- appends the new rows after the existing ones, continuing the clip numbering and ids;
- downloads the result as a new ZIP (the original file is not modified; browsers cannot overwrite files in place).

## Persistence

- **Autosave** to IndexedDB, 1 s after the last change and when the page is hidden: regions, field values,
  field model, pack id and the recording's name, size and duration. The header shows the time of the last save.
- One saved project **per recording** (keyed by file name + size), so opening another file never overwrites
  earlier work. The start screen shows the most recently saved project.
- The audio itself is not stored. Opening a recording that has a saved project offers to continue it;
  a different duration shows a warning.
- **Project file**: *Project ▾ → Save / Open project file* exports or imports everything except the audio,
  for backup or moving between machines. Opening a project file before any audio remembers it, and it is
  offered when the matching recording is opened.

```json
{
  "format": "lang-train-project",
  "version": 1,
  "packId": "3f1c2a9e-…",
  "audio": { "name": "unit3.mp3", "size": 6502211, "duration": 812.35 },
  "fields": [ { "key": "text", "label": "Original", "role": "primary" } ],
  "regions": [
    { "id": "p0001", "start": 12.34, "end": 13.42, "values": { "text": "Guten Morgen!" } }
  ],
  "nextId": 2,
  "savedAt": "2026-09-29T10:00:00Z"
}
```

## Interoperability

- **Import Audacity labels** (`start<TAB>end<TAB>label`): creates regions as one undo step, the label goes into the
  primary field; labels overlapping existing regions are skipped.
- **Export Audacity labels**, so a project can be continued in Audacity.
- SRT/VTT import is a later addition.

## Code structure

```
apps/editor/
  src/
    audio/decode.ts        decode + downmix to mono 24 kHz
    audio/webAudioPlayer.ts  peaks.js player adapter on Web Audio
    audio/silence.ts       silence detection (pure function, unit-tested)
    audio/encode.worker.ts MP3 encoding with lamejs
    export/buildPack.ts    cut → encode → pack.json + phrases.csv → zip (uses packages/pack)
    state/store.ts         project state, undo, autosave
    components/            Waveform (peaks.js wrapper), RegionTable, FieldsDialog, DetectDialog, ExportDialog
packages/pack/
  src/                     types, reader, writer, validation for the pack format (shared with the player)
```
