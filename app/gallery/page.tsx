import React from 'react'
import { getLocalPhotos } from '@/src/lib/localPhotos'
import MediaGrid from '@/src/components/MediaGrid'

export const dynamic = 'force-dynamic'

export default async function Gallery(){
  const photos = await getLocalPhotos()
  const items = photos
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 1000)
    .map(p => ({
      key: p.key,
      type: 'photo',
      srcThumb: p.srcThumb,
      srcFull: p.srcFull,
      message: p.message || '',
      dateTaken: p.date.toISOString()
    }))
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Gallery</h2>
        <MediaGrid items={items} />
      </div>
    </div>
  )
}
