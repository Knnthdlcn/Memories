"use client"
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Lightbox({ item, onClose }: { item: any, onClose: ()=>void }){
  if (!item) return null
  const MotionDiv = motion.div as unknown as React.ComponentType<
    React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>
  >

  const photoSrc = item?.srcFull || (item?.relativePath ? `/${item.relativePath}` : '')
  const videoSrc = item?.srcFull || (item?.relativePath ? `/${item.relativePath}` : '')

  return (
    <AnimatePresence>
      <MotionDiv initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
        <MotionDiv initial={{scale:0.95}} animate={{scale:1}} exit={{scale:0.95}} className="max-w-3xl w-full">
          <div className="bg-white rounded p-4">
            <div className="mb-2 text-sm text-gray-500">{new Date(item.dateTaken || item.createdAt).toLocaleString()}</div>
            <div className="w-full h-96 bg-black rounded overflow-hidden">
              {item.type === 'photo'
                ? (photoSrc ? <img src={photoSrc} className="w-full h-full object-contain"/> : null)
                : (videoSrc ? <video controls className="w-full h-full"><source src={videoSrc} /></video> : null)}
            </div>
            <div className="mt-3 text-lg whitespace-pre-wrap">{item.message || ''}</div>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="px-4 py-2 bg-primary text-white rounded">Close</button>
            </div>
          </div>
        </MotionDiv>
      </MotionDiv>
    </AnimatePresence>
  )
}
