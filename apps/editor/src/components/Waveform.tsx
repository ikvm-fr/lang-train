import Peaks, { type PeaksInstance, type Segment } from 'peaks.js'
import { useEffect, useRef } from 'react'
import { WebAudioPlayer } from '../audio/WebAudioPlayer'
import { MIN_REGION, store, type ProjectState } from '../state/store'

// peaks.js wrapper. The store is the source of truth: store changes are pushed to peaks.js
// segments, and peaks.js edits (insert by drag, boundary drags) are written back to the store.

export interface WaveformHandle {
  peaks: PeaksInstance
  player: WebAudioPlayer
}

// Samples per pixel at 24 kHz: 64 ≈ 2.7 ms per pixel … 8192 ≈ 0.34 s per pixel.
const ZOOM_LEVELS = [64, 128, 256, 512, 1024, 2048, 4096, 8192]

function palette() {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  return dark
    ? { wave: '#5b7fc7', played: '#9fb8ea', axis: '#8a93a0', grid: '#2c323a', playhead: '#f5f7fa', seg: '#f59e0b', sel: '#22c55e' }
    : { wave: '#7a9ad6', played: '#2f58a8', axis: '#5b6472', grid: '#dde1e7', playhead: '#111418', seg: '#d97706', sel: '#16a34a' }
}

function syncSegments(peaks: PeaksInstance, s: ProjectState) {
  const colors = palette()
  const wanted = new Map(s.regions.map((r, i) => [r.id, { r, i }]))
  for (const seg of peaks.segments.getSegments()) {
    if (!seg.id || !wanted.has(seg.id)) peaks.segments.removeById(seg.id!)
  }
  for (const [id, { r, i }] of wanted) {
    const opts = {
      startTime: r.start,
      endTime: r.end,
      labelText: String(i + 1),
      color: id === s.selectedId ? colors.sel : colors.seg,
      borderColor: id === s.selectedId ? colors.sel : colors.seg,
    }
    const seg = peaks.segments.getSegment(id)
    if (!seg) peaks.segments.add({ ...opts, id, editable: true })
    else if (
      seg.startTime !== opts.startTime ||
      seg.endTime !== opts.endTime ||
      seg.labelText !== opts.labelText ||
      seg.color !== opts.color
    ) {
      seg.update(opts)
    }
  }
}

export function Waveform({ buffer, onReady }: { buffer: AudioBuffer; onReady: (h: WaveformHandle | null) => void }) {
  const zoomRef = useRef<HTMLDivElement>(null)
  const overviewRef = useRef<HTMLDivElement>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  useEffect(() => {
    let cancelled = false
    let instance: PeaksInstance | null = null
    let unsubscribe = () => {}
    const player = new WebAudioPlayer(buffer)
    const colors = palette()

    Peaks.init(
      {
        zoomview: {
          container: zoomRef.current,
          waveformColor: colors.wave,
          playedWaveformColor: colors.played,
          playheadColor: colors.playhead,
          axisLabelColor: colors.axis,
          axisGridlineColor: colors.grid,
          showPlayheadTime: true,
          playheadTextColor: colors.playhead,
          timeLabelPrecision: 2,
          wheelMode: 'scroll',
        },
        overview: {
          container: overviewRef.current,
          waveformColor: colors.wave,
          playedWaveformColor: colors.played,
          playheadColor: colors.playhead,
          axisLabelColor: colors.axis,
          axisGridlineColor: colors.grid,
          highlightColor: colors.axis,
        },
        webAudio: { audioBuffer: buffer, scale: ZOOM_LEVELS[0], multiChannel: false },
        player,
        zoomLevels: ZOOM_LEVELS,
        keyboard: false,
        segmentOptions: { overlay: true, overlayOpacity: 0.25, overlayLabelColor: colors.axis, markers: true },
      },
      (err, peaks) => {
        if (err || !peaks) {
          console.error(err)
          return
        }
        if (cancelled) {
          peaks.destroy()
          return
        }
        instance = peaks
        const zoomview = peaks.views.getView('zoomview')!
        zoomview.setWaveformDragMode('insert-segment')
        zoomview.setSegmentDragMode('no-overlap')
        zoomview.enableSegmentDragging(false)
        peaks.zoom.setZoom(3)

        peaks.on('segments.insert', ({ segment }) => {
          const { startTime, endTime } = segment
          peaks.segments.removeById(segment.id!)
          // A click without a drag inserts an empty segment: treat it as a seek.
          if (endTime - startTime < MIN_REGION) player.seek(startTime)
          else store.addRegion(startTime, endTime)
          syncSegments(peaks, store.getState())
        })
        peaks.on('segments.dragend', ({ segment }: { segment: Segment }) => {
          store.setBounds(segment.id!, segment.startTime, segment.endTime)
          store.select(segment.id!)
          syncSegments(peaks, store.getState())
        })
        peaks.on('segments.click', ({ segment }) => store.select(segment.id!))
        // In insert-segment mode a click inside a region does not seek by itself.
        peaks.on('zoomview.click', ({ time }) => player.seek(time))

        syncSegments(peaks, store.getState())
        unsubscribe = store.subscribe(() => syncSegments(peaks, store.getState()))
        onReadyRef.current({ peaks, player })
      },
    )

    const onResize = () => {
      instance?.views.getView('zoomview')?.fitToContainer()
      instance?.views.getView('overview')?.fitToContainer()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      unsubscribe()
      onReadyRef.current(null)
      instance?.destroy()
    }
  }, [buffer])

  return (
    <div className="waveform">
      <div className="zoomview" ref={zoomRef} />
      <div className="overview" ref={overviewRef} />
    </div>
  )
}
