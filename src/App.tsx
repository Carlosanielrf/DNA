import { useCallback, useState } from 'react'
import { FluidBackground } from './components/FluidBackground'
import { DnaHelix } from './components/DnaHelix'
import { FactPanel } from './components/FactPanel'
import { useMediaQuery } from './hooks/useMediaQuery'
import type { DnaFact } from './data/facts'
import './App.css'

const MIN_SCALE = 0.45
const MAX_SCALE = 2.8

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export default function App() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const vertical = isMobile

  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const [fact, setFact] = useState<DnaFact | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const onSelect = useCallback((next: DnaFact, hitId: string) => {
    setFact(next)
    setSelectedId(hitId)
  }, [])

  const onPan = useCallback((dx: number, dy: number) => {
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }, [])

  const onPinchZoom = useCallback((factor: number, centerX: number, centerY: number) => {
    setView((v) => {
      const next = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
      const ratio = next / v.scale
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      return {
        scale: next,
        x: centerX - cx - (centerX - cx - v.x) * ratio,
        y: centerY - cy - (centerY - cy - v.y) * ratio,
      }
    })
  }, [])

  const zoomBy = (factor: number) => {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    onPinchZoom(factor, cx, cy)
  }

  return (
    <div className="app">
      <FluidBackground />

      <main className="stage">
        <DnaHelix
          vertical={vertical}
          scale={view.scale}
          offset={{ x: view.x, y: view.y }}
          selectedId={selectedId}
          onSelect={onSelect}
          onPan={onPan}
          onPinchZoom={onPinchZoom}
        />
      </main>

      <div className="controls" role="toolbar" aria-label="Zoom">
        <button type="button" onClick={() => zoomBy(1.15)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.15)} aria-label="Zoom out">
          −
        </button>
      </div>

      {fact ? (
        <div className="fact-dock">
          <FactPanel fact={fact} onClose={() => { setFact(null); setSelectedId(null) }} />
        </div>
      ) : null}
    </div>
  )
}
