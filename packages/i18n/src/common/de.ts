import type { Translation } from '../core'
import type { en } from './en'

export const de: Translation<typeof en> = {
  'common.language': 'Sprache',
  'common.close': 'Schließen',
  'common.cancel': 'Abbrechen',
  'common.dismiss': 'ausblenden',
  'common.loading': 'Wird geladen…',
  'common.error': 'Fehler: {detail}',

  'field.text': 'Original',
  'field.transcription': 'Lautschrift',
  'field.translation': 'Übersetzung',
  'field.notes': 'Notizen',

  'err.unzipFailed': 'Das ZIP konnte nicht entpackt werden: {detail}',
  'err.csvNotFound': 'phrases.csv wurde im Archiv nicht gefunden.',
  'err.metaInvalidJson': 'pack.json ist kein gültiges JSON.',
  'err.metaNotObject': 'pack.json enthält kein JSON-Objekt.',
  'err.unknownFormat': 'pack.json: unbekanntes Format „{format}“.',
  'err.invalidVersion': 'pack.json: ungültige Formatversion.',
  'err.newerVersion': 'Dieses Paket verwendet Formatversion {version}; diese App unterstützt bis {supported}. Bitte aktualisiere die App.',
  'err.missingId': 'pack.json: Die Paket-ID fehlt.',
  'err.fieldsInvalid': 'pack.json: Die Feldliste fehlt oder ist leer.',
  'err.fieldNotObject': 'pack.json: Feld Nr. {index} ist kein Objekt.',
  'err.invalidFieldKey': 'pack.json: ungültiger Feldschlüssel „{key}“.',
  'err.reservedFieldKey': 'pack.json: Der Feldschlüssel „{key}“ ist reserviert.',
  'err.duplicateFieldKey': 'pack.json: Der Feldschlüssel „{key}“ kommt doppelt vor.',
  'err.missingFileColumn': 'phrases.csv hat keine Spalte „file“.',
  'err.duplicatePhraseId': 'phrases.csv: Die Phrasen-ID „{id}“ kommt doppelt vor.',
  'err.audioNotFound': 'Audiodateien nicht gefunden: {files}',
  'err.noPhrases': 'phrases.csv enthält keine Phrasen.',
}
