"use client"
import React, { useMemo, useState } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { FixedSizeGrid as Grid } from 'react-window'
import { motion } from 'framer-motion'
import Image from 'next/image'
import dynamic from 'next/dynamic'

const Lightbox = dynamic(() => import('./Lightbox'))

type Item = {
  id: string
  relativePath: string
  type: string
  message?: string | null
  dateTaken?: string | Date | null
  createdAt?: string | Date
}

export default function MediaGrid({ items }: { items: Item[] }){
  const columnCount = 4
  const rowCount = Math.ceil(items.length / columnCount)
  const [selected, setSelected] = useState<Item | null>(null)
  const MotionDiv = motion.div as unknown as React.ComponentType<
    React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>
  >

  const handleClick = (item: Item) => setSelected(item)

  return (
    <div style={{ height: '80vh' }} className="border rounded">
      <AutoSizer>
        {({ height, width }) => (
          <Grid
            columnCount={columnCount}
            columnWidth={Math.floor(width / columnCount)}
            height={height}
            rowCount={rowCount}
            rowHeight={220}
            width={width}
          >
            {({ columnIndex, rowIndex, style }) => {
              const index = rowIndex * columnCount + columnIndex
              const item = items[index]
              if (!item) return null
              return (
                <div style={style} className="p-1">
                  <MotionDiv whileHover={{ scale: 1.03 }} className="w-full h-full overflow-hidden rounded cursor-pointer" onClick={() => handleClick(item)}>
                    {item.type === 'photo' ? (
                      <div className="relative w-full h-full bg-gray-100">
                        <Image src={`/${item.relativePath}`} alt={item.message || ''} fill sizes="(max-width: 1024px) 25vw, 250px" style={{ objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div className="relative w-full h-full bg-black">
                        <video src={`/${item.relativePath}`} className="w-full h-full object-cover" muted preload="metadata" />
                      </div>
                    )}
                  </MotionDiv>
                </div>
              )
            }}</Grid>
        )}
      </AutoSizer>

      {selected && <Lightbox item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
