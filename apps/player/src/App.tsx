import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { readPack, type Pack } from '@lang-train/pack'
import { Player, type Settings } from './engine/Player'
import { PlayerView } from './PlayerView'
import { effectiveSettings, loadOverrides, saveUserSettings } from './storage'

const docsUrl = `https://github.com/ikvm-fr/lang-train/blob/${__BRANCH__ === 'local' ? 'main' : __BRANCH__}/docs/pack-format.md`

function UpdateBanner() {
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
      A new version is available
      <button onClick={() => void updateServiceWorker(true)}>Update</button>
    </div>
  )
}

function createPlayer(pack: Pack, warnings: readonly string[] = []) {
  const player = new Player(pack, effectiveSettings(pack.meta.defaults), loadOverrides(pack.meta.id))
  warnings.forEach((w) => player.log(`warning: ${w}`))
  return player
}

export default function App() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function openDemo() {
    const url = `${import.meta.env.BASE_URL}demo/demo.zip`
    void open(
      fetch(url).then(async (r) => {
        if (!r.ok) throw new Error(`Failed to download the demo: HTTP ${r.status}`)
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
            Close pack
          </button>
        )}
      </header>

      {!player && (
        <main className="start">
          <p>Open a ZIP pack with phrases or try the demo.</p>
          <button className="primary" disabled={busy} onClick={() => fileInput.current?.click()}>
            Open ZIP
          </button>
          <button disabled={busy} onClick={openDemo}>
            Demo pack (German)
          </button>
          <input ref={fileInput} type="file" accept=".zip,application/zip" hidden onChange={onFile} />
          {busy && <p className="muted">Loading…</p>}
          {error && <p className="error">{error}</p>}
          <p className="muted small">
            Make your own pack in the <a href={`${import.meta.env.BASE_URL}editor/`}>editor</a> (desktop).
          </p>
          <p className="muted small">
            Pack format: <a href={docsUrl}>docs/pack-format.md</a>
          </p>
        </main>
      )}

      {player && <PlayerView key={player.instance} player={player} onKeepAlive={changeKeepAlive} />}

      <footer className="muted">
        v{__APP_VERSION__} · {__COMMIT__} · {__BRANCH__} · {new Date(__BUILD_TIME__).toLocaleString('en-GB')}
      </footer>
    </div>
  )
}
