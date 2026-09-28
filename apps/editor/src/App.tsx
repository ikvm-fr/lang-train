// Placeholder until the editor MVP lands; see docs/editor.md.
export default function App() {
  return (
    <div className="app">
      <header className="top">
        <h1>Lang Train Editor</h1>
        <a href="../">Open the player</a>
      </header>
      <main>
        <p>
          The editor is under construction. It will turn an audio recording into a pack: mark phrases on the
          waveform, fill in their texts, and export a ZIP of MP3 clips for the player.
        </p>
      </main>
      <footer className="muted">
        v{__APP_VERSION__} · {__COMMIT__} · {__BRANCH__} · {new Date(__BUILD_TIME__).toLocaleString('en-GB')}
      </footer>
    </div>
  )
}
