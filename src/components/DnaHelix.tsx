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

interface Bead {
  x: number
  y: number
  z: number
  r: number
  seed: number
  strand: 0 | 1 | 2
  index: number
  /** backbone node index for hit testing */
  node: number
}

const TURNS = 8
const POINTS_PER_TURN = 32
const TOTAL = TURNS * POINTS_PER_TURN
const AMPLITUDE = 58
const SPACING = 11

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function buildBeads(vertical: boolean): Bead[] {
  const beads: Bead[] = []
  const half = (TOTAL * SPACING) / 2

  for (let i = 0; i < TOTAL; i++) {
    const t = i / POINTS_PER_TURN
    const phase = t * Math.PI * 2
    const along = i * SPACING - half

    for (const strand of [0, 1] as const) {
      const p = phase + strand * Math.PI
      const amp = AMPLITUDE * (1 + (hash01(i * 13 + strand) - 0.5) * 0.1)
      const lat = Math.cos(p) * amp
      const depth = Math.sin(p)
      const bx = vertical ? lat : along
      const by = vertical ? along : lat

      // Dense cluster of misshapen “cells” per backbone node
      const cluster = 6 + Math.floor(hash01(i * 7 + strand * 3) * 5)
      for (let c = 0; c < cluster; c++) {
        const ang = hash01(i * 41 + strand * 17 + c * 9) * Math.PI * 2
        const dist = hash01(i * 23 + c * 5 + strand) * 7.5
        const jx = Math.cos(ang) * dist + (hash01(c + i) - 0.5) * 2.2
        const jy = Math.sin(ang) * dist * 0.7 + (hash01(c * 3 + i) - 0.5) * 1.8
        const jz = (hash01(c * 11 + strand + i) - 0.5) * 0.35
        beads.push({
          x: bx + (vertical ? jx : jy * 0.35),
          y: by + (vertical ? jy * 0.35 : jx),
          z: depth + jz,
          r: 3.2 + hash01(i * 19 + c * 7 + strand) * 5.8,
          seed: i * 97 + strand * 131 + c * 17,
          strand,
          index: i,
          node: i * 2 + strand,
        })
      }
    }

    // Base-pair rung as a chain of irregular beads
    if (i % 2 === 0) {
      const p0 = phase
      const p1 = phase + Math.PI
      const lat0 = Math.cos(p0) * AMPLITUDE
      const lat1 = Math.cos(p1) * AMPLITUDE
      const z0 = Math.sin(p0)
      const z1 = Math.sin(p1)
      const steps = 7
      for (let s = 0; s <= steps; s++) {
        const u = s / steps
        const wob = (hash01(i * 31 + s) - 0.5) * 4.5
        const lat = lat0 + (lat1 - lat0) * u
        const z = z0 + (z1 - z0) * u + (hash01(i + s * 3) - 0.5) * 0.15
        const alongR = along + (hash01(i + s) - 0.5) * 1.2
        beads.push({
          x: vertical ? lat + wob * 0.15 : alongR,
          y: vertical ? alongR : lat + wob * 0.15,
          z,
          r: 2.4 + hash01(i * 11 + s * 13) * 3.6,
          seed: i * 53 + s * 29 + 400,
          strand: 2,
          index: i,
          node: 10000 + i,
        })
      }
    }
  }

  return beads
}

function drawLumpyBead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  seed: number,
  bright: number,
  soft: number,
  selected: boolean,
) {
  if (radius < 0.6) return
  const alpha = Math.max(0.2, 1 - soft * 0.55)
  const r = radius * (1 + soft * 0.2)
  ctx.save()
  ctx.globalAlpha = alpha

  // Outer soft glow
  const glowR = r * (selected ? 2.8 : 1.9)
  const glow = ctx.createRadialGradient(x, y, r * 0.1, x, y, glowR)
  glow.addColorStop(0, selected ? 'rgba(200,245,255,0.45)' : `rgba(160, 230, 255, ${0.22 * bright})`)
  glow.addColorStop(0.55, `rgba(40, 140, 190, ${0.08 * bright})`)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, glowR, 0, Math.PI * 2)
  ctx.fill()

  // Irregular outline
  const segs = 8 + Math.floor(hash01(seed) * 5)
  ctx.beginPath()
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2
    const wob =
      1 +
      Math.sin(a * 3 + seed) * 0.2 +
      Math.sin(a * 5 + seed * 1.3) * 0.14 +
      Math.cos(a * 2.2 + seed * 0.7) * 0.1 +
      (hash01(seed * 9 + i) - 0.5) * 0.26
    const px = x + Math.cos(a) * r * wob
    const py = y + Math.sin(a) * r * wob
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()

  // Cyan molecular shading (reference palette)
  const hx = x - r * (0.28 + hash01(seed + 1) * 0.2)
  const hy = y - r * (0.32 + hash01(seed + 2) * 0.18)
  const body = ctx.createRadialGradient(hx, hy, r * 0.05, x, y, r * 1.25)
  body.addColorStop(0, `rgba(245, 252, 255, ${0.92 * bright})`)
  body.addColorStop(0.18, `rgba(170, 235, 255, ${0.85 * bright})`)
  body.addColorStop(0.42, `rgba(90, 190, 230, ${0.9})`)
  body.addColorStop(0.7, `rgba(30, 110, 160, ${0.92})`)
  body.addColorStop(1, `rgba(8, 40, 70, ${0.95})`)
  ctx.fillStyle = body
  ctx.fill()

  // Tiny fused lobe for extra deformity
  if (hash01(seed + 40) > 0.35) {
    const ba = hash01(seed + 41) * Math.PI * 2
    const bd = r * (0.4 + hash01(seed + 42) * 0.45)
    const br = r * (0.28 + hash01(seed + 43) * 0.4)
    const bx = x + Math.cos(ba) * bd
    const by = y + Math.sin(ba) * bd
    ctx.beginPath()
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const w = 1 + Math.sin(a * 2.8 + seed) * 0.22 + (hash01(seed + i) - 0.5) * 0.2
      const px = bx + Math.cos(a) * br * w
      const py = by + Math.sin(a) * br * w
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    const lg = ctx.createRadialGradient(bx - br * 0.25, by - br * 0.25, 0, bx, by, br)
    lg.addColorStop(0, `rgba(210, 245, 255, ${0.55 * bright})`)
    lg.addColorStop(1, `rgba(20, 70, 110, ${0.75})`)
    ctx.fillStyle = lg
    ctx.fill()
  }

  // Warm fleck (orange kiss from reference)
  if (hash01(seed + 80) > 0.82) {
    const wa = hash01(seed + 81) * Math.PI * 2
    const wx = x + Math.cos(wa) * r * 0.45
    const wy = y + Math.sin(wa) * r * 0.45
    const wr = r * 0.22
    const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr)
    wg.addColorStop(0, `rgba(255, 175, 110, ${0.45 * bright})`)
    wg.addColorStop(1, 'rgba(255,120,50,0)')
    ctx.fillStyle = wg
    ctx.beginPath()
    ctx.arc(wx, wy, wr, 0, Math.PI * 2)
    ctx.fill()
  }

  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = Math.max(0.8, r * 0.06)
    ctx.stroke()
  }

  ctx.restore()
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
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null)
  const animRef = useRef(0)
  const timeRef = useRef(0)
  const stateRef = useRef({ vertical, scale, offset, selectedId })
  const beadsCache = useRef<{ key: string; beads: Bead[] } | null>(null)

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

      const key = isVert ? 'v' : 'h'
      if (!beadsCache.current || beadsCache.current.key !== key) {
        beadsCache.current = { key, beads: buildBeads(isVert) }
      }
      const beads = beadsCache.current.beads

      const cx = w / 2 + off.x
      const cy = h / 2 + off.y
      const t = timeRef.current

      // Central luminous bloom (like reference spark core)
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.42)
      bloom.addColorStop(0, 'rgba(220, 245, 255, 0.28)')
      bloom.addColorStop(0.25, 'rgba(100, 200, 240, 0.12)')
      bloom.addColorStop(0.55, 'rgba(40, 120, 170, 0.04)')
      bloom.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = bloom
      ctx.fillRect(0, 0, w, h)

      // Distant ghost DNA strands (blurred depth)
      ctx.save()
      ctx.globalAlpha = 0.18
      ctx.filter = 'blur(10px)'
      for (let g = 0; g < 2; g++) {
        const ox = g === 0 ? w * 0.18 : -w * 0.12
        const oy = g === 0 ? -h * 0.08 : h * 0.1
        for (let i = 0; i < 50; i++) {
          const along = (i / 50 - 0.5) * TOTAL * SPACING * 0.7
          const phase = (i / 50) * Math.PI * 10
          const lat = Math.cos(phase) * AMPLITUDE * 1.2
          const gx = isVert ? cx + ox + lat * sc * 0.5 : cx + ox + along * sc * 0.4
          const gy = isVert ? cy + oy + along * sc * 0.4 : cy + oy + lat * sc * 0.5
          const gr = (4 + (i % 4)) * sc
          const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
          gg.addColorStop(0, 'rgba(140, 210, 240, 0.9)')
          gg.addColorStop(1, 'rgba(30, 80, 120, 0)')
          ctx.fillStyle = gg
          ctx.beginPath()
          ctx.arc(gx, gy, gr, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()

      const drawn = beads
        .map((b) => ({
          ...b,
          z: b.z + Math.sin(t * 0.4 + b.seed * 0.01) * 0.025,
        }))
        .sort((a, b) => a.z - b.z)

      hitsRef.current = []
      const hitAccum = new Map<string, { sx: number; sy: number; n: number; fact: DnaFact; kind: 'sphere' | 'rung'; index: number }>()

      for (const b of drawn) {
        const px = cx + b.x * sc
        const py = cy + b.y * sc
        const size = Math.max(1.2, b.r * sc * (0.85 + b.z * 0.2))
        const bright = 0.4 + (b.z + 1) * 0.32
        const soft = Math.min(1, Math.pow(Math.abs(b.z), 1.25) * 0.95)
        const hitId = b.strand === 2 ? `rung-${b.index}` : `sphere-${b.strand}-${b.index}`
        const selected = sel === hitId

        drawLumpyBead(ctx, px, py, size, b.seed, bright, soft, selected)

        const fact = factForSegment(b.index + (b.strand === 2 ? 0 : b.strand))
        const prev = hitAccum.get(hitId)
        if (prev) {
          prev.sx += px
          prev.sy += py
          prev.n += 1
        } else {
          hitAccum.set(hitId, {
            sx: px,
            sy: py,
            n: 1,
            fact,
            kind: b.strand === 2 ? 'rung' : 'sphere',
            index: b.index,
          })
        }
      }

      for (const [id, h] of hitAccum) {
        hitsRef.current.push({
          id,
          segmentIndex: h.index,
          kind: h.kind,
          cx: h.sx / h.n,
          cy: h.sy / h.n,
          r: Math.max(16, 22 * sc),
          fact: h.fact,
        })
      }

      // Sharp white sparks near focus
      for (let i = 0; i < 36; i++) {
        const ang = t * 0.1 + i * 0.48
        const rad = 20 + (i % 8) * 14
        const sx = cx + Math.cos(ang) * rad * sc * 0.5
        const sy = cy + Math.sin(ang * 1.35) * rad * sc * 0.32
        const spark = 0.15 + (Math.sin(t * 1.6 + i) + 1) * 0.28
        const sr = 0.4 + (i % 3) * 0.45
        ctx.fillStyle = `rgba(255,255,255,${spark})`
        ctx.beginPath()
        ctx.arc(sx, sy, sr, 0, Math.PI * 2)
        ctx.fill()
        if (i % 6 === 0) {
          ctx.strokeStyle = `rgba(255,255,255,${spark * 0.65})`
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(sx - sr * 3.5, sy)
          ctx.lineTo(sx + sr * 3.5, sy)
          ctx.moveTo(sx, sy - sr * 3.5)
          ctx.lineTo(sx, sy + sr * 3.5)
          ctx.stroke()
        }
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
        const d = Math.hypot(x - hit.cx, y - hit.cy)
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
      pointerRef.current = { active: true, id: e.pointerId, x: pos.x, y: pos.y, moved: false }
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
      onPinchZoom(e.deltaY > 0 ? 0.92 : 1.08, e.clientX - rect.left, e.clientY - rect.top)
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
      aria-label="Dupla hélice de ADN interativa"
    />
  )
}
