import type { Translation } from '../core'
import type { en } from './en'

export const fr: Translation<typeof en> = {
  'common.language': 'Langue',
  'common.close': 'Fermer',
  'common.cancel': 'Annuler',
  'common.dismiss': 'masquer',
  'common.loading': 'Chargement…',
  'common.error': 'Erreur : {detail}',

  'field.text': 'Original',
  'field.transcription': 'Transcription',
  'field.translation': 'Traduction',
  'field.notes': 'Notes',

  'err.unzipFailed': 'Impossible de décompresser le ZIP : {detail}',
  'err.csvNotFound': 'phrases.csv est introuvable dans l’archive.',
  'err.metaInvalidJson': 'pack.json n’est pas un JSON valide.',
  'err.metaNotObject': 'pack.json ne contient pas d’objet JSON.',
  'err.unknownFormat': 'pack.json : format inconnu « {format} ».',
  'err.invalidVersion': 'pack.json : version de format invalide.',
  'err.newerVersion': 'Ce pack utilise la version {version} du format ; cette application prend en charge jusqu’à la version {supported}. Veuillez mettre l’application à jour.',
  'err.missingId': 'pack.json : l’identifiant du pack est manquant.',
  'err.fieldsInvalid': 'pack.json : la liste des champs est absente ou vide.',
  'err.fieldNotObject': 'pack.json : le champ n° {index} n’est pas un objet.',
  'err.invalidFieldKey': 'pack.json : clé de champ invalide « {key} ».',
  'err.reservedFieldKey': 'pack.json : la clé de champ « {key} » est réservée.',
  'err.duplicateFieldKey': 'pack.json : la clé de champ « {key} » apparaît deux fois.',
  'err.missingFileColumn': 'phrases.csv n’a pas de colonne « file ».',
  'err.duplicatePhraseId': 'phrases.csv : l’identifiant de phrase « {id} » apparaît deux fois.',
  'err.audioNotFound': 'Fichiers audio introuvables : {files}',
  'err.noPhrases': 'phrases.csv ne contient aucune phrase.',
}
