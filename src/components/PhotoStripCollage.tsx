"use client"

import React, { useEffect, useMemo, useState } from 'react'

function clamp(n: number, min: number, max: number){
  return Math.min(max, Math.max(min, n))
}

function mulberry32(seed: number){
  return function(){
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Strip = {
  id: string
  leftPx: number
  width: number
  direction: 'up' | 'down'
  speed: number
  opacity: number
}

export default function PhotoStripCollage({
  seed = 123,
  stripsCount = 5,
  className
}: {
  seed?: number
  stripsCount?: number
  className?: string
}){
  const [photos, setPhotos] = useState<string[]>([])
  const [vw, setVw] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/photos/list?limit=300', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        const items: string[] = Array.isArray(json?.items) ? json.items : []
        if (!cancelled) setPhotos(items)
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const update = () => setVw(window.innerWidth || 0)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const rng = useMemo(() => mulberry32(seed), [seed])

  const effectiveCount = useMemo(() => {
    const max = clamp(stripsCount, 1, 4)
     if (!vw) return max
     // Mobile should be tight but not overwhelming.
    if (vw < 420) return Math.min(max, 4)
    if (vw < 640) return Math.min(max, 4)
    if (vw < 768) return Math.min(max, 4)
    if (vw < 1024) return Math.min(max, 4)
    return max
  }, [stripsCount, vw])

  const colWidth = useMemo(() => {
    if (!vw) return 150
    // Keep strips large, but guarantee they fit the screen.
    const raw = Math.floor(vw / effectiveCount) - 4
    return clamp(raw, 200, 280)
  }, [effectiveCount, vw])

  const stripOpacity = useMemo(() => {
    if (!vw) return 0.2
    return vw < 640 ? 0.18 : 0.2
  }, [vw])

  const strips: Strip[] = useMemo(() => {
    const count = clamp(effectiveCount, 1, 6)
    const out: Strip[] = []
    const gap = 8
    const totalWidth = count * colWidth + (count - 1) * gap
    const startLeft = Math.max(0, Math.floor((vw - totalWidth) / 2))
    for (let i = 0; i < count; i++) {
      const leftPx = startLeft + i * (colWidth + gap)
      out.push({
        id: `strip-${seed}-${i}`,
        leftPx,
        width: colWidth,
        direction: i % 2 === 0 ? 'up' : 'down',
        speed: 26 + rng() * 14,
        opacity: stripOpacity
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, effectiveCount, colWidth, stripOpacity, vw])

  const pool = useMemo(() => {
    if (!photos.length) return []
    // Make them lighter and smaller for background usage.
    return photos.map((p: string) => p.replace(/\bw=420\b/g, 'w=320'))
  }, [photos])

  const stripImages = useMemo(() => {
    if (!pool.length) return [] as string[][]
    const out: string[][] = []
    for (let s = 0; s < strips.length; s++) {
      const start = Math.floor(rng() * pool.length)
      const take = clamp(10 + Math.floor(rng() * 10), 10, 22)
      const imgs: string[] = []
      for (let i = 0; i < take; i++) {
        imgs.push(pool[(start + i * 3) % pool.length]!)
      }
      // Duplicate so it loops smoothly.
      out.push([...imgs, ...imgs])
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, strips.length, seed])

  if (!pool.length) return null

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className || ''}`} aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-b from-white/22 via-white/12 to-white/22" />

      {strips.map((s, idx) => {
        const imgs = stripImages[idx] || []
        return (
          <div
            key={s.id}
            className={`absolute top-[-30vh] bottom-[-30vh] ${s.direction === 'up' ? 'photoStripUp' : 'photoStripDown'}`}
            style={{
              left: `${s.leftPx}px`,
              width: `${s.width}px`,
              opacity: s.opacity,
              animationDuration: `${s.speed}s`
            }}
          >
            <div className="h-full w-full photoStripFade">
              <div className="flex flex-col gap-2 py-4">
                {imgs.map((src, i) => (
                  <div
                    key={`${s.id}-${i}`}
                    className="rounded-xl overflow-hidden bg-white/50 border border-white/40"
                    style={{
                      aspectRatio: '3 / 4'
                    }}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover photoStripImg" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
