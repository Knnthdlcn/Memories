import React from 'react'
import CuteSticker from '@/src/components/CuteSticker'
import { getLocalPhotos } from '@/src/lib/localPhotos'
import StoryTimelineClient from '@/src/components/StoryTimelineClient'
import PhotoStripCollage from '@/src/components/PhotoStripCollage'

function formatMonth(monthIndex: number){
  return new Date(2020, monthIndex, 1).toLocaleString(undefined, { month: 'long' })
}

export default async function Story(){
  const photos = await getLocalPhotos()
  const items = photos.map(p => ({
    key: p.key,
    date: p.date.toISOString(),
    srcThumb: p.srcThumb,
    srcFull: p.srcFull,
    message: p.message || '',
    featured: !!p.featured
  }))

  return (
    <div className="min-h-screen relative overflow-hidden p-4 sm:p-6 md:p-8">
      {/* extra background texture so it's not a plain purple page */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 12%, rgba(168,85,247,0.18), transparent 42%),' +
            'radial-gradient(circle at 78% 22%, rgba(236,72,153,0.14), transparent 45%),' +
            'radial-gradient(circle at 40% 86%, rgba(99,102,241,0.14), transparent 48%),' +
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.22), transparent 55%)',
          backgroundColor: '#f8f2ff'
        }}
      />
      <div className="absolute inset-0 bg-purple-950/16" aria-hidden="true" />
      <PhotoStripCollage stripsCount={4} />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="crystal-card p-5 sm:p-6 md:p-8 text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <CuteSticker variant="sparkle" className="floaty" />
            <h2 className="text-2xl md:text-3xl font-bold text-purple-700">Our Story</h2>
            <CuteSticker variant="heart" className="floaty" />
          </div>
          <p className="text-gray-600">
            A purple little storyline built from your photos — sorted by date.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 text-sm text-purple-700/70 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-white/50 border border-white/70">{photos.length} memories</span>
          </div>
        </div>

        <StoryTimelineClient items={items} />
      </div>
    </div>
  )
}
