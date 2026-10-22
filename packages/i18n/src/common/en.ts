// Strings shared by the player and the editor. English is the source of truth.
export const en = {
  'common.language': 'Language',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.dismiss': 'dismiss',
  'common.loading': 'Loading…',
  'common.error': 'Error: {detail}',

  // Default field labels of a new project / prototype pack.
  'field.text': 'Original',
  'field.transcription': 'Transcription',
  'field.translation': 'Translation',
  'field.notes': 'Notes',

  // Pack reading errors (codes from @lang-train/pack).
  'err.unzipFailed': 'Failed to unpack the ZIP: {detail}',
  'err.csvNotFound': 'phrases.csv was not found in the archive.',
  'err.metaInvalidJson': 'pack.json is not valid JSON.',
  'err.metaNotObject': 'pack.json does not contain a JSON object.',
  'err.unknownFormat': 'pack.json: unknown format “{format}”.',
  'err.invalidVersion': 'pack.json: invalid format version.',
  'err.newerVersion': 'This pack uses format version {version}; this app supports up to {supported}. Please update the app.',
  'err.missingId': 'pack.json: the pack id is missing.',
  'err.fieldsInvalid': 'pack.json: the list of fields is missing or empty.',
  'err.fieldNotObject': 'pack.json: field no. {index} is not an object.',
  'err.invalidFieldKey': 'pack.json: invalid field key “{key}”.',
  'err.reservedFieldKey': 'pack.json: the field key “{key}” is reserved.',
  'err.duplicateFieldKey': 'pack.json: the field key “{key}” is used twice.',
  'err.missingFileColumn': 'phrases.csv has no “file” column.',
  'err.duplicatePhraseId': 'phrases.csv: the phrase id “{id}” is used twice.',
  'err.audioNotFound': 'Audio files not found: {files}',
  'err.noPhrases': 'phrases.csv contains no phrases.',
}
