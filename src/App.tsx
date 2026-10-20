import { useCallback, useState } from 'react'
import { FluidBackground } from './components/FluidBackground'
import { DnaHelix } from './components/DnaHelix'
import { FactPanel } from './components/FactPanel'
import { useMediaQuery } from './hooks/useMediaQuery'
import { INTRO_FACT, type DnaFact } from './data/facts'
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
  const [fact, setFact] = useState<DnaFact>(INTRO_FACT)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const onSelect = useCallback((next: DnaFact, hitId: string) => {
    setFact(next)
    setSelectedId(hitId)
    setPanelOpen(true)
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

  const resetView = () => {
    setView({ scale: 1, x: 0, y: 0 })
    setFact(INTRO_FACT)
    setSelectedId(null)
    setPanelOpen(true)
  }

  return (
    <div className="app">
      <FluidBackground />

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div>
            <p className="brand__name">DNA Explorer</p>
            <p className="brand__tag">Hélice humana interativa</p>
          </div>
        </div>
        <p className="orientation-hint">
          {vertical ? 'Vista vertical · mobile' : 'Vista horizontal · desktop'}
        </p>
      </header>

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

      <div className="controls" role="toolbar" aria-label="Controlos de zoom">
        <button type="button" onClick={() => zoomBy(1.15)} aria-label="Aumentar">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.15)} aria-label="Diminuir">
          −
        </button>
        <button type="button" className="controls__reset" onClick={resetView}>
          Repor
        </button>
      </div>

      <div className={`fact-dock ${panelOpen ? 'is-open' : ''}`}>
        {panelOpen ? (
          <FactPanel
            fact={fact}
            showClose={isMobile}
            onClose={() => setPanelOpen(false)}
          />
        ) : (
          <button
            type="button"
            className="fact-dock__reopen"
            onClick={() => setPanelOpen(true)}
          >
            Ver facto
          </button>
        )}
      </div>

      <p className="hint">
        Arrasta · pinça ou scroll para zoom · toca nas esferas e degraus
      </p>
    </div>
  )
}
