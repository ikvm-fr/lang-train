import type { Translation } from '@lang-train/i18n'
import type { en } from './en'

export const ru: Translation<typeof en> = {
  'app.newVersion': 'Доступна новая версия',
  'app.update': 'Обновить',
  'app.closePack': 'Закрыть пак',

  'start.intro': 'Откройте ZIP-пак с фразами или попробуйте демо.',
  'start.openZip': 'Открыть ZIP',
  'start.demo': 'Демо-пак (немецкий)',
  'start.demoFailed': 'Не удалось загрузить демо (HTTP {status}).',
  'start.editorHint': 'Свои паки можно сделать на компьютере:',
  'start.openEditor': 'открыть редактор',
  'start.formatDocs': 'Формат пака:',

  'phase.press': 'Нажмите ▶',
  'phase.paused': 'Пауза',
  'phase.finished': 'Готово',
  'phase.listen': 'Слушайте',
  'phase.repeat': 'Повторите · {seconds} с',
  'phase.ready': 'Подготовка…',
  'card.repeatOf': 'повтор {n} / {total}',

  'aria.previous': 'Предыдущая фраза',
  'aria.playPause': 'Воспроизведение / пауза',
  'aria.next': 'Следующая фраза',
  'aria.decrease': 'Уменьшить',
  'aria.increase': 'Увеличить',

  'quick.again': '↻ Ещё раз',
  'quick.plusOne': '+1 повтор',

  'phrase.title': 'Эта фраза',
  'phrase.repeats': 'Повторов',
  'phrase.extraPause': 'Доп. пауза',
  'phrase.reset': 'Сбросить мои изменения',
  'hint.custom': 'своё',
  'hint.pack': 'из пака',
  'hint.now': '+{n} сейчас',
  'unit.seconds': '{value} с',

  'settings.title': 'Общие настройки',
  'settings.pauseFactor': 'Пауза × длина',
  'settings.plusSeconds': '+ секунд',
  'settings.repeats': 'Повторов',
  'settings.loop': 'Зациклить',
  'settings.keepScreenOn': 'Не гасить экран',
  'settings.background': 'Фоновый режим (тест)',
  'settings.bgSilent': 'Тихий трек рядом',
  'settings.bgStream': 'Звук через поток <audio>',
  'settings.bgNone': 'Без удержания',
  'settings.bgNote': 'Смена фонового режима останавливает воспроизведение.',

  'phrases.title': 'Фразы',
  'log.title': 'Журнал (отладка фона)',
  'log.copy': 'Скопировать',
}
