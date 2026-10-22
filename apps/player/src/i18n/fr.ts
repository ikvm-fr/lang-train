import type { Translation } from '@lang-train/i18n'
import type { en } from './en'

export const fr: Translation<typeof en> = {
  'app.newVersion': 'Une nouvelle version est disponible',
  'app.update': 'Mettre à jour',
  'app.closePack': 'Fermer le pack',

  'start.intro': 'Ouvrez un pack ZIP de phrases ou essayez la démo.',
  'start.openZip': 'Ouvrir un ZIP',
  'start.demo': 'Pack de démo (allemand)',
  'start.demoFailed': 'Impossible de télécharger la démo (HTTP {status}).',
  'start.editorHint': 'Créez vos propres packs sur un ordinateur :',
  'start.openEditor': 'ouvrir l’éditeur',
  'start.formatDocs': 'Format du pack :',

  'phase.press': 'Appuyez sur ▶',
  'phase.paused': 'En pause',
  'phase.finished': 'Terminé',
  'phase.listen': 'Écoutez',
  'phase.repeat': 'Répétez · {seconds} s',
  'phase.ready': 'Préparation…',
  'card.repeatOf': 'répétition {n} / {total}',

  'aria.previous': 'Phrase précédente',
  'aria.playPause': 'Lecture / pause',
  'aria.next': 'Phrase suivante',
  'aria.decrease': 'Diminuer',
  'aria.increase': 'Augmenter',

  'quick.again': '↻ Encore',
  'quick.plusOne': '+1 répét.',

  'phrase.title': 'Cette phrase',
  'phrase.repeats': 'Répétitions',
  'phrase.extraPause': 'Pause en plus',
  'phrase.reset': 'Annuler mes modifications',
  'hint.custom': 'perso',
  'hint.pack': 'pack',
  'hint.now': '+{n} maintenant',
  'unit.seconds': '{value} s',

  'settings.title': 'Réglages généraux',
  'settings.pauseFactor': 'Pause × durée',
  'settings.plusSeconds': '+ secondes',
  'settings.repeats': 'Répétitions',
  'settings.loop': 'En boucle',
  'settings.keepScreenOn': 'Garder l’écran allumé',
  'settings.background': 'Mode arrière-plan (test)',
  'settings.bgSilent': 'Piste silencieuse en parallèle',
  'settings.bgStream': 'Son via un flux <audio>',
  'settings.bgNone': 'Sans maintien',
  'settings.bgNote': 'Changer le mode arrière-plan arrête la lecture.',

  'phrases.title': 'Phrases',
  'log.title': 'Journal (diagnostic arrière-plan)',
  'log.copy': 'Copier',
}
