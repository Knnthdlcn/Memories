import React from 'react'
import dynamic from 'next/dynamic'
import { prisma } from '@/src/lib/prisma'

const MediaGrid = dynamic(() => import('@/src/components/MediaGrid'), { ssr: false })

export default async function Gallery(){
  const items = await prisma.media.findMany({ orderBy: { dateTaken: 'desc' }, take: 1000 })
  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Gallery</h2>
        <MediaGrid items={items} />
      </div>
    </div>
  )
}
