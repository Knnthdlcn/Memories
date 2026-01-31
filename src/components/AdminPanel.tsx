"use client"
import React, { useEffect, useState, useMemo } from 'react'
import AdminItem from './AdminItem'
import LocalPhotoAdminItem, { LocalAdminItem } from './LocalPhotoAdminItem'
import imageCompression from 'browser-image-compression'

type MonthGroup = {
  id: string
  label: string
  count: number
  items: LocalAdminItem[]
}

function monthId(d: Date){
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function monthLabel(d: Date){
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
}

export default function AdminPanel(){
  const [items, setItems] = useState<any[]>([])
  const [localItems, setLocalItems] = useState<LocalAdminItem[]>([])
  const [query, setQuery] = useState('')
  const [folderFilter, setFolderFilter] = useState<string>('all')
  const [tab, setTab] = useState<'ingested' | 'local'>('local')
  const [sortDir, setSortDir] = useState<'newest' | 'oldest'>('newest')
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  const [draggedItem, setDraggedItem] = useState<LocalAdminItem | null>(null)
  const [dragOverItem, setDragOverItem] = useState<LocalAdminItem | null>(null)
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [migrateState, setMigrateState] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; total: number; completed: number; message?: string; recent?: { name: string; status: 'uploaded' | 'skipped' | 'failed'; info?: string }[] }>(
    { status: 'idle', total: 0, completed: 0, recent: [] }
  )
  const [selectMode, setSelectMode] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [bulkNewMonth, setBulkNewMonth] = useState('')
  const [bulkNewDate, setBulkNewDate] = useState('')
  const [bulkUseMonth, setBulkUseMonth] = useState(true)
  const [bulkMoving, setBulkMoving] = useState(false)
  const [fixState, setFixState] = useState<{ status: 'idle' | 'running' | 'done' | 'error'; total: number; completed: number; message?: string; recent?: { name: string; status: 'moved' | 'skipped' | 'failed'; info?: string }[] }>(
    { status: 'idle', total: 0, completed: 0, recent: [] }
  )
  const itemRefs = React.useRef<Map<string, HTMLDivElement | null>>(new Map())
  const [lasso, setLasso] = useState<{ active: boolean; startX: number; startY: number; endX: number; endY: number; scrollX: number; scrollY: number }>({ active: false, startX: 0, startY: 0, endX: 0, endY: 0, scrollX: 0, scrollY: 0 })
  const lassoBase = React.useRef<Set<string>>(new Set())
  const lassoMode = React.useRef<'replace' | 'add' | 'remove'>('replace')

  useEffect(()=>{ fetchItems(); fetchLocal() }, [])

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll)
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (migrateState.status !== 'running') return

    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/photos/migrate')
        const j = await res.json()
        if (j.ok) {
          setMigrateState({
            status: j.status,
            total: j.total || 0,
            completed: j.completed || 0,
            message: j.message,
            recent: j.recent || []
          })
          if (j.status === 'done') {
            setNotification({ message: 'Migration complete! ✅', type: 'success' })
            setTimeout(() => setNotification(null), 4000)
            fetchLocal()
          }
          if (j.status === 'error') {
            setNotification({ message: j.message || 'Migration failed', type: 'error' })
            setTimeout(() => setNotification(null), 4000)
          }
        }
      } catch (error) {
        console.error('Failed to poll migration status', error)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [migrateState.status])

  useEffect(() => {
    if (fixState.status !== 'running') return

    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/photos/fix-wrong-month')
        const j = await res.json()
        if (j.ok) {
          setFixState({
            status: j.status,
            total: j.total || 0,
            completed: j.completed || 0,
            message: j.message,
            recent: j.recent || []
          })
          if (j.status === 'done') {
            setNotification({ message: 'Auto-fix complete! ✅', type: 'success' })
            setTimeout(() => setNotification(null), 4000)
            fetchLocal()
          }
          if (j.status === 'error') {
            setNotification({ message: j.message || 'Auto-fix failed', type: 'error' })
            setTimeout(() => setNotification(null), 4000)
          }
        }
      } catch (error) {
        console.error('Failed to poll fix status', error)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [fixState.status])

  async function fetchItems(){
    const res = await fetch('/api/admin/list')
    const j = await res.json()
    if (j.ok) setItems(j.items)
  }

  async function fetchLocal(){
    const res = await fetch('/api/photos/meta/list', { cache: 'no-store' })
    const j = await res.json()
    if (j.ok) setLocalItems(j.items)
  }

  const onUpdated = (m:any) => {
    setItems(prev => prev.map(p=> p.id===m.id? m : p))
  }

  const onLocalUpdated = (next: LocalAdminItem) => {
    setLocalItems(prev => prev.map(p => (p.key === next.key ? next : p)))
  }

  const onLocalMoved = (prevKey: string, next: LocalAdminItem) => {
    setLocalItems(prev => {
      const withoutPrev = prev.filter(p => p.key !== prevKey)
      return [...withoutPrev, next]
    })
  }

  const onLocalDeleted = (key: string) => {
    setLocalItems(prev => prev.filter(p => p.key !== key))
  }

  const toggleSelect = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const clearSelection = () => setSelectedKeys(new Set())

  const registerItemRef = (key: string, el: HTMLDivElement | null) => {
    itemRefs.current.set(key, el)
  }

  const updateSelectionFromLasso = (nextLasso: { startX: number; startY: number; endX: number; endY: number; scrollX: number; scrollY: number }) => {
    const left = Math.min(nextLasso.startX, nextLasso.endX)
    const right = Math.max(nextLasso.startX, nextLasso.endX)
    const top = Math.min(nextLasso.startY, nextLasso.endY)
    const bottom = Math.max(nextLasso.startY, nextLasso.endY)

    const next = new Set<string>(lassoBase.current)
    for (const [key, el] of itemRefs.current.entries()) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const absLeft = rect.left + window.scrollX
      const absRight = rect.right + window.scrollX
      const absTop = rect.top + window.scrollY
      const absBottom = rect.bottom + window.scrollY
      const intersects = !(absRight < left || absLeft > right || absBottom < top || absTop > bottom)
      if (!intersects) continue
      if (lassoMode.current === 'remove') next.delete(key)
      else next.add(key)
    }
    setSelectedKeys(next)
  }

  const handleDragStart = (item: LocalAdminItem) => {
    setDraggedItem(item)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverItem(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (targetItem: LocalAdminItem) => {
    if (!draggedItem || draggedItem.key === targetItem.key) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    // Check if they're in the same month
    const draggedDate = new Date(draggedItem.date)
    const targetDate = new Date(targetItem.date)
    const draggedMonth = monthId(draggedDate)
    const targetMonth = monthId(targetDate)

    if (draggedMonth !== targetMonth) {
      setNotification({ message: 'Can only reorder photos within the same month', type: 'error' })
      setTimeout(() => setNotification(null), 3000)
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    // Reorder items
    const monthItems = localItems.filter(item => {
      const d = new Date(item.date)
      return monthId(d) === draggedMonth
    })

    // Sort by current order or date
    monthItems.sort((a, b) => {
      if (typeof a.order === 'number' && typeof b.order === 'number') {
        return a.order - b.order
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })

    const draggedIndex = monthItems.findIndex(i => i.key === draggedItem.key)
    const targetIndex = monthItems.findIndex(i => i.key === targetItem.key)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null)
      setDragOverItem(null)
      return
    }

    // Remove dragged item and insert at target position
    monthItems.splice(draggedIndex, 1)
    monthItems.splice(targetIndex, 0, draggedItem)

    // Update order for all items in this month
    const updates = monthItems.map((item, index) => ({
      key: item.key,
      order: index
    }))

    // Optimistically update local state immediately
    setLocalItems(prev => prev.map(item => {
      const update = updates.find(u => u.key === item.key)
      return update ? { ...item, order: update.order } : item
    }))

    // Send updates to server in background (no blocking UI)
    fetch('/api/photos/meta/update-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    }).catch(error => {
      console.error('Failed to update order:', error)
    })

    setDraggedItem(null)
    setDragOverItem(null)
  }

  const filtered = items.filter(i => i.relativePath.includes(query) || (i.message||'').includes(query))
  
  // Extract unique folder paths from localItems for the filter dropdown
  const folders = useMemo(() => {
    const folderSet = new Set<string>()
    localItems.forEach(item => {
      // Extract folder from key path like "/api/photos/raw/NEW PHOTOS/photo.jpg"
      const match = item.key.match(/\/api\/photos\/raw\/([^\/]+)/)
      if (match && match[1]) {
        folderSet.add(match[1])
      }
    })
    return Array.from(folderSet).sort()
  }, [localItems])
  
  const localFiltered = localItems.filter(i => {
    // Filter by search query (message or path)
    const matchesQuery = query === '' || (i.message || '').toLowerCase().includes(query.toLowerCase()) || i.key.toLowerCase().includes(query.toLowerCase())
    
    // Filter by folder if not 'all'
    const matchesFolder = folderFilter === 'all' || i.key.includes(`/raw/${folderFilter}/`)
    
    return matchesQuery && matchesFolder
  })

  // Group local photos by month
  const monthGroups: MonthGroup[] = useMemo(() => {
    const byMonth = new Map<string, MonthGroup>()

    const sorted = [...localFiltered].sort((a, b) => {
      const da = new Date(a.date).getTime()
      const db = new Date(b.date).getTime()
      return sortDir === 'newest' ? db - da : da - db
    })

    for (const it of sorted) {
      const d = new Date(it.date)
      const mId = monthId(d)
      if (!byMonth.has(mId)) {
        byMonth.set(mId, { id: mId, label: monthLabel(d), count: 0, items: [] })
      }

      const month = byMonth.get(mId)!
      month.items.push(it)
      month.count++
    }

    // Sort items within each month by order if available, otherwise by date
    for (const month of byMonth.values()) {
      month.items.sort((a, b) => {
        if (typeof a.order === 'number' && typeof b.order === 'number') {
          return a.order - b.order
        }
        if (typeof a.order === 'number') return -1
        if (typeof b.order === 'number') return 1
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      })
    }

    return Array.from(byMonth.values())
  }, [localFiltered, sortDir])

  useEffect(() => {
    // Default: open the first month
    if (!monthGroups.length) return
    setOpenMonths(prev => {
      if (Object.keys(prev).length) return prev
      return { [monthGroups[0]!.id]: true }
    })
  }, [monthGroups])

  const toggleMonth = (id: string) => {
    setOpenMonths(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const expandAll = () => {
    const nextMonths: Record<string, boolean> = {}
    for (const g of monthGroups) {
      nextMonths[g.id] = true
    }
    setOpenMonths(nextMonths)
  }

  const collapseAll = () => {
    setOpenMonths({})
  }

  const scrollToMonth = (id: string) => {
    const el = document.getElementById(`month-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setOpenMonths(prev => ({ ...prev, [id]: true }))
  }

  const handleBulkMove = async () => {
    if (!selectedKeys.size) return
    if (bulkUseMonth && !bulkNewMonth) return
    if (!bulkUseMonth && !bulkNewDate) return

    setBulkMoving(true)
    try {
      const keys = Array.from(selectedKeys)
      for (const key of keys) {
        const body: any = { key }
        if (bulkUseMonth) body.newMonth = bulkNewMonth
        else body.newDate = bulkNewDate

        await fetch('/api/photos/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      }
      setNotification({ message: `Moved ${keys.length} photo(s)`, type: 'success' })
      setTimeout(() => setNotification(null), 3000)
      setBulkMoveOpen(false)
      clearSelection()
      fetchLocal()
    } catch (error) {
      setNotification({ message: 'Failed to move selected photos', type: 'error' })
      setTimeout(() => setNotification(null), 3000)
    } finally {
      setBulkMoving(false)
    }
  }

  return (
    <div>
      {notification && (
        <div className="fixed top-4 right-4 z-[100] animate-[slideIn_0.3s_ease-out]">
          <div className={`px-6 py-4 rounded-lg shadow-2xl border-2 ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-400 text-green-800' 
              : 'bg-red-50 border-red-400 text-red-800'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{notification.type === 'success' ? '✅' : '❌'}</span>
              <p className="font-semibold">{notification.message}</p>
              <button 
                onClick={() => setNotification(null)}
                className="ml-4 text-xl hover:opacity-70"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setTab('local')}
            className={
              `px-3 py-2 rounded border ` +
              (tab === 'local' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/50 border-white/70 text-purple-700')
            }
          >
            Local Photos (Story)
          </button>
          <button
            type="button"
            onClick={() => setTab('ingested')}
            className={
              `px-3 py-2 rounded border ` +
              (tab === 'ingested' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white/50 border-white/70 text-purple-700')
            }
          >
            Ingested Media
          </button>
        </div>

        {tab === 'local' ? (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-white/50 rounded border border-white/70">
            <div className="text-sm font-semibold text-slate-700">Sort</div>
            <button
              type="button"
              onClick={() => setSortDir('newest')}
              className={`px-3 py-1.5 rounded-full border text-sm transition-all ${sortDir === 'newest'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white/75 text-slate-700 border-white/90 hover:bg-white'}
              }`}
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => setSortDir('oldest')}
              className={`px-3 py-1.5 rounded-full border text-sm transition-all ${sortDir === 'oldest'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white/75 text-slate-700 border-white/90 hover:bg-white'}
              }`}
            >
              Oldest
            </button>

            <div className="w-px h-6 bg-purple-200/70 mx-1" />

            <div className="text-sm font-semibold text-slate-700">Folder</div>
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="px-3 py-1.5 rounded-full border bg-white/75 text-slate-700 border-white/90 hover:bg-white text-sm"
            >
              <option value="all">All Folders</option>
              {folders.map(folder => (
                <option key={folder} value={folder}>{folder}</option>
              ))}
            </select>

            <div className="w-px h-6 bg-purple-200/70 mx-1" />

            <button
              type="button"
              onClick={expandAll}
              className="px-3 py-1.5 rounded-full bg-white/75 border border-white/90 text-slate-700 hover:bg-white text-sm"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-3 py-1.5 rounded-full bg-white/75 border border-white/90 text-slate-700 hover:bg-white text-sm"
            >
              Collapse all
            </button>

            <div className="w-px h-6 bg-purple-200/70 mx-1" />

            <button
              type="button"
              onClick={() => {
                setSelectMode(prev => !prev)
                clearSelection()
              }}
              className={`px-3 py-1.5 rounded-full border text-sm ${selectMode
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white/75 text-slate-700 border-white/90 hover:bg-white'}`}
            >
              {selectMode ? 'Exit Select' : 'Select'}
            </button>

            {selectMode && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedKeys(new Set(localFiltered.map(i => i.key)))}
                  className="px-3 py-1.5 rounded-full bg-white/75 border border-white/90 text-slate-700 hover:bg-white text-sm"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedKeys(new Set(localFiltered.slice(0, 100).map(i => i.key)))}
                  className="px-3 py-1.5 rounded-full bg-white/75 border border-white/90 text-slate-700 hover:bg-white text-sm"
                >
                  Select 100
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKeys(prev => {
                      const next = new Set(prev)
                      localFiltered.slice(0, 100).forEach(i => next.add(i.key))
                      return next
                    })
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/75 border border-white/90 text-slate-700 hover:bg-white text-sm"
                >
                  Add 100
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-3 py-1.5 rounded-full bg-white/75 border border-white/90 text-slate-700 hover:bg-white text-sm"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date()
                    const year = now.getFullYear()
                    const month = String(now.getMonth() + 1).padStart(2, '0')
                    const day = String(now.getDate()).padStart(2, '0')
                    setBulkNewMonth(`${year}-${month}`)
                    setBulkNewDate(`${year}-${month}-${day}`)
                    setBulkUseMonth(true)
                    setBulkMoveOpen(true)
                  }}
                  disabled={!selectedKeys.size}
                  className="px-3 py-1.5 rounded-full bg-indigo-600 text-white text-sm disabled:opacity-50"
                >
                  Move selected
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedKeys.size) return
                    const keys = Array.from(selectedKeys)
                    for (const key of keys) {
                      await fetch('/api/photos/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key })
                      })
                      onLocalDeleted(key)
                    }
                    setNotification({ message: `Deleted ${keys.length} photo(s)`, type: 'success' })
                    setTimeout(() => setNotification(null), 3000)
                    clearSelection()
                  }}
                  disabled={!selectedKeys.size}
                  className="px-3 py-1.5 rounded-full bg-red-600 text-white text-sm disabled:opacity-50"
                >
                  Delete selected
                </button>
              </>
            )}

            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/photos/migrate', { method: 'POST' })
                  const j = await res.json()
                  if (j.ok) {
                    setMigrateState({ status: 'running', total: 0, completed: 0, recent: [] })
                    setNotification({ message: 'Migration started…', type: 'success' })
                    setTimeout(() => setNotification(null), 2000)
                  } else {
                    setNotification({ message: j.error || 'Migration already running', type: 'error' })
                    setTimeout(() => setNotification(null), 3000)
                  }
                } catch (error) {
                  setNotification({ message: 'Failed to start migration', type: 'error' })
                  setTimeout(() => setNotification(null), 3000)
                }
              }}
              className="px-3 py-1.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 text-sm"
            >
              Migrate local to Drive
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/photos/fix-wrong-month', { method: 'POST' })
                  const j = await res.json()
                  if (j.ok) {
                    setFixState({ status: 'running', total: 0, completed: 0, recent: [] })
                    setNotification({ message: 'Auto-fix started…', type: 'success' })
                    setTimeout(() => setNotification(null), 2000)
                  } else {
                    setNotification({ message: j.error || 'Fix already running', type: 'error' })
                    setTimeout(() => setNotification(null), 3000)
                  }
                } catch (error) {
                  setNotification({ message: 'Failed to start auto-fix', type: 'error' })
                  setTimeout(() => setNotification(null), 3000)
                }
              }}
              className="px-3 py-1.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
            >
              Auto-fix wrong month
            </button>

            <div className="text-sm text-slate-600 ml-auto">
              {localFiltered.length} memory(ies)
            </div>
          </div>
        ) : null}

        {migrateState.status === 'running' && (
          <div className="mt-3 p-3 rounded-lg border bg-white/70">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-700 font-semibold">Migrating local photos to Google Drive…</span>
              <span className="text-purple-600 font-bold">
                {migrateState.completed} / {migrateState.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${migrateState.total ? (migrateState.completed / migrateState.total) * 100 : 0}%` }}
              />
            </div>
            {migrateState.recent && migrateState.recent.length > 0 && (
              <div className="mt-3 text-xs text-slate-700">
                <div className="font-semibold mb-1">Recent files</div>
                <ul className="space-y-1 max-h-28 overflow-y-auto">
                  {migrateState.recent.map((r, idx) => (
                    <li key={`${r.name}-${idx}`} className="flex items-center gap-2">
                      <span>
                        {r.status === 'uploaded' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌'}
                      </span>
                      <span className="truncate">{r.name}</span>
                      {r.info ? <span className="text-slate-500 truncate">({r.info})</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {fixState.status === 'running' && (
          <div className="mt-3 p-3 rounded-lg border bg-white/70">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-700 font-semibold">Fixing wrong-month photos…</span>
              <span className="text-indigo-600 font-bold">
                {fixState.completed} / {fixState.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${fixState.total ? (fixState.completed / fixState.total) * 100 : 0}%` }}
              />
            </div>
            {fixState.recent && fixState.recent.length > 0 && (
              <div className="mt-3 text-xs text-slate-700">
                <div className="font-semibold mb-1">Recent fixes</div>
                <ul className="space-y-1 max-h-28 overflow-y-auto">
                  {fixState.recent.map((r, idx) => (
                    <li key={`${r.name}-${idx}`} className="flex items-center gap-2">
                      <span>
                        {r.status === 'moved' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌'}
                      </span>
                      <span className="truncate">{r.name}</span>
                      {r.info ? <span className="text-slate-500 truncate">({r.info})</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <input
            placeholder={tab === 'local' ? 'Search message or folder name' : 'Search path or message'}
            value={query}
            onChange={e=>setQuery(e.target.value)}
            className="p-2 border rounded w-full"
          />
          {tab === 'ingested' ? <UploadForm onUploaded={fetchItems} /> : null}
          {tab === 'local' ? (
            <>
              <LocalPhotoUploadForm onUploaded={fetchLocal} onNotify={(msg, type) => {
                setNotification({ message: msg, type })
                setTimeout(() => setNotification(null), 5000)
              }} />
              <button type="button" onClick={fetchLocal} className="px-3 py-2 border rounded bg-white/50">
                Refresh
              </button>
            </>
          ) : null}
        </div>
      </div>

      {tab === 'local' && monthGroups.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <div className="text-sm font-semibold text-slate-700 w-full mb-2">Months</div>
          {monthGroups.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => scrollToMonth(g.id)}
              className="px-3 py-2 bg-white/75 border border-white/90 rounded-lg text-sm hover:bg-purple-50 transition-colors"
            >
              {g.label}
              <span className="ml-2 text-xs text-slate-500">{g.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'ingested' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filtered.map(i => <AdminItem key={i.id} item={i} onUpdated={onUpdated} />)}
        </div>
      ) : monthGroups.length > 0 ? (
        <div
          className="space-y-6"
          onMouseDown={(e) => {
            if (!selectMode) return
            if (e.button !== 0) return
            if (e.altKey) lassoMode.current = 'remove'
            else if (e.shiftKey) lassoMode.current = 'add'
            else lassoMode.current = 'replace'

            lassoBase.current = lassoMode.current === 'replace' ? new Set() : new Set(selectedKeys)
            const startX = e.clientX + window.scrollX
            const startY = e.clientY + window.scrollY
            setLasso({ active: true, startX, startY, endX: startX, endY: startY, scrollX: window.scrollX, scrollY: window.scrollY })

            const onMove = (ev: MouseEvent) => {
              // auto-scroll when near edges
              const edge = 40
              if (ev.clientY < edge) window.scrollBy({ top: -20, behavior: 'auto' })
              if (ev.clientY > window.innerHeight - edge) window.scrollBy({ top: 20, behavior: 'auto' })
              if (ev.clientX < edge) window.scrollBy({ left: -20, behavior: 'auto' })
              if (ev.clientX > window.innerWidth - edge) window.scrollBy({ left: 20, behavior: 'auto' })

              const next = {
                startX,
                startY,
                endX: ev.clientX + window.scrollX,
                endY: ev.clientY + window.scrollY,
                scrollX: window.scrollX,
                scrollY: window.scrollY
              }
              setLasso(prev => ({ ...prev, ...next, active: true }))
              updateSelectionFromLasso(next)
            }

            const onUp = (ev: MouseEvent) => {
              const next = {
                startX,
                startY,
                endX: ev.clientX + window.scrollX,
                endY: ev.clientY + window.scrollY,
                scrollX: window.scrollX,
                scrollY: window.scrollY
              }
              updateSelectionFromLasso(next)
              setLasso({ active: false, startX: 0, startY: 0, endX: 0, endY: 0, scrollX: 0, scrollY: 0 })
              window.removeEventListener('mousemove', onMove)
              window.removeEventListener('mouseup', onUp)
            }

            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
        >
          {monthGroups.map((group) => (
            <div key={group.id} id={`month-${group.id}`} className="scroll-mt-20">
              <button
                type="button"
                onClick={() => toggleMonth(group.id)}
                className="w-full text-left mb-4 p-4 bg-white/60 border border-white/80 rounded-xl hover:bg-white/80 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📅</span>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{group.label}</h3>
                      <p className="text-sm text-slate-600">{group.count} photo{group.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectMode ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const keys = group.items.map(i => i.key)
                            setSelectedKeys(prev => new Set([...prev, ...keys]))
                          }}
                          className="px-2 py-1 text-xs rounded bg-white/80 border border-white/80 text-slate-700"
                        >
                          Select month
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const keys = new Set(group.items.map(i => i.key))
                            setSelectedKeys(prev => {
                              const next = new Set(prev)
                              for (const k of keys) next.delete(k)
                              return next
                            })
                          }}
                          className="px-2 py-1 text-xs rounded bg-white/80 border border-white/80 text-slate-700"
                        >
                          Unselect month
                        </button>
                      </>
                    ) : null}
                    <svg
                      className={`w-6 h-6 text-slate-600 transition-transform ${openMonths[group.id] ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {openMonths[group.id] && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4">
                  {group.items.map(i => (
                    <LocalPhotoAdminItem 
                      key={i.key} 
                      item={i} 
                      onUpdated={onLocalUpdated} 
                      onDeleted={() => onLocalDeleted(i.key)}
                      onMoved={onLocalMoved}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      isDragging={draggedItem?.key === i.key}
                      selectMode={selectMode}
                      selected={selectedKeys.has(i.key)}
                      onToggleSelect={toggleSelect}
                      registerItemRef={registerItemRef}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          onMouseDown={(e) => {
            if (!selectMode) return
            if (e.button !== 0) return
            if (e.altKey) lassoMode.current = 'remove'
            else if (e.shiftKey) lassoMode.current = 'add'
            else lassoMode.current = 'replace'

            lassoBase.current = lassoMode.current === 'replace' ? new Set() : new Set(selectedKeys)
            const startX = e.clientX + window.scrollX
            const startY = e.clientY + window.scrollY
            setLasso({ active: true, startX, startY, endX: startX, endY: startY, scrollX: window.scrollX, scrollY: window.scrollY })

            const onMove = (ev: MouseEvent) => {
              const edge = 40
              if (ev.clientY < edge) window.scrollBy({ top: -20, behavior: 'auto' })
              if (ev.clientY > window.innerHeight - edge) window.scrollBy({ top: 20, behavior: 'auto' })
              if (ev.clientX < edge) window.scrollBy({ left: -20, behavior: 'auto' })
              if (ev.clientX > window.innerWidth - edge) window.scrollBy({ left: 20, behavior: 'auto' })

              const next = {
                startX,
                startY,
                endX: ev.clientX + window.scrollX,
                endY: ev.clientY + window.scrollY,
                scrollX: window.scrollX,
                scrollY: window.scrollY
              }
              setLasso(prev => ({ ...prev, ...next, active: true }))
              updateSelectionFromLasso(next)
            }

            const onUp = (ev: MouseEvent) => {
              const next = {
                startX,
                startY,
                endX: ev.clientX + window.scrollX,
                endY: ev.clientY + window.scrollY,
                scrollX: window.scrollX,
                scrollY: window.scrollY
              }
              updateSelectionFromLasso(next)
              setLasso({ active: false, startX: 0, startY: 0, endX: 0, endY: 0, scrollX: 0, scrollY: 0 })
              window.removeEventListener('mousemove', onMove)
              window.removeEventListener('mouseup', onUp)
            }

            window.addEventListener('mousemove', onMove)
            window.addEventListener('mouseup', onUp)
          }}
        >
          {localFiltered.map(i => (
            <LocalPhotoAdminItem 
              key={i.key} 
              item={i} 
              onUpdated={onLocalUpdated} 
              onDeleted={() => onLocalDeleted(i.key)}
              onMoved={onLocalMoved}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isDragging={draggedItem?.key === i.key}
              selectMode={selectMode}
              selected={selectedKeys.has(i.key)}
              onToggleSelect={toggleSelect}
              registerItemRef={registerItemRef}
            />
          ))}
        </div>
      )}

      {lasso.active && (
        <div
          className="fixed z-[80] pointer-events-none border-2 border-purple-500/70 bg-purple-400/10"
          style={{
            left: Math.min(lasso.startX, lasso.endX) - window.scrollX,
            top: Math.min(lasso.startY, lasso.endY) - window.scrollY,
            width: Math.abs(lasso.endX - lasso.startX),
            height: Math.abs(lasso.endY - lasso.startY),
          }}
        />
      )}

      {bulkMoveOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setBulkMoveOpen(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 soft-card" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-slate-800">Move Selected Photos</h3>

            <div className="mb-4">
              <p className="text-sm text-slate-600">Selected: <strong>{selectedKeys.size}</strong></p>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="radio"
                  checked={bulkUseMonth}
                  onChange={() => setBulkUseMonth(true)}
                />
                <span className="text-sm font-semibold">Choose Month</span>
              </label>

              {bulkUseMonth && (
                <input
                  type="month"
                  value={bulkNewMonth}
                  onChange={e => setBulkNewMonth(e.target.value)}
                  className="w-full p-2 border rounded bg-white/60"
                  placeholder="YYYY-MM"
                />
              )}
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 mb-3">
                <input
                  type="radio"
                  checked={!bulkUseMonth}
                  onChange={() => setBulkUseMonth(false)}
                />
                <span className="text-sm font-semibold">Choose Specific Date</span>
              </label>

              {!bulkUseMonth && (
                <input
                  type="date"
                  value={bulkNewDate}
                  onChange={e => setBulkNewDate(e.target.value)}
                  className="w-full p-2 border rounded bg-white/60"
                />
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setBulkMoveOpen(false)}
                className="px-4 py-2 border rounded bg-white/50 hover:bg-white/80"
                disabled={bulkMoving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkMove}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
                disabled={bulkMoving || (bulkUseMonth ? !bulkNewMonth : !bulkNewDate)}
              >
                {bulkMoving ? 'Moving…' : 'Move Selected'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-full bg-purple-600 text-white shadow-lg hover:bg-purple-700"
        >
          ↑ Top
        </button>
      )}
    </div>
  )
}

function UploadForm({ onUploaded }: { onUploaded: ()=>void }){
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function submit(e:any){
    e.preventDefault()
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/media/upload', { method: 'POST', body: fd })
    const j = await res.json()
    setUploading(false)
    if (j.ok) onUploaded()
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input type="file" accept="image/*,video/*" onChange={e=>setFile(e.target.files?.[0]||null)} />
      <button className="px-3 py-1 bg-primary text-white rounded" disabled={uploading}>{uploading? 'Uploading...' : 'Upload'}</button>
    </form>
  )
}

function LocalPhotoUploadForm({ onUploaded, onNotify }: { 
  onUploaded: () => void
  onNotify: (message: string, type: 'success' | 'error') => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [monthInput, setMonthInput] = useState('')
  const [useMonth, setUseMonth] = useState(true)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })

  // Set default to current month
  React.useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    setMonthInput(`${year}-${month}`)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles)
      setShowModal(true)
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setUploadProgress({ current: 0, total: files.length })

    try {
      let successCount = 0
      
      // Upload one at a time to avoid overwhelming Google Drive API
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        setUploadProgress({ current: i + 1, total: files.length })
        
        try {
          // Compress image if it's too large (> 1MB)
          let fileToUpload = file
          try {
            if (file.size > 1024 * 1024 && file.type.startsWith('image/')) {
              const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                initialQuality: 0.85,
              }
              const compressed = await imageCompression(file, options)
              // Ensure we keep the original filename + extension.
              // Some compressors return a Blob/File with name "blob" which breaks server-side ext checks.
              fileToUpload = compressed instanceof File
                ? new File([compressed], file.name, { type: compressed.type || file.type })
                : new File([compressed as Blob], file.name, { type: (compressed as Blob).type || file.type })
              console.log(`Compressed ${file.name} from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`)
            }
          } catch (compressionError) {
            console.warn('Compression failed, uploading original:', compressionError)
            fileToUpload = file
          }

          const fd = new FormData()
          // Always pass the filename explicitly so server receives correct extension.
          fd.append('file', fileToUpload, file.name)
          
          if (useMonth && monthInput) {
            fd.append('month', monthInput)
          } else if (!useMonth && dateInput) {
            fd.append('date', dateInput)
          }

          const res = await fetch('/api/photos/upload', { method: 'POST', body: fd })
          const j = await res.json()
          
          if (j.ok) {
            successCount++
          } else {
            console.error(`Failed to upload ${file.name}:`, j.error)
          }
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error)
        }
      }

      if (successCount > 0) {
        onUploaded()
        onNotify(`Successfully uploaded ${successCount} of ${files.length} photos to Google Drive! ☁️`, 'success')
      } else {
        onNotify('Failed to upload photos. Please check the console for errors.', 'error')
      }
      
      setShowModal(false)
      setFiles([])
      setDateInput('')
      setUploadProgress({ current: 0, total: 0 })
    } catch (error) {
      onNotify('Error uploading photos', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setShowModal(false)
    setFiles([])
    setDateInput('')
    setUploadProgress({ current: 0, total: 0 })
  }

  return (
    <>
      <label className="px-3 py-2 border rounded bg-purple-600 text-white cursor-pointer hover:bg-purple-700 transition-colors">
        <span>📸 Add Photo</span>
        <input 
          type="file" 
          accept="image/*" 
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </label>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCancel}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 soft-card" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-slate-800">Upload Photo</h3>
            
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">
                Selected file{files.length > 1 ? 's' : ''}: <strong>{files.length} photo{files.length > 1 ? 's' : ''}</strong>
              </p>
              {files.length <= 5 && (
                <div className="text-xs text-slate-500 max-h-20 overflow-y-auto">
                  {files.map((f, i) => <div key={i}>{f.name}</div>)}
                </div>
              )}
            </div>

            {uploading && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-700 font-semibold">Uploading to Google Drive...</span>
                  <span className="text-purple-600 font-bold">{uploadProgress.current} / {uploadProgress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 h-full rounded-full transition-all duration-300 ease-out animate-pulse"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Please wait... {Math.round((uploadProgress.current / uploadProgress.total) * 100)}% complete
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="flex items-center gap-2 mb-3">
                <input 
                  type="radio" 
                  checked={useMonth} 
                  onChange={() => setUseMonth(true)}
                  disabled={uploading}
                />
                <span className="text-sm font-semibold">Choose Month</span>
              </label>
              
              {useMonth && (
                <input
                  type="month"
                  value={monthInput}
                  onChange={e => setMonthInput(e.target.value)}
                  className="w-full p-2 border rounded bg-white/60"
                  placeholder="YYYY-MM"
                  disabled={uploading}
                />
              )}
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 mb-3">
                <input 
                  type="radio" 
                  checked={!useMonth} 
                  onChange={() => setUseMonth(false)}
                  disabled={uploading}
                />
                <span className="text-sm font-semibold">Choose Specific Date</span>
              </label>
              
              {!useMonth && (
                <input
                  type="date"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  className="w-full p-2 border rounded bg-white/60"
                  disabled={uploading}
                />
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border rounded bg-white/50 hover:bg-white/80"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
                disabled={uploading || (useMonth ? !monthInput : !dateInput)}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

