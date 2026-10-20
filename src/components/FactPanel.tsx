import type { DnaFact } from '../data/facts'

interface FactPanelProps {
  fact: DnaFact
  onClose?: () => void
  showClose?: boolean
}

export function FactPanel({ fact, onClose, showClose }: FactPanelProps) {
  return (
    <aside className="fact-panel" style={{ ['--fact-accent' as string]: fact.accent }}>
      <div className="fact-panel__glow" aria-hidden="true" />
      <div className="fact-panel__header">
        <div>
          <p className="fact-panel__eyebrow">{fact.subtitle}</p>
          <h2 className="fact-panel__title">{fact.title}</h2>
        </div>
        {showClose && onClose ? (
          <button type="button" className="fact-panel__close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        ) : null}
      </div>
      <p className="fact-panel__body">{fact.body}</p>
    </aside>
  )
}
