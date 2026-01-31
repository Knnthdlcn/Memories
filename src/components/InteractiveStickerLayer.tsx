"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import CapybaraSticker from '@/src/components/CapybaraSticker'
import CuteSticker, { CuteStickerVariant } from '@/src/components/CuteSticker'

type StickerKind =
  | { kind: 'cute'; variant: CuteStickerVariant; size: number }
  | { kind: 'capy'; variant: 'heart' | 'sparkle' | 'leaf'; size: number }

type StickerItem = {
  id: string
  x: number
  y: number
  rotate: number
  kind: StickerKind
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

function defaultStickerKinds(): StickerKind[]{
  return [
    { kind: 'capy', variant: 'heart', size: 140 },
    { kind: 'capy', variant: 'sparkle', size: 150 },
    { kind: 'capy', variant: 'leaf', size: 130 },
    { kind: 'cute', variant: 'egg', size: 56 },
    { kind: 'cute', variant: 'icecream', size: 56 },
    { kind: 'cute', variant: 'sparkle', size: 56 },
    { kind: 'cute', variant: 'heart', size: 56 },
  ]
}

export default function InteractiveStickerLayer({
  seed = 1,
  className,
  hint = true
}: {
  seed?: number
  className?: string
  hint?: boolean
}){
  const [activeId, setActiveId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const MotionDiv = motion.div as unknown as React.ComponentType<
    React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>
  >

  const stickers: StickerItem[] = useMemo(() => {
    const rng = mulberry32(seed)
    const kinds = defaultStickerKinds()

    return kinds.map((kind, idx) => {
      // Use percentages so it feels responsive.
      // Avoid putting things too close to edges.
      const x = clamp(6 + rng() * 88, 6, 94)
      const y = clamp(10 + rng() * 78, 10, 92)
      const rotate = -18 + rng() * 36
      return {
        id: `stk-${seed}-${idx}`,
        x,
        y,
        rotate,
        kind
      }
    })
  }, [seed])

  useEffect(() => {
    // Ensure dragConstraints works after mount.
    setReady(true)
  }, [])

  return (
    <div ref={containerRef} className={`absolute inset-0 ${className || ''}`} aria-hidden="true">
      {/* We keep the layer non-blocking for scrolling; only the stickers accept pointer events. */}
      <div className="absolute inset-0 pointer-events-none">
        {stickers.map((s, idx) => {
          const z = activeId === s.id ? 40 : 10 + idx
          const className = 'absolute pointer-events-auto select-none touch-none'
          const style: React.CSSProperties = {
            left: `${s.x}%`,
            top: `${s.y}%`,
            zIndex: z
          }

          return (
            <MotionDiv
              key={s.id}
              className={className}
              style={style}
              onPointerDown={() => setActiveId(s.id)}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              drag
              dragMomentum={false}
              dragElastic={0.12}
              dragConstraints={ready ? (containerRef as any) : undefined}
              whileDrag={{ scale: 1.06, rotate: 0 }}
            >
              <div style={{ transform: `translate(-50%, -50%) rotate(${s.rotate}deg)` }}>
                {s.kind.kind === 'capy' ? (
                  <CapybaraSticker variant={s.kind.variant} size={s.kind.size} title="Drag me" />
                ) : (
                  <div style={{ width: s.kind.size, height: s.kind.size }}>
                    <CuteSticker variant={s.kind.variant} className="" />
                  </div>
                )}
              </div>
            </MotionDiv>
          )
        })}

        {hint ? (
          <div className="absolute left-1/2 top-4 -translate-x-1/2 text-xs text-purple-700/70 bg-white/50 border border-white/70 backdrop-blur px-3 py-1 rounded-full">
            drag the stickers around ✿
          </div>
        ) : null}
      </div>
    </div>
  )
}
