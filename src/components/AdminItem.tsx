"use client"
import React, { useState } from 'react'

export default function AdminItem({ item, onUpdated }: { item: any, onUpdated: (m:any)=>void }){
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState(item.message||'')
  const [featured, setFeatured] = useState(!!item.featured)

  const save = async () => {
    const res = await fetch('/api/media/update', { method: 'POST', body: JSON.stringify({ id: item.id, message, featured }), headers: { 'Content-Type': 'application/json' } })
    const j = await res.json()
    if (j.ok) onUpdated(j.media)
    setEditing(false)
  }

  return (
    <div className="soft-card p-3">
      <div className="w-full h-40 bg-gray-100 rounded overflow-hidden mb-2">
        {item.type==='photo' ? <img src={`/${item.relativePath}`} className="w-full h-full object-cover"/> : <video src={`/${item.relativePath}`} className="w-full h-full object-cover" />}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea value={message} onChange={e=>setMessage(e.target.value)} className="w-full p-2 border rounded" rows={3}></textarea>
          <label className="flex items-center gap-2"><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)} /> Featured</label>
          <div className="flex gap-2">
            <button onClick={save} className="px-3 py-1 bg-primary text-white rounded">Save</button>
            <button onClick={()=>setEditing(false)} className="px-3 py-1 border rounded">Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="text-sm mb-2 whitespace-pre-wrap">{item.message || '—'}</div>
          <div className="flex gap-2">
            <button onClick={()=>setEditing(true)} className="px-3 py-1 border rounded">Edit</button>
          </div>
        </div>
      )}
    </div>
  )
}
