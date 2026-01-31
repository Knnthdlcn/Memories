"use client"
import React from 'react'
import { motion } from 'framer-motion'

export default function HeroClient({ her }: { her: string }){
  const MotionH1 = motion.h1 as unknown as React.ComponentType<
    React.HTMLAttributes<HTMLHeadingElement> & Record<string, unknown>
  >
  const MotionP = motion.p as unknown as React.ComponentType<
    React.HTMLAttributes<HTMLParagraphElement> & Record<string, unknown>
  >

  return (
    <div className="crystal-card px-10 py-12 sm:px-12 sm:py-14 max-w-3xl w-full text-center">
      <MotionH1
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 mb-4"
      >
        Happy 1st Monthsary, {her} 💜
      </MotionH1>
      <MotionP
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-8"
      >
        A little story of us — memories gathered into a gentle timeline.
      </MotionP>
      <div className="flex justify-center">
        <a
          href="/story"
          className="px-7 py-3 rounded-full bg-gradient-to-r from-slate-900 to-purple-700 text-white shadow-[0_18px_45px_rgba(76,29,149,0.35)] hover:shadow-[0_22px_55px_rgba(76,29,149,0.45)] hover:-translate-y-0.5 transition-all"
        >
          Start the story
        </a>
      </div>
    </div>
  )
}
