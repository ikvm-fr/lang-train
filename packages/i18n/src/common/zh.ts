import type { Translation } from '../core'
import type { en } from './en'

export const zh: Translation<typeof en> = {
  'common.language': '语言',
  'common.close': '关闭',
  'common.cancel': '取消',
  'common.dismiss': '隐藏',
  'common.loading': '正在加载…',
  'common.error': '错误：{detail}',

  'field.text': '原文',
  'field.transcription': '音标',
  'field.translation': '译文',
  'field.notes': '备注',

  'err.unzipFailed': '无法解压 ZIP 文件：{detail}',
  'err.csvNotFound': '压缩包中找不到 phrases.csv。',
  'err.metaInvalidJson': 'pack.json 不是有效的 JSON。',
  'err.metaNotObject': 'pack.json 中没有 JSON 对象。',
  'err.unknownFormat': 'pack.json：未知格式“{format}”。',
  'err.invalidVersion': 'pack.json：格式版本无效。',
  'err.newerVersion': '此学习包使用第 {version} 版格式，本应用最高支持第 {supported} 版。请更新应用。',
  'err.missingId': 'pack.json：缺少学习包 ID。',
  'err.fieldsInvalid': 'pack.json：字段列表缺失或为空。',
  'err.fieldNotObject': 'pack.json：第 {index} 个字段不是对象。',
  'err.invalidFieldKey': 'pack.json：字段键“{key}”无效。',
  'err.reservedFieldKey': 'pack.json：字段键“{key}”为保留字。',
  'err.duplicateFieldKey': 'pack.json：字段键“{key}”重复。',
  'err.missingFileColumn': 'phrases.csv 缺少“file”列。',
  'err.duplicatePhraseId': 'phrases.csv：句子 ID“{id}”重复。',
  'err.audioNotFound': '找不到音频文件：{files}',
  'err.noPhrases': 'phrases.csv 中没有句子。',
}
