import type { Translation } from '@lang-train/i18n'
import type { en } from './en'

export const zh: Translation<typeof en> = {
  'app.newVersion': '有新版本可用',
  'app.update': '更新',
  'app.closePack': '关闭学习包',

  'start.intro': '打开一个包含句子的 ZIP 学习包，或试用演示。',
  'start.openZip': '打开 ZIP',
  'start.demo': '演示学习包（德语）',
  'start.demoFailed': '无法下载演示（HTTP {status}）。',
  'start.editorHint': '在电脑上制作自己的学习包：',
  'start.openEditor': '打开编辑器',
  'start.formatDocs': '学习包格式：',

  'phase.press': '请按 ▶',
  'phase.paused': '已暂停',
  'phase.finished': '已完成',
  'phase.listen': '请听',
  'phase.repeat': '请跟读 · {seconds} 秒',
  'phase.ready': '正在准备…',
  'card.repeatOf': '第 {n} / {total} 遍',

  'aria.previous': '上一句',
  'aria.playPause': '播放 / 暂停',
  'aria.next': '下一句',
  'aria.decrease': '减少',
  'aria.increase': '增加',

  'quick.again': '↻ 再听一遍',
  'quick.plusOne': '+1 遍',

  'phrase.title': '当前句子',
  'phrase.repeats': '重复次数',
  'phrase.extraPause': '额外停顿',
  'phrase.reset': '重置我的修改',
  'hint.custom': '自定义',
  'hint.pack': '学习包',
  'hint.now': '本轮 +{n}',
  'unit.seconds': '{value} 秒',

  'settings.title': '通用设置',
  'settings.pauseFactor': '停顿 × 时长',
  'settings.plusSeconds': '+ 秒数',
  'settings.repeats': '重复次数',
  'settings.loop': '循环播放',
  'settings.keepScreenOn': '保持屏幕常亮',
  'settings.background': '后台模式（测试）',
  'settings.bgSilent': '同时播放静音音轨',
  'settings.bgStream': '通过 <audio> 流输出声音',
  'settings.bgNone': '不保持后台',
  'settings.bgNote': '切换后台模式会停止播放。',

  'phrases.title': '句子列表',
  'log.title': '日志（后台调试）',
  'log.copy': '复制',
}
