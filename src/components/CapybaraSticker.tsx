"use client"

import React from 'react'
import { motion } from 'framer-motion'

export type CapybaraStickerVariant = 'heart' | 'sparkle' | 'leaf'

export default function CapybaraSticker({
  variant = 'heart',
  size = 160,
  className,
  onClick,
  title = 'capybara sticker'
}: {
  variant?: CapybaraStickerVariant
  size?: number
  className?: string
  onClick?: () => void
  title?: string
}){
  const accent = variant === 'sparkle' ? '#A78BFA' : variant === 'leaf' ? '#34D399' : '#FB7185'
  const MotionButton = motion.button as unknown as React.ComponentType<
    React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>
  >

  return (
    <MotionButton
      type="button"
      onClick={onClick}
      className={
        `select-none relative inline-flex items-center justify-center ` +
        `rounded-[28px] bg-white/70 backdrop-blur ` +
        `shadow-[0_10px_35px_rgba(99,102,241,0.18)] ` +
        `border border-white/70 ` +
        `hover:shadow-[0_14px_45px_rgba(99,102,241,0.22)] ` +
        `active:scale-[0.98] transition ` +
        (className ? ` ${className}` : '')
      }
      aria-label={title}
      whileHover={{ rotate: [-1.5, 1.5, -1.0], transition: { duration: 0.6 } }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="sr-only">{title}</span>
      <svg
        width={size}
        height={Math.round(size * 0.85)}
        viewBox="0 0 220 190"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0px 10px 22px rgba(99,102,241,0.18))' }}
        aria-hidden="true"
      >
        {/* body */}
        <path
          d="M44 112c0-44 33-77 74-77h16c42 0 74 33 74 77 0 36-23 66-55 74-7 2-14 3-22 3h-22c-8 0-15-1-22-3-32-8-43-38-43-74Z"
          fill="#C8A77E"
        />
        {/* belly */}
        <path
          d="M70 120c0-26 20-45 46-45h8c26 0 46 19 46 45 0 21-14 39-33 44-4 1-9 2-13 2h-8c-5 0-9-1-13-2-19-5-33-23-33-44Z"
          fill="#E7D2B6"
          opacity="0.95"
        />
        {/* head */}
        <path
          d="M62 86c0-28 22-50 50-50h-3c28 0 50 22 50 50v8c0 28-22 50-50 50h- -?"
          fill="none"
        />
        <path
          d="M70 80c0-22 18-40 40-40h20c22 0 40 18 40 40v10c0 22-18 40-40 40h-20c-22 0-40-18-40-40V80Z"
          fill="#D8B38A"
        />
        {/* snout */}
        <path
          d="M95 92c0-10 8-18 18-18h14c10 0 18 8 18 18v6c0 10-8 18-18 18h-14c-10 0-18-8-18-18v-6Z"
          fill="#EAD7C0"
        />
        {/* eyes */}
        <circle cx="112" cy="84" r="4" fill="#3F2E21" />
        <circle cx="150" cy="84" r="4" fill="#3F2E21" />
        {/* blush */}
        <circle cx="104" cy="98" r="6" fill="#FB7185" opacity="0.25" />
        <circle cx="158" cy="98" r="6" fill="#FB7185" opacity="0.25" />
        {/* nose */}
        <path d="M129 91c0 2-2 4-5 4s-5-2-5-4 2-4 5-4 5 2 5 4Z" fill="#3F2E21" opacity="0.8" />
        {/* head */}
        {variant === 'heart' && (
          <path
            d="M180 42c0-7 5-12 12-12 5 0 9 3 11 7 2-4 6-7 11-7 7 0 12 5 12 12 0 14-23 28-23 28S180 56 180 42Z"
            fill={accent}
            opacity="0.95"
          />
        )}
        {variant === 'sparkle' && (
          <g fill={accent} opacity="0.9">
            <path d="M193 32l4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z" />
            <path d="M177 58l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
          </g>
        )}
        {variant === 'leaf' && (
          <path
            d="M194 30c-14 2-26 15-27 29 14-2 26-15 27-29Z"
            fill={accent}
            opacity="0.9"
          />
        )}
      </svg>

      <span
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded-full bg-white/75 border border-white/60 text-purple-600"
        aria-hidden="true"
      >
        click me ✨
      </span>
    </MotionButton>
  )
}
