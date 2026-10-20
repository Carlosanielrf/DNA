import { useEffect, useRef } from 'react'

interface Blob {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  hue: number
  alpha: number
}

interface Particle {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  color: string
  alpha: number
}

/**
 * Slow-moving fluid field: soft cyan blobs + warm/cool bokeh sparks,
 * inspired by the DNA reference image atmosphere.
 */
export function FluidBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    let dpr = 1

    const blobs: Blob[] = []
    const particles: Particle[] = []

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const seed = () => {
      blobs.length = 0
      particles.length = 0
      const blobCount = Math.max(5, Math.floor((w * h) / 180000))
      for (let i = 0; i < blobCount; i++) {
        blobs.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 120 + Math.random() * 220,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.1,
          hue: 190 + Math.random() * 40,
          alpha: 0.08 + Math.random() * 0.1,
        })
      }
      const particleCount = Math.max(28, Math.floor((w * h) / 28000))
      for (let i = 0; i < particleCount; i++) {
        const warm = Math.random() > 0.72
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: warm ? 4 + Math.random() * 14 : 1 + Math.random() * 3.5,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.06 - 0.02,
          color: warm
            ? `hsla(${18 + Math.random() * 28}, 90%, ${55 + Math.random() * 20}%, 1)`
            : `hsla(${190 + Math.random() * 30}, 90%, ${65 + Math.random() * 25}%, 1)`,
          alpha: warm ? 0.18 + Math.random() * 0.25 : 0.35 + Math.random() * 0.45,
        })
      }
    }

    const wrap = (v: number, max: number, pad: number) => {
      if (v < -pad) return max + pad
      if (v > max + pad) return -pad
      return v
    }

    const draw = () => {
      // Deep navy → teal fluid base
      const g = ctx.createLinearGradient(0, 0, w * 0.4, h)
      g.addColorStop(0, '#03101f')
      g.addColorStop(0.45, '#06253d')
      g.addColorStop(1, '#0a3a4d')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      // Soft secondary wash
      const g2 = ctx.createRadialGradient(
        w * 0.7,
        h * 0.35,
        0,
        w * 0.7,
        h * 0.35,
        Math.max(w, h) * 0.7,
      )
      g2.addColorStop(0, 'rgba(40, 140, 180, 0.18)')
      g2.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, w, h)

      for (const b of blobs) {
        b.x = wrap(b.x + b.vx, w, b.r)
        b.y = wrap(b.y + b.vy, h, b.r)
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
        grad.addColorStop(0, `hsla(${b.hue}, 80%, 55%, ${b.alpha})`)
        grad.addColorStop(0.55, `hsla(${b.hue + 10}, 70%, 40%, ${b.alpha * 0.35})`)
        grad.addColorStop(1, `hsla(${b.hue}, 60%, 30%, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const p of particles) {
        p.x = wrap(p.x + p.vx, w, p.r * 2)
        p.y = wrap(p.y + p.vy, h, p.r * 2)
        const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
        pg.addColorStop(0, p.color.replace('1)', `${p.alpha})`))
        pg.addColorStop(1, p.color.replace('1)', '0)'))
        ctx.fillStyle = pg
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    resize()
    seed()
    draw()

    const onResize = () => {
      resize()
      seed()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fluid-bg"
      aria-hidden="true"
    />
  )
}
