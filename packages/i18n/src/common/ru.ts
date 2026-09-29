import type { Translation } from '../core'
import type { en } from './en'

export const ru: Translation<typeof en> = {
  'common.language': 'Язык',
  'common.close': 'Закрыть',
  'common.cancel': 'Отмена',
  'common.dismiss': 'скрыть',
  'common.loading': 'Загрузка…',
  'common.error': 'Ошибка: {detail}',

  'field.text': 'Оригинал',
  'field.transcription': 'Транскрипция',
  'field.translation': 'Перевод',
  'field.notes': 'Заметки',

  'err.unzipFailed': 'Не удалось распаковать ZIP: {detail}',
  'err.csvNotFound': 'В архиве не найден файл phrases.csv.',
  'err.metaInvalidJson': 'pack.json не является корректным JSON.',
  'err.metaNotObject': 'pack.json не содержит JSON-объект.',
  'err.unknownFormat': 'pack.json: неизвестный формат «{format}».',
  'err.invalidVersion': 'pack.json: неверная версия формата.',
  'err.newerVersion': 'Этот пак использует формат версии {version}, а приложение поддерживает версии до {supported}. Обновите приложение.',
  'err.missingId': 'pack.json: нет идентификатора пака.',
  'err.fieldsInvalid': 'pack.json: список полей отсутствует или пуст.',
  'err.fieldNotObject': 'pack.json: поле № {index} не является объектом.',
  'err.invalidFieldKey': 'pack.json: недопустимый ключ поля «{key}».',
  'err.reservedFieldKey': 'pack.json: ключ поля «{key}» зарезервирован.',
  'err.duplicateFieldKey': 'pack.json: ключ поля «{key}» встречается дважды.',
  'err.missingFileColumn': 'В phrases.csv нет колонки «file».',
  'err.duplicatePhraseId': 'phrases.csv: идентификатор фразы «{id}» встречается дважды.',
  'err.audioNotFound': 'Не найдены аудиофайлы: {files}',
  'err.noPhrases': 'В phrases.csv нет ни одной фразы.',
}
