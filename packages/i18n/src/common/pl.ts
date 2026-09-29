import type { Translation } from '../core'
import type { en } from './en'

export const pl: Translation<typeof en> = {
  'common.language': 'Język',
  'common.close': 'Zamknij',
  'common.cancel': 'Anuluj',
  'common.dismiss': 'ukryj',
  'common.loading': 'Wczytywanie…',
  'common.error': 'Błąd: {detail}',

  'field.text': 'Oryginał',
  'field.transcription': 'Transkrypcja',
  'field.translation': 'Tłumaczenie',
  'field.notes': 'Notatki',

  'err.unzipFailed': 'Nie udało się rozpakować pliku ZIP: {detail}',
  'err.csvNotFound': 'W archiwum nie znaleziono pliku phrases.csv.',
  'err.metaInvalidJson': 'pack.json nie jest poprawnym plikiem JSON.',
  'err.metaNotObject': 'pack.json nie zawiera obiektu JSON.',
  'err.unknownFormat': 'pack.json: nieznany format „{format}”.',
  'err.invalidVersion': 'pack.json: nieprawidłowa wersja formatu.',
  'err.newerVersion': 'Ten pakiet używa formatu w wersji {version}; ta aplikacja obsługuje wersje do {supported}. Zaktualizuj aplikację.',
  'err.missingId': 'pack.json: brak identyfikatora pakietu.',
  'err.fieldsInvalid': 'pack.json: brak listy pól lub jest pusta.',
  'err.fieldNotObject': 'pack.json: pole nr {index} nie jest obiektem.',
  'err.invalidFieldKey': 'pack.json: nieprawidłowy klucz pola „{key}”.',
  'err.reservedFieldKey': 'pack.json: klucz pola „{key}” jest zarezerwowany.',
  'err.duplicateFieldKey': 'pack.json: klucz pola „{key}” występuje dwa razy.',
  'err.missingFileColumn': 'phrases.csv nie ma kolumny „file”.',
  'err.duplicatePhraseId': 'phrases.csv: identyfikator frazy „{id}” występuje dwa razy.',
  'err.audioNotFound': 'Nie znaleziono plików audio: {files}',
  'err.noPhrases': 'phrases.csv nie zawiera żadnych fraz.',
}
