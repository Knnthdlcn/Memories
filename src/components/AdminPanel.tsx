"use client"
import React, { useEffect, useState, useMemo } from 'react'
import AdminItem from './AdminItem'
import LocalPhotoAdminItem, { LocalAdminItem } from './LocalPhotoAdminItem'

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

  useEffect(()=>{ fetchItems(); fetchLocal() }, [])

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
      alert('Can only reorder photos within the same month')
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

  return (
    <div>
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

            <div className="text-sm text-slate-600 ml-auto">
              {localFiltered.length} memory(ies)
            </div>
          </div>
        ) : null}

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
              <LocalPhotoUploadForm onUploaded={fetchLocal} />
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
        <div className="space-y-6">
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
                  <svg
                    className={`w-6 h-6 text-slate-600 transition-transform ${openMonths[group.id] ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
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
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            />
          ))}
        </div>
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

function LocalPhotoUploadForm({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [monthInput, setMonthInput] = useState('')
  const [useMonth, setUseMonth] = useState(true)

  // Set default to current month
  React.useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    setMonthInput(`${year}-${month}`)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setShowModal(true)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      
      if (useMonth && monthInput) {
        fd.append('month', monthInput)
      } else if (!useMonth && dateInput) {
        fd.append('date', dateInput)
      }

      const res = await fetch('/api/photos/upload', { method: 'POST', body: fd })
      const j = await res.json()
      
      if (j.ok) {
        onUploaded()
        setShowModal(false)
        setFile(null)
        setDateInput('')
      } else {
        alert(j.error || 'Upload failed')
      }
    } catch (error) {
      alert('Error uploading photo')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setShowModal(false)
    setFile(null)
    setDateInput('')
  }

  return (
    <>
      <label className="px-3 py-2 border rounded bg-purple-600 text-white cursor-pointer hover:bg-purple-700 transition-colors">
        <span>📸 Add Photo</span>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileSelect}
          className="hidden"
        />
      </label>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCancel}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 soft-card" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 text-slate-800">Upload Photo</h3>
            
            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-2">Selected file: <strong>{file?.name}</strong></p>
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
                <input
                  type="month"
                  value={monthInput}
                  onChange={e => setMonthInput(e.target.value)}
                  className="w-full p-2 border rounded bg-white/60"
                  placeholder="YYYY-MM"
                />
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
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  className="w-full p-2 border rounded bg-white/60"
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

