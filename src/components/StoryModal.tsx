"use client"

import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import CuteSticker from '@/src/components/CuteSticker'

export type StoryModalItem = {
  key: string
  srcFull: string
  date: string
  message?: string
  featured?: boolean
}

export default function StoryModal({
  open,
  item,
  onClose
}: {
  open: boolean
  item: StoryModalItem | null
  onClose: () => void
}){
  const MotionDiv = motion.div as unknown as React.ComponentType<
    React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>
  >

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open || !item) return null

  const dateLabel = new Date(item.date).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const message = (item.message || '').trim()
  // Prefer a resized WebP in the modal to avoid downloading the original full-size file on mobile.
  // The raw route supports ?w=... and returns a small-ish WebP.
  const displaySrc = item.srcFull.includes('?') ? `${item.srcFull}&w=1200` : `${item.srcFull}?w=1200`

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-purple-950/35 backdrop-blur-sm overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <MotionDiv
        initial={{ scale: 0.98, y: 8, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.98, y: 8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="relative w-full max-w-3xl max-h-[86vh] overflow-hidden"
        onClick={(e: any) => e.stopPropagation()}
      >
        <div className="soft-card p-3 sm:p-4 md:p-5 border border-white/70 shadow-[0_25px_80px_rgba(99,102,241,0.28)] flex flex-col min-h-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg md:text-xl font-semibold text-purple-700">A memory ✿</h3>
                {item.featured ? (
                  <span className="px-2 py-1 text-xs rounded-full bg-purple-600 text-white">featured</span>
                ) : null}
              </div>
              <div className="text-sm text-purple-700/70">{dateLabel}</div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg bg-white/60 border border-white/70 text-purple-700 hover:bg-white/75"
            >
              Close
            </button>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-5 gap-3 md:gap-4 flex-1 min-h-0">
            <div className="md:col-span-3 flex-none">
              <div className="relative rounded-2xl overflow-hidden bg-purple-100/40 border border-white/60">
                <img
                  src={displaySrc}
                  alt=""
                  className="w-full max-h-[34vh] sm:max-h-[40vh] md:max-h-[62vh] object-contain bg-black/5"
                  decoding="async"
                />
                <div className="absolute left-3 top-3 opacity-90"><CuteSticker variant="sparkle" className="floaty" /></div>
                <div className="absolute right-3 bottom-3 opacity-90"><CuteSticker variant="icecream" className="wiggle" /></div>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col min-h-0 flex-1">
              <div className="soft-card p-3 sm:p-4 h-full border border-white/60 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2">
                  <CuteSticker variant="egg" className="floaty" />
                  <div className="font-semibold text-purple-700">Message</div>
                </div>

                {message ? (
                  <div className="rounded-2xl bg-white/80 border border-white/80 p-3 flex-1 min-h-0 overflow-hidden">
                    <div className="h-full overflow-y-auto pr-2 overscroll-contain text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {message}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">No message yet. Add one in Admin ✨</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </MotionDiv>
    </MotionDiv>
  )
}
