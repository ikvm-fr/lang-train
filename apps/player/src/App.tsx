import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { errorText, LanguageSelect } from '@lang-train/i18n'
import { readPack, type Pack } from '@lang-train/pack'
import { Player, type Settings } from './engine/Player'
import { i18n, useI18n } from './i18n'
import { PlayerView } from './PlayerView'
import { effectiveSettings, loadOverrides, saveUserSettings } from './storage'

const docsUrl = `https://github.com/ikvm-fr/lang-train/blob/${__BRANCH__ === 'local' ? 'main' : __BRANCH__}/docs/pack-format.md`

function UpdateBanner() {
  const { t } = useI18n()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => void reg.update().catch(() => {})
      setInterval(check, 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    },
  })
  if (!needRefresh) return null
  return (
    <div className="banner">
      {t('app.newVersion')}
      <button onClick={() => void updateServiceWorker(true)}>{t('app.update')}</button>
    </div>
  )
}

function createPlayer(pack: Pack, warnings: readonly string[] = []) {
  const player = new Player(pack, effectiveSettings(pack.meta.defaults), loadOverrides(pack.meta.id))
  warnings.forEach((w) => player.log(`warning: ${w}`))
  return player
}

// Messages are kept as functions so they follow a language switch.
type Text = () => string

class DemoError extends Error {
  readonly code = 'demo'
  constructor(readonly status: number) {
    super(`Could not download the demo (HTTP ${status})`)
  }
}

export default function App() {
  const { t } = useI18n()
  const [player, setPlayer] = useState<Player | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Text | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const playerRef = useRef<Player | null>(null)
  playerRef.current = player

  async function open(bytes: Promise<Uint8Array>, name: string) {
    setBusy(true)
    setError(null)
    try {
      const { warnings, ...pack } = await readPack(await bytes, name)
      await playerRef.current?.dispose()
      setPlayer(createPlayer(pack, warnings))
    } catch (e) {
      setError(() => (e instanceof DemoError ? i18n.t('start.demoFailed', { status: e.status }) : errorText(i18n, e)))
    } finally {
      setBusy(false)
    }
  }

  function openDemo() {
    const url = `${import.meta.env.BASE_URL}demo/demo.zip`
    void open(
      fetch(url).then(async (r) => {
        if (!r.ok) throw new DemoError(r.status)
        return new Uint8Array(await r.arrayBuffer())
      }),
      'demo.zip',
    )
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) void open(f.arrayBuffer().then((b) => new Uint8Array(b)), f.name)
  }

  async function close() {
    await player?.dispose()
    setPlayer(null)
  }

  // The keep-alive mode changes how AudioContext is wired, so the player is recreated.
  async function changeKeepAlive(mode: Settings['keepAlive']) {
    if (!player) return
    saveUserSettings({ keepAlive: mode })
    await player.dispose()
    setPlayer(createPlayer(player.pack))
  }

  useEffect(() => {
    if (!player) document.title = 'Lang Train'
    else document.title = `${player.pack.meta.title} — Lang Train`
  }, [player])

  return (
    <div className="app">
      <UpdateBanner />
      <header className="top">
        <h1>Lang Train</h1>
        {player && (
          <button className="ghost" onClick={() => void close()}>
            {t('app.closePack')}
          </button>
        )}
      </header>

      {!player && (
        <main className="start">
          <p>{t('start.intro')}</p>
          <button className="primary" disabled={busy} onClick={() => fileInput.current?.click()}>
            {t('start.openZip')}
          </button>
          <button disabled={busy} onClick={openDemo}>
            {t('start.demo')}
          </button>
          <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={onFile} />
          {busy && <p className="muted">{t('common.loading')}</p>}
          {error && <p className="error">{error()}</p>}
          <label className="select">
            {t('common.language')}
            <LanguageSelect i18n={i18n} label={t('common.language')} />
          </label>
          <p className="muted small">
            {t('start.editorHint')} <a href={`${import.meta.env.BASE_URL}editor/`}>{t('start.openEditor')}</a>
          </p>
          <p className="muted small">
            {t('start.formatDocs')} <a href={docsUrl}>docs/pack-format.md</a>
          </p>
        </main>
      )}

      {player && <PlayerView key={player.instance} player={player} onKeepAlive={changeKeepAlive} />}

      <footer className="muted">
        v{__APP_VERSION__} · {__COMMIT__} · {__BRANCH__} · {i18n.dateTime(__BUILD_TIME__)}
      </footer>
    </div>
  )
}
