// Errors that the UI can translate: a stable code plus parameters. `message` stays English
// (logs, tests, and a fallback when a UI has no translation for the code).

export type ErrorParams = Record<string, string | number>

export class CodedError extends Error {
  readonly code: string
  readonly params: ErrorParams

  constructor(code: string, params: ErrorParams, message: string) {
    super(message)
    this.name = 'CodedError'
    this.code = code
    this.params = params
  }
}

export const PACK_ERROR_MESSAGES = {
  unzipFailed: 'Failed to unpack ZIP: {detail}',
  csvNotFound: 'phrases.csv not found in the archive',
  metaInvalidJson: 'pack.json: invalid JSON',
  metaNotObject: 'pack.json: not a JSON object',
  unknownFormat: 'pack.json: unknown format "{format}"',
  invalidVersion: 'pack.json: invalid `version`',
  newerVersion: 'This pack uses format version {version}; this app supports up to {supported}. Please update the app.',
  missingId: 'pack.json: missing `id`',
  fieldsInvalid: 'pack.json: `fields` must be a non-empty array',
  fieldNotObject: 'pack.json: fields[{index}] is not an object',
  invalidFieldKey: 'pack.json: invalid field key "{key}"',
  reservedFieldKey: 'pack.json: field key "{key}" is reserved',
  duplicateFieldKey: 'pack.json: duplicate field key "{key}"',
  missingFileColumn: 'phrases.csv: missing `file` column',
  duplicatePhraseId: 'phrases.csv: duplicate phrase id "{id}"',
  audioNotFound: 'Audio files not found: {files}',
  noPhrases: 'phrases.csv contains no phrases',
} as const

export type PackErrorCode = keyof typeof PACK_ERROR_MESSAGES

export function fillMessage(template: string, params: ErrorParams): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] === undefined ? m : String(params[k])))
}

export function packError(code: PackErrorCode, params: ErrorParams = {}): CodedError {
  return new CodedError(code, params, fillMessage(PACK_ERROR_MESSAGES[code], params))
}
