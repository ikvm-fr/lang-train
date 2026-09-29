import { CodedError, fillMessage, type ErrorParams } from '@lang-train/pack'

// Editor errors with codes the UI translates (err.<code>); `message` stays English.
export const EDITOR_ERROR_MESSAGES = {
  decodeFailed: 'This file could not be decoded as audio. Use MP3 or WAV.',
  noRegions: 'There are no regions to export',
  notFromPack: 'This project was not opened from a pack',
  encodeFailed: 'MP3 encoding failed: {detail}',
  notProject: 'Not a Lang Train project file',
  projectNewer: 'This project file was made by a newer version of the editor',
  projectInvalid: 'Project file: invalid `{what}`',
  notLabels: 'Not an Audacity label line: "{line}"',
  notJson: 'Not a JSON file',
  noPositions: 'This pack does not store where its phrases are in the original recording, so it cannot be reopened.',
  wrongPack: 'This is not the pack “{title}” this project was opened from',
} as const

export type EditorErrorCode = keyof typeof EDITOR_ERROR_MESSAGES

export function editorError(code: EditorErrorCode, params: ErrorParams = {}): CodedError {
  return new CodedError(code, params, fillMessage(EDITOR_ERROR_MESSAGES[code], params))
}
