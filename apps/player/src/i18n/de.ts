import type { Translation } from '@lang-train/i18n'
import type { en } from './en'

export const de: Translation<typeof en> = {
  'app.newVersion': 'Eine neue Version ist verfügbar',
  'app.update': 'Aktualisieren',
  'app.closePack': 'Paket schließen',

  'start.intro': 'Öffne ein ZIP-Paket mit Phrasen oder probiere die Demo aus.',
  'start.openZip': 'ZIP öffnen',
  'start.demo': 'Demo-Paket (Deutsch)',
  'start.demoFailed': 'Die Demo konnte nicht geladen werden (HTTP {status}).',
  'start.editorHint': 'Eigene Pakete erstellst du am Computer:',
  'start.openEditor': 'Editor öffnen',
  'start.formatDocs': 'Paketformat:',

  'phase.press': '▶ drücken',
  'phase.paused': 'Pausiert',
  'phase.finished': 'Fertig',
  'phase.listen': 'Zuhören',
  'phase.repeat': 'Nachsprechen · {seconds} s',
  'phase.ready': 'Wird vorbereitet…',
  'card.repeatOf': 'Wiederholung {n} / {total}',

  'aria.previous': 'Vorherige Phrase',
  'aria.playPause': 'Wiedergabe / Pause',
  'aria.next': 'Nächste Phrase',
  'aria.decrease': 'Verringern',
  'aria.increase': 'Erhöhen',

  'quick.again': '↻ Nochmal',
  'quick.plusOne': '+1 Wiederh.',

  'phrase.title': 'Diese Phrase',
  'phrase.repeats': 'Wiederholungen',
  'phrase.extraPause': 'Zusätzliche Pause',
  'phrase.reset': 'Meine Änderungen zurücksetzen',
  'hint.custom': 'eigene',
  'hint.pack': 'Paket',
  'hint.now': '+{n} jetzt',
  'unit.seconds': '{value} s',

  'settings.title': 'Allgemeine Einstellungen',
  'settings.pauseFactor': 'Pause × Länge',
  'settings.plusSeconds': '+ Sekunden',
  'settings.repeats': 'Wiederholungen',
  'settings.loop': 'Endlosschleife',
  'settings.keepScreenOn': 'Bildschirm anlassen',
  'settings.background': 'Hintergrundmodus (Test)',
  'settings.bgSilent': 'Stille Spur daneben',
  'settings.bgStream': 'Ton über <audio>-Stream',
  'settings.bgNone': 'Ohne Wachhalten',
  'settings.bgNote': 'Ein Wechsel des Hintergrundmodus stoppt die Wiedergabe.',

  'phrases.title': 'Phrasen',
  'log.title': 'Protokoll (Hintergrund-Diagnose)',
  'log.copy': 'Kopieren',
}
