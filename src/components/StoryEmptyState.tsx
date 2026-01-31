"use client"

import React from 'react'

export default function StoryEmptyState(){
  return (
    <div className="max-w-3xl mx-auto soft-card p-8 text-center">
      <h2 className="text-2xl font-semibold mb-2">No memories found yet</h2>
      <p className="text-gray-600 mb-6">
        It looks like you haven&apos;t ingested any media. Put your photos in{' '}
        <code>public/media/photos</code> or videos in <code>public/media/videos</code>, then run the ingest script.
      </p>
      <div className="flex justify-center gap-3 flex-wrap">
        <a href="/admin/login" className="px-4 py-2 bg-primary text-white rounded">
          Go to Admin
        </a>
        <button
          type="button"
          onClick={() => window.alert('Run `npm run ingest` in the project root (local only)')}
          className="px-4 py-2 border rounded bg-white/50"
        >
          How to ingest
        </button>
      </div>
    </div>
  )
}
