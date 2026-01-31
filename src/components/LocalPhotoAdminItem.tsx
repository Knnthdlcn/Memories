"use client"

import React, { useState } from 'react'

export type LocalAdminItem = {
  key: string
  srcThumb: string
  srcFull: string
  date: string
  message: string
  featured: boolean
  order?: number
}

export default function LocalPhotoAdminItem({
  item,
  onUpdated,
  onDeleted,
  onMoved,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging,
  selectMode,
  selected,
  onToggleSelect,
  registerItemRef
}: {
  item: LocalAdminItem
  onUpdated: (next: LocalAdminItem) => void
  onDeleted?: () => void
  onMoved?: (prevKey: string, next: LocalAdminItem) => void
  onDragStart?: (item: LocalAdminItem) => void
  onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (item: LocalAdminItem) => void
  isDragging?: boolean
  selectMode?: boolean
  selected?: boolean
  onToggleSelect?: (key: string) => void
  registerItemRef?: (key: string, el: HTMLDivElement | null) => void
}){
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState(item.message || '')
  const [featured, setFeatured] = useState(!!item.featured)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [newMonth, setNewMonth] = useState('')
  const [newDate, setNewDate] = useState('')
  const [useMonth, setUseMonth] = useState(true)
  const [moving, setMoving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/photos/meta/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: item.key, message, featured })
      })
      const j = await res.json()
      if (j.ok) {
        onUpdated({ ...item, message, featured })
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/photos/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: item.key })
      })
      const j = await res.json()
      if (j.ok && onDeleted) {
        onDeleted()
      } else {
        alert(j.error || 'Failed to delete photo')
      }
    } catch (error) {
      alert('Error deleting photo')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const handleMove = async () => {
    if (useMonth && !newMonth) {
      alert('Please select a month')
      return
    }
    if (!useMonth && !newDate) {
      alert('Please select a date')
      return
    }

    setMoving(true)
    try {
      const body: any = { key: item.key }
      if (useMonth) {
        body.newMonth = newMonth
        console.log('[CLIENT] Moving to month:', newMonth)
      } else {
        body.newDate = newDate
        console.log('[CLIENT] Moving to date:', newDate)
      }

      console.log('[CLIENT] Sending move request:', body)

      const res = await fetch('/api/photos/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      console.log('[CLIENT] Response status:', res.status)
      const j = await res.json()
      console.log('[CLIENT] Response data:', j)

      if (j.ok) {
        const nextItem: LocalAdminItem = {
          ...item,
          key: j.newKey || item.key,
          date: j.date || item.date,
          srcThumb: (j.newKey || item.key) + '?w=600',
          srcFull: j.newKey || item.key
        }
        onMoved?.(item.key, nextItem)
        setShowMoveModal(false)
        setNewMonth('')
        setNewDate('')
      } else {
        const errorMsg = j.error || 'Failed to move photo'
        console.error('[CLIENT] Move failed:', errorMsg)
        alert(errorMsg)
      }
    } catch (error) {
      console.error('[CLIENT] Move error:', error)
      alert('Error moving photo: ' + (error as Error).message)
    } finally {
      setMoving(false)
    }
  }

  const openMoveModal = () => {
    // Set default to current photo's month and date
    const d = new Date(item.date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setNewMonth(`${year}-${month}`)
    setNewDate(`${year}-${month}-${day}`)
    setUseMonth(true)
    setShowMoveModal(true)
  }

  const dateLabel = new Date(item.date).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  })

  // Extract folder name from key for display
  const folderMatch = item.key.match(/\/api\/photos\/raw\/([^\/]+)/)
  const folderName = folderMatch ? folderMatch[1] : ''

  return (
    <div 
      className={`soft-card p-3 relative ${isDragging ? 'opacity-50' : ''} ${selectMode && selected ? 'ring-2 ring-purple-500' : ''}`}
      ref={(el) => registerItemRef?.(item.key, el)}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onDragOver?.(e)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop?.(item)
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {selectMode ? (
            <button
              type="button"
              onClick={() => onToggleSelect?.(item.key)}
              className={`px-2 py-1 rounded-full text-xs border ${selected ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/80 text-purple-700 border-white/80'}`}
              title={selected ? 'Unselect' : 'Select'}
            >
              {selected ? 'Selected' : 'Select'}
            </button>
          ) : null}
          <div className="flex flex-col gap-0.5">
          <div className="text-xs text-purple-700/70">{dateLabel}</div>
          {folderName && folderName !== '2025' && (
            <div className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 inline-block w-fit">
              📁 {folderName}
            </div>
          )}
          </div>
        </div>
        {!selectMode ? (
          <button
            type="button"
            className="px-2 py-1 text-xs rounded border bg-white/60 cursor-move"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', item.key)
              onDragStart?.(item)
            }}
            onDragEnd={() => onDragEnd?.()}
            title="Drag to reorder"
          >
            ⠿ Drag
          </button>
        ) : null}
      </div>
      <div className="w-full h-40 bg-purple-100/40 rounded overflow-hidden mb-2 border border-white/60 relative">
        {selectMode ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onToggleSelect?.(item.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onToggleSelect?.(item.key)
            }}
            className="absolute inset-0 z-10"
            aria-label={selected ? 'Unselect photo' : 'Select photo'}
          />
        ) : null}
        <img
          src={item.srcThumb}
          alt=""
          className={`w-full h-full object-cover ${selectMode ? 'pointer-events-none' : ''}`}
          loading="lazy"
          draggable={false}
        />
        {selectMode ? (
          <div className={`absolute top-2 right-2 z-20 w-7 h-7 rounded-full border-2 flex items-center justify-center ${selected ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white/90 border-white'}`}>
            {selected ? '✓' : ''}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-purple-700/70 mb-2">
        <span></span>
        {featured ? <span className="px-2 py-1 rounded-full bg-purple-600 text-white">featured</span> : null}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full p-2 border rounded bg-white/60"
            rows={3}
            placeholder="Write a cute message…"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} /> Featured
          </label>
          <div className="flex gap-2">
            <button onClick={save} className="px-3 py-1 bg-primary text-white rounded" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1 border rounded bg-white/50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="text-sm mb-2 whitespace-pre-wrap text-gray-700">{(item.message || '').trim() || '—'}</div>
          <div className="flex gap-2 flex-wrap">
            <button draggable={false} onClick={() => setEditing(true)} className="px-3 py-1 border rounded bg-white/50 text-sm">
              Edit message
            </button>
            <button draggable={false} onClick={openMoveModal} className="px-3 py-1 border rounded bg-white/50 text-sm hover:bg-white/80">
              📅 Change Date
            </button>
            <a
              href={item.srcFull}
              target="_blank"
              rel="noreferrer"
              draggable={false}
              className="px-3 py-1 border rounded bg-white/50 text-sm"
            >
              Open file
            </a>
            <button 
              draggable={false}
              onClick={handleDelete} 
              className={`px-3 py-1 border rounded text-sm ${
                confirmDelete 
                  ? 'bg-red-600 text-white border-red-600' 
                  : 'bg-white/50 text-red-600 border-red-300 hover:bg-red-50'
              }`}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : confirmDelete ? 'Click again to confirm' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMoveModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 soft-card" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-slate-800">Move Photo to Different Date</h3>
            
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">Current date: <strong>{dateLabel}</strong></p>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 mb-3">
                <input 
                  type="radio" 
                  checked={useMonth} 
                  onChange={() => setUseMonth(true)}
                />
                <span className="text-sm font-semibold">Choose Month</span>
              </label>
              
              {useMonth && (
                <>
                  <input
                    type="month"
                    value={newMonth}
                    onChange={e => setNewMonth(e.target.value)}
                    className="w-full p-2 border rounded bg-white/60 mb-2"
                    placeholder="YYYY-MM"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-01')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Jan 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-02')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Feb 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-03')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Mar 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-04')}
                      className="px-2 py-1 text-xs rounded bg-pink-100 text-pink-700 hover:bg-pink-200 font-semibold"
                    >
                      Apr 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-05')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      May 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-06')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Jun 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-07')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Jul 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-08')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Aug 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-09')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Sep 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-10')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Oct 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-11')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Nov 2025
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMonth('2025-12')}
                      className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                    >
                      Dec 2025
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 mb-3">
                <input 
                  type="radio" 
                  checked={!useMonth} 
                  onChange={() => setUseMonth(false)}
                />
                <span className="text-sm font-semibold">Choose Specific Date</span>
              </label>
              
              {!useMonth && (
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full p-2 border rounded bg-white/60"
                />
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="px-4 py-2 border rounded bg-white/50 hover:bg-white/80"
                disabled={moving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMove}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
                disabled={moving || (useMonth ? !newMonth : !newDate)}
              >
                {moving ? 'Moving…' : 'Move Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
