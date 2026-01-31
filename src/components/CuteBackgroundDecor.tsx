"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import CapybaraSticker from '@/src/components/CapybaraSticker'
import CuteSticker from '@/src/components/CuteSticker'

type MediaItem = {
  id: number
  type: 'photo' | 'video'
  relativePath: string
}

function mulberry32(seed: number){
  return function(){
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, min: number, max: number){
  return Math.min(max, Math.max(min, n))
}

export default function CuteBackgroundDecor({
  photoCount = 8,
  className,
  interactive = true
}: {
  photoCount?: number
  className?: string
  interactive?: boolean
}){
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000_000))
  const [photos, setPhotos] = useState<string[]>([])
  const [vw, setVw] = useState<number>(0)
  const [vh, setVh] = useState<number>(0)
  const dragBoundsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // 1) Prefer local project folder `photos/` (works without Prisma ingest)
        const resLocal = await fetch('/api/photos/list?limit=140', { cache: 'no-store' })
        if (resLocal.ok) {
          const localJson = await resLocal.json()
          const localItems: string[] = Array.isArray(localJson?.items) ? localJson.items : []
          if (localItems.length) {
            if (!cancelled) setPhotos(localItems)
            return
          }
        }

        // 2) Fallback: Prisma-ingested photos under public/media
        const res = await fetch('/api/admin/list', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        const items: MediaItem[] = Array.isArray(json?.items) ? json.items : []
        const photoUrls = items
          .filter(i => i.type === 'photo' && typeof i.relativePath === 'string')
          .map(i => `/${i.relativePath}`)

        if (!cancelled) setPhotos(photoUrls)
      } catch {
        // ignore – we will fall back to decorative gradients
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const update = () => {
      setVw(window.innerWidth || 0)
      setVh(window.innerHeight || 0)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const rng = useMemo(() => mulberry32(seed), [seed])

  const picked = useMemo(() => {
    if (!photos.length) return []
    const shuffled = [...photos]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled.slice(0, clamp(photoCount, 0, 18))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, photoCount, seed])

  const cards = useMemo(() => {
    const baseCount = picked.length ? picked.length : Math.min(8, photoCount)
    const isMobile = vw ? vw < 480 : true
    const columns = isMobile ? 2 : 3
    const rows = Math.max(2, Math.ceil(baseCount / columns))
    const count = Math.min(baseCount, columns * rows)
    const safeVw = vw || 360
    const safeVh = vh || 700
    const slotW = safeVw / columns
    const slotH = safeVh / rows
    const w = Math.max(140, Math.min(200, slotW * 0.78))
    const h = w * 0.72
    const padX = Math.max(10, (slotW - w) / 2)
    const padY = Math.max(10, (slotH - h) / 2)
    const items = Array.from({ length: count }).map((_, idx) => {
      const row = Math.floor(idx / columns)
      const col = idx % columns
      const jitterX = (rng() - 0.5) * Math.min(18, padX)
      const jitterY = (rng() - 0.5) * Math.min(18, padY)
      const left = col * slotW + padX + jitterX
      const top = row * slotH + padY + jitterY
      const rotate = -6 + rng() * 12
      const scale = 0.94 + rng() * 0.12
      const float = 6 + rng() * 8
      const duration = 8 + rng() * 6
      const delay = rng() * 1.5
      return { idx, top, left, rotate, scale, float, duration, delay, w, h }
    })
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, photoCount, seed, vw, vh])

  const shuffle = () => {
    if (!interactive) return
    setSeed(s => (s + 1) % 1_000_000_000)
  }

  return (
    <div className={`absolute inset-0 overflow-hidden ${className || ''}`} aria-hidden="true" ref={dragBoundsRef}>
      {/* soft blobs */}
      <div className="absolute -top-24 -left-28 h-[420px] w-[420px] rounded-full bg-purple-200/40 blur-3xl" />
      <div className="absolute -bottom-28 -right-20 h-[460px] w-[460px] rounded-full bg-pink-200/40 blur-3xl" />
      <div className="absolute top-1/3 -right-28 h-[360px] w-[360px] rounded-full bg-indigo-200/30 blur-3xl" />

      {/* scattered photo polaroids */}
      <div className="absolute inset-0">
        {cards.map(c => {
          const src = picked[c.idx]
          return (
            <motion.div
              key={`${seed}-${c.idx}`}
              className="absolute pointer-events-auto"
              style={{
                top: `${c.top}px`,
                left: `${c.left}px`,
                transform: `rotate(${c.rotate}deg) scale(${c.scale})`,
                touchAction: 'none'
              }}
              initial={{ opacity: 1, y: 0 }}
              animate={{ y: [0, -c.float, 0] }}
              transition={{ duration: c.duration, repeat: Infinity, ease: 'easeInOut', delay: c.delay }}
              drag
              dragListener
              dragPropagation
              dragMomentum={false}
              dragElastic={0.12}
              dragConstraints={dragBoundsRef}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-[0_18px_60px_rgba(99,102,241,0.18)] p-3 touch-none select-none">
                <div
                  className="rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 via-pink-100 to-indigo-100"
                  style={{ width: `${Math.round(c.w)}px`, height: `${Math.round(c.h)}px` }}
                >
                  {src ? (
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover pointer-events-none select-none"
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <div className="h-full w-full relative">
                      <div className="absolute inset-0 opacity-70" style={{
                        backgroundImage:
                          'radial-gradient(circle at 30% 20%, rgba(168,85,247,0.35), transparent 55%),' +
                          'radial-gradient(circle at 70% 60%, rgba(236,72,153,0.25), transparent 55%),' +
                          'radial-gradient(circle at 40% 85%, rgba(99,102,241,0.25), transparent 55%)'
                      }} />
                      <div className="absolute bottom-2 left-2 text-xs text-purple-600/70">memory ✿</div>
                    </div>
                  )}
                </div>
                <div className="mt-2 h-2 w-28 rounded-full bg-purple-200/40" />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* capybara stickers (click to reshuffle) */}
      <div className="absolute inset-0">
        {/* extra tiny cute stickers */}
        <div className="absolute left-1/2 top-10 -translate-x-1/2 opacity-90">
          <CuteSticker variant="egg" className="floaty" />
        </div>
        <div className="absolute left-10 bottom-24 opacity-90 hidden sm:block">
          <CuteSticker variant="icecream" className="floaty" />
        </div>
        <div className="absolute right-1/2 bottom-16 translate-x-1/2 opacity-80 hidden md:block">
          <CuteSticker variant="sparkle" className="wiggle" />
        </div>

        <motion.div
          className="absolute left-6 top-6 pointer-events-auto"
          style={{ touchAction: 'none' }}
          drag
          dragListener
          dragPropagation
          dragMomentum={false}
          dragElastic={0.12}
          dragConstraints={dragBoundsRef}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CapybaraSticker variant="heart" size={150} onClick={shuffle} title="Shuffle background" />
        </motion.div>
        <motion.div
          className="absolute right-8 bottom-8 pointer-events-auto"
          style={{ touchAction: 'none' }}
          drag
          dragListener
          dragPropagation
          dragMomentum={false}
          dragElastic={0.12}
          dragConstraints={dragBoundsRef}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CapybaraSticker variant="sparkle" size={160} onClick={shuffle} title="Shuffle background" />
        </motion.div>
        <motion.div
          className="absolute right-10 top-24 pointer-events-auto hidden md:block"
          style={{ touchAction: 'none' }}
          drag
          dragListener
          dragPropagation
          dragMomentum={false}
          dragElastic={0.12}
          dragConstraints={dragBoundsRef}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CapybaraSticker variant="leaf" size={140} onClick={shuffle} title="Shuffle background" />
        </motion.div>
      </div>

      {/* tiny hint */}
      {interactive && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-purple-700/60 bg-white/40 border border-white/50 backdrop-blur px-3 py-1 rounded-full">
          click a capybara to reshuffle ✨
        </div>
      )}
    </div>
  )
}
