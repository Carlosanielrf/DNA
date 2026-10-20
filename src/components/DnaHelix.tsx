import { useEffect, useRef } from 'react'
import { factForSegment, type DnaFact } from '../data/facts'

export interface HitTarget {
  id: string
  segmentIndex: number
  kind: 'sphere' | 'rung'
  cx: number
  cy: number
  r: number
  fact: DnaFact
}

interface DnaHelixProps {
  vertical: boolean
  scale: number
  offset: { x: number; y: number }
  selectedId: string | null
  onSelect: (fact: DnaFact, hitId: string) => void
  onPan: (dx: number, dy: number) => void
  onPinchZoom: (factor: number, centerX: number, centerY: number) => void
}

interface SphereNode {
  x: number
  y: number
  z: number
  strand: 0 | 1
  index: number
  phase: number
}

interface RungNode {
  x1: number
  y1: number
  x2: number
  y2: number
  z: number
  index: number
}

const TURNS = 9
const POINTS_PER_TURN = 28
const TOTAL = TURNS * POINTS_PER_TURN
const AMPLITUDE = 52
const SPACING = 14
const SPHERE_R = 7.2

function buildGeometry(vertical: boolean) {
  const spheres: SphereNode[] = []
  const rungs: RungNode[] = []
  const length = TOTAL * SPACING
  const half = length / 2

  for (let i = 0; i < TOTAL; i++) {
    const t = i / POINTS_PER_TURN
    const phase = t * Math.PI * 2
    const along = i * SPACING - half

    for (const strand of [0, 1] as const) {
      const p = phase + strand * Math.PI
      const lateral = Math.cos(p) * AMPLITUDE
      const depth = Math.sin(p)
      if (vertical) {
        spheres.push({
          x: lateral,
          y: along,
          z: depth,
          strand,
          index: i,
          phase: p,
        })
      } else {
        spheres.push({
          x: along,
          y: lateral,
          z: depth,
          strand,
          index: i,
          phase: p,
        })
      }
    }

    if (i % 3 === 0) {
      const p0 = phase
      const p1 = phase + Math.PI
      const lat0 = Math.cos(p0) * AMPLITUDE
      const lat1 = Math.cos(p1) * AMPLITUDE
      const z = (Math.sin(p0) + Math.sin(p1)) / 2
      if (vertical) {
        rungs.push({
          x1: lat0,
          y1: along,
          x2: lat1,
          y2: along,
          z,
          index: i,
        })
      } else {
        rungs.push({
          x1: along,
          y1: lat0,
          x2: along,
          y2: lat1,
          z,
          index: i,
        })
      }
    }
  }

  return { spheres, rungs, length }
}

export function DnaHelix({
  vertical,
  scale,
  offset,
  selectedId,
  onSelect,
  onPan,
  onPinchZoom,
}: DnaHelixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hitsRef = useRef<HitTarget[]>([])
  const pointerRef = useRef<{
    active: boolean
    id: number
    x: number
    y: number
    moved: boolean
  } | null>(null)
  const pinchRef = useRef<{
    dist: number
    cx: number
    cy: number
  } | null>(null)
  const animRef = useRef(0)
  const timeRef = useRef(0)
  const stateRef = useRef({ vertical, scale, offset, selectedId })

  useEffect(() => {
    stateRef.current = { vertical, scale, offset, selectedId }
  }, [vertical, scale, offset, selectedId])

  useEffect(() => {
    const drawFrame = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { vertical: isVert, scale: sc, offset: off, selectedId: sel } = stateRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const { spheres, rungs } = buildGeometry(isVert)
    const cx = w / 2 + off.x
    const cy = h / 2 + off.y
    const t = timeRef.current

    const project = (x: number, y: number, z: number) => ({
      px: cx + x * sc,
      py: cy + y * sc,
      depth: z,
      size: (SPHERE_R + z * 2.2) * sc,
    })

    hitsRef.current = []

    // Soft ambient glow behind helix
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.45)
    glow.addColorStop(0, 'rgba(140, 230, 255, 0.16)')
    glow.addColorStop(0.4, 'rgba(60, 160, 200, 0.06)')
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    // Sort by depth for painter's algorithm
    const drawnSpheres = spheres
      .map((s) => {
        // Subtle breathing pulse
        const pulse = Math.sin(t * 0.8 + s.phase) * 0.04
        return { ...s, z: s.z + pulse }
      })
      .sort((a, b) => a.z - b.z)

    // Rungs first (behind-ish by z)
    for (const rung of rungs) {
      const a = project(rung.x1, rung.y1, rung.z)
      const b = project(rung.x2, rung.y2, rung.z)
      const midX = (a.px + b.px) / 2
      const midY = (a.py + b.py) / 2
      const alpha = 0.35 + (rung.z + 1) * 0.25
      const fact = factForSegment(rung.index)
      const hitId = `rung-${rung.index}`
      const isSelected = sel === hitId

      ctx.save()
      ctx.strokeStyle = isSelected
        ? fact.accent
        : `rgba(160, 230, 255, ${alpha})`
      ctx.lineWidth = Math.max(2.5, 4.5 * sc) * (isSelected ? 1.35 : 1)
      ctx.lineCap = 'round'
      if (isSelected) {
        ctx.shadowColor = fact.accent
        ctx.shadowBlur = 18
      }
      ctx.beginPath()
      ctx.moveTo(a.px, a.py)
      ctx.lineTo(b.px, b.py)
      ctx.stroke()

      // Beaded rung spheres
      const steps = 5
      for (let s = 0; s <= steps; s++) {
        const u = s / steps
        const rx = a.px + (b.px - a.px) * u
        const ry = a.py + (b.py - a.py) * u
        const rr = Math.max(1.8, 3.2 * sc)
        const rg = ctx.createRadialGradient(rx - rr * 0.3, ry - rr * 0.3, 0, rx, ry, rr)
        rg.addColorStop(0, `rgba(220, 250, 255, ${0.55 + alpha * 0.3})`)
        rg.addColorStop(0.55, `rgba(90, 190, 230, ${0.45 + alpha * 0.2})`)
        rg.addColorStop(1, `rgba(20, 80, 120, ${0.35})`)
        ctx.fillStyle = rg
        ctx.beginPath()
        ctx.arc(rx, ry, rr, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      hitsRef.current.push({
        id: hitId,
        segmentIndex: rung.index,
        kind: 'rung',
        cx: midX,
        cy: midY,
        r: Math.max(14, 18 * sc),
        fact,
      })
    }

    for (const s of drawnSpheres) {
      const { px, py, depth, size } = project(s.x, s.y, s.z)
      const fact = factForSegment(s.index + s.strand)
      const hitId = `sphere-${s.strand}-${s.index}`
      const isSelected = sel === hitId
      const bright = 0.45 + (depth + 1) * 0.28

      // Selection / focus bloom
      if (isSelected || Math.abs(depth) < 0.25) {
        const bloom = ctx.createRadialGradient(px, py, 0, px, py, size * 3.2)
        bloom.addColorStop(
          0,
          isSelected
            ? `${fact.accent}88`
            : 'rgba(200, 245, 255, 0.35)',
        )
        bloom.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = bloom
        ctx.beginPath()
        ctx.arc(px, py, size * 3.2, 0, Math.PI * 2)
        ctx.fill()
      }

      const base = fact.accent
      const rg = ctx.createRadialGradient(
        px - size * 0.35,
        py - size * 0.4,
        size * 0.1,
        px,
        py,
        size,
      )
      rg.addColorStop(0, `rgba(255,255,255,${0.75 * bright})`)
      rg.addColorStop(0.35, base)
      rg.addColorStop(0.75, `rgba(40, 120, 170, ${0.85})`)
      rg.addColorStop(1, `rgba(10, 40, 70, ${0.9})`)

      ctx.beginPath()
      ctx.arc(px, py, Math.max(2, size), 0, Math.PI * 2)
      ctx.fillStyle = rg
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      hitsRef.current.push({
        id: hitId,
        segmentIndex: s.index,
        kind: 'sphere',
        cx: px,
        cy: py,
        r: Math.max(10, size * 1.35),
        fact,
      })
    }

    // Floating sparkles near center
    for (let i = 0; i < 18; i++) {
      const ang = t * 0.15 + i * 0.7
      const rad = 40 + (i % 5) * 18
      const sx = cx + Math.cos(ang) * rad * sc * 0.4
      const sy = cy + Math.sin(ang * 1.3) * rad * sc * 0.25
      const sr = 0.8 + (i % 3) * 0.6
      ctx.fillStyle = `rgba(255,255,255,${0.25 + (Math.sin(t + i) + 1) * 0.2})`
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fill()
    }

    timeRef.current += 0.016
    animRef.current = requestAnimationFrame(drawFrame)
    }

    animRef.current = requestAnimationFrame(drawFrame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const hitTest = (x: number, y: number): HitTarget | null => {
      let best: HitTarget | null = null
      let bestDist = Infinity
      for (const hit of hitsRef.current) {
        const dx = x - hit.cx
        const dy = y - hit.cy
        const d = Math.hypot(dx, dy)
        if (d <= hit.r && d < bestDist) {
          best = hit
          bestDist = d
        }
      }
      return best
    }

    const getPos = (e: PointerEvent | Touch) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && e.isPrimary === false) return
      canvas.setPointerCapture(e.pointerId)
      const pos = getPos(e)
      pointerRef.current = {
        active: true,
        id: e.pointerId,
        x: pos.x,
        y: pos.y,
        moved: false,
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const p = pointerRef.current
      if (!p || !p.active || p.id !== e.pointerId || pinchRef.current) return
      const pos = getPos(e)
      const dx = pos.x - p.x
      const dy = pos.y - p.y
      if (Math.hypot(dx, dy) > 4) p.moved = true
      if (p.moved) {
        onPan(dx, dy)
        p.x = pos.x
        p.y = pos.y
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      const p = pointerRef.current
      if (!p || p.id !== e.pointerId) return
      if (!p.moved && !pinchRef.current) {
        const pos = getPos(e)
        const hit = hitTest(pos.x, pos.y)
        if (hit) onSelect(hit.fact, hit.id)
      }
      pointerRef.current = null
    }

    const touchDist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const a = e.touches[0]
        const b = e.touches[1]
        const rect = canvas.getBoundingClientRect()
        pinchRef.current = {
          dist: touchDist(a, b),
          cx: (a.clientX + b.clientX) / 2 - rect.left,
          cy: (a.clientY + b.clientY) / 2 - rect.top,
        }
        pointerRef.current = null
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const a = e.touches[0]
        const b = e.touches[1]
        const dist = touchDist(a, b)
        const factor = dist / pinchRef.current.dist
        const rect = canvas.getBoundingClientRect()
        const cx = (a.clientX + b.clientX) / 2 - rect.left
        const cy = (a.clientY + b.clientY) / 2 - rect.top
        onPinchZoom(factor, cx, cy)
        pinchRef.current = { dist, cx, cy }
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      onPinchZoom(factor, cx, cy)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [onSelect, onPan, onPinchZoom])

  return (
    <canvas
      ref={canvasRef}
      className="dna-canvas"
      role="img"
      aria-label={
        vertical
          ? 'Dupla hélice de ADN na vertical. Arrasta, amplia e toca nas partes.'
          : 'Dupla hélice de ADN na horizontal. Arrasta, amplia e clica nas partes.'
      }
    />
  )
}
