import type { Translation } from '@lang-train/i18n'
import type { en } from './en'

export const pl: Translation<typeof en> = {
  'app.newVersion': 'Dostępna jest nowa wersja',
  'app.update': 'Aktualizuj',
  'app.closePack': 'Zamknij pakiet',

  'start.intro': 'Otwórz pakiet ZIP z frazami lub wypróbuj wersję demo.',
  'start.openZip': 'Otwórz ZIP',
  'start.demo': 'Pakiet demo (niemiecki)',
  'start.demoFailed': 'Nie udało się pobrać wersji demo (HTTP {status}).',
  'start.editorHint': 'Własne pakiety tworzysz na komputerze:',
  'start.openEditor': 'otwórz edytor',
  'start.formatDocs': 'Format pakietu:',

  'phase.press': 'Naciśnij ▶',
  'phase.paused': 'Pauza',
  'phase.finished': 'Koniec',
  'phase.listen': 'Słuchaj',
  'phase.repeat': 'Powtórz · {seconds} s',
  'phase.ready': 'Przygotowanie…',
  'card.repeatOf': 'powtórzenie {n} / {total}',

  'aria.previous': 'Poprzednia fraza',
  'aria.playPause': 'Odtwarzaj / pauza',
  'aria.next': 'Następna fraza',
  'aria.decrease': 'Zmniejsz',
  'aria.increase': 'Zwiększ',

  'quick.again': '↻ Jeszcze raz',
  'quick.plusOne': '+1 powtórz.',

  'phrase.title': 'Ta fraza',
  'phrase.repeats': 'Powtórzenia',
  'phrase.extraPause': 'Dodatkowa pauza',
  'phrase.reset': 'Cofnij moje zmiany',
  'hint.custom': 'własne',
  'hint.pack': 'pakiet',
  'hint.now': '+{n} teraz',
  'unit.seconds': '{value} s',

  'settings.title': 'Ustawienia ogólne',
  'settings.pauseFactor': 'Pauza × długość',
  'settings.plusSeconds': '+ sekundy',
  'settings.repeats': 'Powtórzenia',
  'settings.loop': 'Zapętl',
  'settings.keepScreenOn': 'Nie wygaszaj ekranu',
  'settings.background': 'Tryb w tle (test)',
  'settings.bgSilent': 'Cicha ścieżka obok',
  'settings.bgStream': 'Dźwięk przez strumień <audio>',
  'settings.bgNone': 'Bez podtrzymania',
  'settings.bgNote': 'Zmiana trybu w tle zatrzymuje odtwarzanie.',

  'phrases.title': 'Frazy',
  'log.title': 'Dziennik (diagnostyka tła)',
  'log.copy': 'Kopiuj',
}
