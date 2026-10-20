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
  /** Deterministic seed for organic deformation */
  seed: number
  sizeMul: number
}

interface RungNode {
  x1: number
  y1: number
  x2: number
  y2: number
  z: number
  index: number
  seed: number
}

const TURNS = 9
const POINTS_PER_TURN = 26
const TOTAL = TURNS * POINTS_PER_TURN
const AMPLITUDE = 54
const SPACING = 15
const SPHERE_R = 8.4

/** Stable pseudo-random in [0,1) from integer seed */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

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
      // Slight irregular radius — not a perfect cylinder of helix
      const ampJitter = 1 + (hash01(i * 17 + strand * 91) - 0.5) * 0.12
      const lateral = Math.cos(p) * AMPLITUDE * ampJitter
      const depth = Math.sin(p)
      const seed = i * 97 + strand * 131 + 7
      const sizeMul = 0.62 + hash01(seed) * 0.72
      const node: SphereNode = {
        x: vertical ? lateral : along,
        y: vertical ? along : lateral,
        z: depth,
        strand,
        index: i,
        phase: p,
        seed,
        sizeMul,
      }
      // Tiny positional jitter for organic uneven spacing
      const jx = (hash01(seed + 3) - 0.5) * 3.2
      const jy = (hash01(seed + 5) - 0.5) * 2.4
      if (vertical) {
        node.x += jx
        node.y += jy * 0.4
      } else {
        node.x += jy * 0.4
        node.y += jx
      }
      spheres.push(node)
    }

    if (i % 3 === 0) {
      const p0 = phase
      const p1 = phase + Math.PI
      const lat0 = Math.cos(p0) * AMPLITUDE
      const lat1 = Math.cos(p1) * AMPLITUDE
      const z = (Math.sin(p0) + Math.sin(p1)) / 2
      const seed = i * 53 + 19
      if (vertical) {
        rungs.push({ x1: lat0, y1: along, x2: lat1, y2: along, z, index: i, seed })
      } else {
        rungs.push({ x1: along, y1: lat0, x2: along, y2: lat1, z, index: i, seed })
      }
    }
  }

  return { spheres, rungs }
}

/**
 * Draw an imperfect organic “cell” blob: lumpy outline + overlapping lobes + grain.
 */
function blobPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  seed: number,
  segments: number,
) {
  ctx.beginPath()
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const wobble =
      1 +
      Math.sin(a * 3 + seed) * 0.22 +
      Math.sin(a * 5 + seed * 1.7) * 0.16 +
      Math.cos(a * 2 + seed * 0.4) * 0.12 +
      Math.sin(a * 7 + seed * 2.3) * 0.08 +
      (hash01(seed * 10 + i) - 0.5) * 0.28
    const rr = radius * wobble
    const px = x + Math.cos(a) * rr
    const py = y + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

/**
 * Imperfect organic “cell” bead: lumpy outline, fused buds, grain — not a perfect circle.
 */
function drawOrganicBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  seed: number,
  opts: {
    bright: number
    accent: string
    selected: boolean
    /** 0 = sharp focus, 1 = soft/out-of-focus */
    soft: number
  },
) {
  const { bright, accent, selected, soft } = opts
  if (radius < 0.8) return

  const alpha = 1 - soft * 0.45
  const r = radius * (1 + soft * 0.25)
  ctx.save()
  ctx.globalAlpha = alpha

  // Soft outer glow
  const glowR = r * (selected ? 3.2 : 2.35)
  const glow = ctx.createRadialGradient(x, y, r * 0.15, x, y, glowR)
  glow.addColorStop(0, selected ? `${accent}70` : `rgba(180, 235, 255, ${0.28 * bright})`)
  glow.addColorStop(0.5, `rgba(50, 150, 190, ${0.12 * bright})`)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, glowR, 0, Math.PI * 2)
  ctx.fill()

  const lobes = 8 + Math.floor(hash01(seed) * 5)
  blobPath(ctx, x, y, r, seed, lobes)

  const hx = x - r * (0.22 + hash01(seed + 1) * 0.22)
  const hy = y - r * (0.28 + hash01(seed + 2) * 0.22)
  const body = ctx.createRadialGradient(hx, hy, r * 0.05, x, y, r * 1.2)
  body.addColorStop(0, `rgba(245, 252, 255, ${0.9 * bright})`)
  body.addColorStop(0.2, `rgba(150, 225, 250, ${0.8 * bright})`)
  body.addColorStop(0.48, accent)
  body.addColorStop(0.75, `rgba(25, 95, 145, ${0.9})`)
  body.addColorStop(1, `rgba(6, 30, 55, ${0.96})`)
  ctx.fillStyle = body
  ctx.fill()

  // Fused misshapen buds — cluster of irregular cells
  const budCount = 3 + Math.floor(hash01(seed + 8) * 3)
  for (let b = 0; b < budCount; b++) {
    const ba = hash01(seed + 20 + b) * Math.PI * 2
    const bd = r * (0.28 + hash01(seed + 30 + b) * 0.58)
    const br = r * (0.3 + hash01(seed + 40 + b) * 0.48)
    const bx = x + Math.cos(ba) * bd
    const by = y + Math.sin(ba) * bd
    blobPath(ctx, bx, by, br, seed + 50 + b, 6)
    const bg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 0, bx, by, br * 1.15)
    bg.addColorStop(0, `rgba(220, 245, 255, ${0.6 * bright})`)
    bg.addColorStop(0.5, `rgba(70, 170, 210, ${0.6})`)
    bg.addColorStop(1, `rgba(12, 50, 85, ${0.8})`)
    ctx.fillStyle = bg
    ctx.fill()
  }

  // Porous grain (skip when soft to keep DOF cheap)
  if (soft < 0.55) {
    const speckles = 3 + Math.floor(hash01(seed + 60) * 5)
    for (let s = 0; s < speckles; s++) {
      const sa = hash01(seed + 70 + s) * Math.PI * 2
      const sd = hash01(seed + 80 + s) * r * 0.68
      const sx = x + Math.cos(sa) * sd
      const sy = y + Math.sin(sa) * sd
      const sr = r * (0.035 + hash01(seed + 90 + s) * 0.09)
      ctx.fillStyle = `rgba(255,255,255,${0.12 + hash01(seed + 100 + s) * 0.35})`
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Warm amber fleck (reference orange kiss)
  if (hash01(seed + 200) > 0.74) {
    const wa = hash01(seed + 201) * Math.PI * 2
    const wd = r * 0.5
    const wx = x + Math.cos(wa) * wd
    const wy = y + Math.sin(wa) * wd
    const wr = r * 0.2
    const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr)
    wg.addColorStop(0, `rgba(255, 185, 115, ${0.5 * bright})`)
    wg.addColorStop(1, 'rgba(255, 130, 50, 0)')
    ctx.fillStyle = wg
    ctx.beginPath()
    ctx.arc(wx, wy, wr, 0, Math.PI * 2)
    ctx.fill()
  }

  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = Math.max(1, r * 0.07)
    blobPath(ctx, x, y, r * 1.06, seed, lobes)
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
  const pinchRef = useRef<{
    dist: number
    cx: number
    cy: number
  } | null>(null)
  const animRef = useRef(0)
  const timeRef = useRef(0)
  const stateRef = useRef({ vertical, scale, offset, selectedId })
  const geoCache = useRef<{ key: string; spheres: SphereNode[]; rungs: RungNode[] } | null>(
    null,
  )

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

      const geoKey = isVert ? 'v' : 'h'
      if (!geoCache.current || geoCache.current.key !== geoKey) {
        const g = buildGeometry(isVert)
        geoCache.current = { key: geoKey, spheres: g.spheres, rungs: g.rungs }
      }
      const { spheres, rungs } = geoCache.current

      const cx = w / 2 + off.x
      const cy = h / 2 + off.y
      const t = timeRef.current

      const project = (x: number, y: number, z: number, sizeMul = 1) => ({
        px: cx + x * sc,
        py: cy + y * sc,
        depth: z,
        size: (SPHERE_R * sizeMul + z * 2.4) * sc,
      })

      hitsRef.current = []

      // Soft ambient bloom behind helix
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5)
      glow.addColorStop(0, 'rgba(120, 220, 255, 0.2)')
      glow.addColorStop(0.35, 'rgba(40, 130, 180, 0.08)')
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      // Ghost helix in background for depth (blurred distant strand)
      ctx.save()
      ctx.globalAlpha = 0.22
      ctx.filter = 'blur(8px)'
      for (let g = 0; g < 40; g++) {
        const along = (g / 40 - 0.5) * TOTAL * SPACING * 0.85
        const phase = (g / 40) * Math.PI * 8
        const lat = Math.cos(phase) * AMPLITUDE * 1.35
        const gx = isVert ? cx + (lat + 70) * sc * 0.55 : cx + along * sc * 0.45 + 90
        const gy = isVert ? cy + along * sc * 0.45 - 40 : cy + (lat - 40) * sc * 0.55
        const gr = (5 + (g % 5)) * sc
        const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
        gg.addColorStop(0, 'rgba(140, 210, 240, 0.7)')
        gg.addColorStop(1, 'rgba(40, 100, 140, 0)')
        ctx.fillStyle = gg
        ctx.beginPath()
        ctx.arc(gx, gy, gr, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      const drawnSpheres = spheres
        .map((s) => {
          const pulse = Math.sin(t * 0.55 + s.phase) * 0.03
          return { ...s, z: s.z + pulse }
        })
        .sort((a, b) => a.z - b.z)

      // Rungs as chains of deformed beads
      for (const rung of rungs) {
        const a = project(rung.x1, rung.y1, rung.z)
        const b = project(rung.x2, rung.y2, rung.z)
        const midX = (a.px + b.px) / 2
        const midY = (a.py + b.py) / 2
        const bright = 0.4 + (rung.z + 1) * 0.28
        const fact = factForSegment(rung.index)
        const hitId = `rung-${rung.index}`
        const isSelected = sel === hitId
        const soft = Math.min(1, Math.abs(rung.z) * 0.85)

        const steps = 6
        for (let s = 0; s <= steps; s++) {
          const u = s / steps
          // Slight curve / wobble along the rung
          const wob =
            Math.sin(u * Math.PI) * (hash01(rung.seed + s) - 0.5) * 6 * sc
          const rx = a.px + (b.px - a.px) * u + (isVert ? 0 : wob)
          const ry = a.py + (b.py - a.py) * u + (isVert ? wob : 0)
          const rr = Math.max(2.2, (3.6 + hash01(rung.seed + s * 3) * 2.2) * sc)
          drawOrganicBlob(ctx, rx, ry, rr, rung.seed + s * 17, {
            bright,
            accent: isSelected ? fact.accent : '#6ec8e8',
            selected: isSelected && s === Math.floor(steps / 2),
            soft,
          })
        }

        hitsRef.current.push({
          id: hitId,
          segmentIndex: rung.index,
          kind: 'rung',
          cx: midX,
          cy: midY,
          r: Math.max(16, 20 * sc),
          fact,
        })
      }

      for (const s of drawnSpheres) {
        const { px, py, depth, size } = project(s.x, s.y, s.z, s.sizeMul)
        const fact = factForSegment(s.index + s.strand)
        const hitId = `sphere-${s.strand}-${s.index}`
        const isSelected = sel === hitId
        const bright = 0.42 + (depth + 1) * 0.3
        // Soft focus away from focal plane (z≈0)
        const soft = Math.min(1, Math.pow(Math.abs(depth), 1.35))

        // Cyan-forward palette; accent only on selection / warm flecks inside blob
        const accent = isSelected ? fact.accent : '#7ad4f0'

        drawOrganicBlob(ctx, px, py, Math.max(2.2, size), s.seed, {
          bright,
          accent,
          selected: isSelected,
          soft,
        })

        hitsRef.current.push({
          id: hitId,
          segmentIndex: s.index,
          kind: 'sphere',
          cx: px,
          cy: py,
          r: Math.max(11, size * 1.4),
          fact,
        })
      }

      // Sharp sparkles near focus (like the reference)
      for (let i = 0; i < 28; i++) {
        const ang = t * 0.12 + i * 0.55
        const rad = 30 + (i % 7) * 16
        const sx = cx + Math.cos(ang) * rad * sc * 0.45
        const sy = cy + Math.sin(ang * 1.25) * rad * sc * 0.28
        const sr = 0.5 + (i % 4) * 0.55
        const spark = 0.2 + (Math.sin(t * 1.4 + i) + 1) * 0.25
        ctx.fillStyle = `rgba(255,255,255,${spark})`
        ctx.beginPath()
        ctx.arc(sx, sy, sr, 0, Math.PI * 2)
        ctx.fill()
        // Cross sparkle for a few
        if (i % 5 === 0) {
          ctx.strokeStyle = `rgba(255,255,255,${spark * 0.7})`
          ctx.lineWidth = 0.7
          ctx.beginPath()
          ctx.moveTo(sx - sr * 3, sy)
          ctx.lineTo(sx + sr * 3, sy)
          ctx.moveTo(sx, sy - sr * 3)
          ctx.lineTo(sx, sy + sr * 3)
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
