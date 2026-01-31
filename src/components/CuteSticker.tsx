import React from 'react'

export type CuteStickerVariant = 'egg' | 'icecream' | 'sparkle' | 'heart'

export default function CuteSticker({
  variant,
  size = 44,
  className,
  title
}: {
  variant: CuteStickerVariant
  size?: number
  className?: string
  title?: string
}){
  const aria = title || variant

  if (variant === 'egg') {
    return (
      <div className={`inline-flex ${className || ''}`} aria-label={aria} role="img">
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 6c10 0 20 16 20 30 0 13-9 22-20 22S12 49 12 36C12 22 22 6 32 6Z" fill="#FFF7ED" />
          <path d="M19 31c3-9 8-18 13-21" stroke="#E9D5FF" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
          <path d="M22 45c3 4 8 6 12 6" stroke="#A78BFA" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
          <path d="M32 6c10 0 20 16 20 30 0 13-9 22-20 22S12 49 12 36C12 22 22 6 32 6Z" stroke="#C4B5FD" strokeWidth="2" />
        </svg>
      </div>
    )
  }

  if (variant === 'icecream') {
    return (
      <div className={`inline-flex ${className || ''}`} aria-label={aria} role="img">
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 28c0-7 6-13 14-13s14 6 14 13c0 7-6 12-14 12S20 35 20 28Z" fill="#FBCFE8" />
          <path d="M26 24c2-3 5-5 8-5" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
          <path d="M34 40 22 56h24L34 40Z" fill="#FDE68A" stroke="#E9D5FF" strokeWidth="2" />
          <path d="M28 48h12" stroke="#A78BFA" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        </svg>
      </div>
    )
  }

  if (variant === 'heart') {
    return (
      <div className={`inline-flex ${className || ''}`} aria-label={aria} role="img">
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M32 54S10 40 10 24c0-7 6-12 13-12 5 0 9 3 11 7 2-4 6-7 11-7 7 0 13 5 13 12 0 16-22 30-22 30Z"
            fill="#FB7185"
            opacity="0.9"
          />
          <path
            d="M32 54S10 40 10 24c0-7 6-12 13-12 5 0 9 3 11 7 2-4 6-7 11-7 7 0 13 5 13 12 0 16-22 30-22 30Z"
            stroke="#E9D5FF"
            strokeWidth="2"
          />
        </svg>
      </div>
    )
  }

  // sparkle
  return (
    <div className={`inline-flex ${className || ''}`} aria-label={aria} role="img">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 8l5 14 14 5-14 5-5 14-5-14-14-5 14-5 5-14Z" fill="#A78BFA" opacity="0.9" />
        <path d="M14 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" fill="#FB7185" opacity="0.55" />
      </svg>
    </div>
  )
}
