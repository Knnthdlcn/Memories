"use client"

import React, { useEffect, useMemo, useState } from 'react'
import CuteSticker, { CuteStickerVariant } from '@/src/components/CuteSticker'
import StoryModal, { StoryModalItem } from '@/src/components/StoryModal'

export type StoryTimelineItem = {
  key: string
  date: string
  srcThumb: string
  srcFull: string
  message?: string
  featured?: boolean
}

type MonthGroup = {
  id: string
  label: string
  days: DayGroup[]
}

type DayGroup = {
  id: string
  label: string
  items: StoryTimelineItem[]
}

function monthId(d: Date){
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function monthLabel(d: Date){
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
}

function dayId(d: Date){
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayLabel(d: Date){
  return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

function cardSticker(i: number): CuteStickerVariant {
  const variants: CuteStickerVariant[] = ['egg', 'icecream', 'sparkle', 'heart']
  return variants[i % variants.length]
}

export default function StoryTimelineClient({ items }: { items: StoryTimelineItem[] }){
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<StoryModalItem | null>(null)
  const [sortDir, setSortDir] = useState<'newest' | 'oldest'>('newest')
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({})

  const groups: MonthGroup[] = useMemo(() => {
    const byMonth = new Map<string, MonthGroup>()

    const sorted = [...items].sort((a, b) => {
      const da = new Date(a.date).getTime()
      const db = new Date(b.date).getTime()
      return sortDir === 'newest' ? db - da : da - db
    })

    for (const it of sorted) {
      const d = new Date(it.date)
      const mId = monthId(d)
      if (!byMonth.has(mId)) {
        byMonth.set(mId, { id: mId, label: monthLabel(d), days: [] })
      }

      const month = byMonth.get(mId)!
      const dId = dayId(d)
      let day = month.days.find(x => x.id === dId)
      if (!day) {
        day = { id: dId, label: dayLabel(d), items: [] }
        month.days.push(day)
      }
      day.items.push(it)
    }

    return Array.from(byMonth.values())
  }, [items, sortDir])

  useEffect(() => {
    // Default: open the first month (based on sort), keep the rest collapsed.
    if (!groups.length) return
    setOpenMonths(prev => {
      if (Object.keys(prev).length) return prev
      return { [groups[0]!.id]: true }
    })
  }, [groups])

  const openModal = (it: StoryTimelineItem) => {
    setSelected({
      key: it.key,
      srcFull: it.srcFull,
      date: it.date,
      message: it.message,
      featured: it.featured
    })
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setSelected(null)
  }

  const toggleMonth = (id: string) => {
    setOpenMonths(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleDay = (id: string) => {
    setOpenDays(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const expandAll = () => {
    const nextMonths: Record<string, boolean> = {}
    const nextDays: Record<string, boolean> = {}
    for (const g of groups) {
      nextMonths[g.id] = true
      for (const d of g.days) nextDays[d.id] = true
    }
    setOpenMonths(nextMonths)
    setOpenDays(nextDays)
  }

  const collapseAll = () => {
    const nextMonths: Record<string, boolean> = {}
    const nextDays: Record<string, boolean> = {}
    for (const g of groups) {
      nextMonths[g.id] = false
      for (const d of g.days) nextDays[d.id] = false
    }
    setOpenMonths(nextMonths)
    setOpenDays(nextDays)
  }

  const scrollToMonth = (id: string) => {
    const el = document.getElementById(`month-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setOpenMonths(prev => ({ ...prev, [id]: true }))
  }

  if (!items.length) {
    return (
      <div className="soft-card p-8 text-center">
        <h3 className="text-xl font-semibold mb-2">No photos found in the photos folder</h3>
        <p className="text-gray-600">Add images to <code>photos/</code> in the project root and refresh.</p>
      </div>
    )
  }

  return (
    <>
      <div className="sticky top-2 sm:top-4 z-20 mb-5 sm:mb-8">
        <div className="crystal-card p-3 sm:p-4 border border-white/85 shadow-[0_22px_80px_rgba(15,23,42,0.20)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm font-semibold text-slate-800 tracking-wide">Sort</div>
              <button
                type="button"
                onClick={() => setSortDir('newest')}
                className={`px-3 py-2 rounded-full border shadow-sm transition-all duration-150 ${sortDir === 'newest'
                  ? 'bg-gradient-to-r from-slate-950 to-purple-700 text-white border-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.35)] scale-[1.02]'
                  : 'bg-white/75 text-slate-800 border-white/90 hover:bg-white'}
                }`}
              >
                Newest
              </button>
              <button
                type="button"
                onClick={() => setSortDir('oldest')}
                className={`px-3 py-2 rounded-full border shadow-sm transition-all duration-150 ${sortDir === 'oldest'
                  ? 'bg-gradient-to-r from-slate-950 to-purple-700 text-white border-slate-950 shadow-[0_18px_50px_rgba(15,23,42,0.35)] scale-[1.02]'
                  : 'bg-white/75 text-slate-800 border-white/90 hover:bg-white'}
                }`}
              >
                Oldest
              </button>

              <div className="w-px h-7 bg-purple-200/70 mx-1 hidden sm:block" />

              <button
                type="button"
                onClick={expandAll}
                className="px-3 py-2 rounded-full bg-white/75 border border-white/90 text-slate-800 hover:bg-white shadow-sm"
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-3 py-2 rounded-full bg-white/75 border border-white/90 text-slate-800 hover:bg-white shadow-sm"
              >
                Collapse all
              </button>
            </div>

            <div className="text-sm text-slate-800/80 px-3 py-2 rounded-full bg-white/70 border border-white/85">
              {items.length} memory(ies)
            </div>
          </div>

          <div className="mt-3">
            <div className="text-xs font-semibold text-slate-700 mb-2">Months</div>
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
              {groups.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => scrollToMonth(g.id)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/90 border border-white/95 text-slate-900 hover:bg-white shadow-sm hover:shadow-md transition-shadow"
                  title={g.label}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 md:gap-8">
        {groups.map((g, gi) => (
          <section
            key={g.id}
            id={`month-${g.id}`}
            className={`relative scroll-mt-28 ${openMonths[g.id] ? 'col-span-2' : ''}`}
          >
            <button
              type="button"
              onClick={() => toggleMonth(g.id)}
              className="w-full crystal-card p-3 sm:p-4 md:p-5 mb-3 sm:mb-4 flex items-center justify-between gap-2 sm:gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_34px_140px_rgba(15,23,42,0.30)]"
            >
              <div className="flex items-center gap-3">
                <CuteSticker variant={cardSticker(gi)} className="floaty" />
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-slate-900">{g.label}</h3>
                <span className="text-[11px] text-slate-600 hidden sm:inline">(click to {openMonths[g.id] ? 'hide' : 'show'})</span>
              </div>
              <div className="text-sm text-slate-800/80 px-3 py-1 rounded-full bg-white/70 border border-white/85">
                {g.days.reduce((n, d) => n + d.items.length, 0)} photo(s)
              </div>
            </button>

            {openMonths[g.id] ? (
              <div className="space-y-6">
                {g.days.map((day, di) => (
                  <div key={day.id} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-2xl bg-white/70 border border-white/80 hover:bg-white shadow-sm hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <CuteSticker variant={cardSticker(di + gi)} className="wiggle" />
                        <span>{day.label}</span>
                        <span className="text-xs text-slate-600">(click)</span>
                      </div>
                      <div className="text-xs text-slate-800/80 px-2.5 py-1 rounded-full bg-white/70 border border-white/85">
                        {day.items.length}
                      </div>
                    </button>

                    {openDays[day.id] ? (
                      <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-6">
                        {day.items.map((it, i) => (
                          <article
                            key={it.key}
                            className="relative crystal-card p-3 sm:p-4 md:p-5 transition-all duration-200 hover:-translate-y-2 hover:shadow-[0_36px_140px_rgba(15,23,42,0.30)]"
                          >
                            <div className="absolute right-3 top-3 opacity-90">
                              <CuteSticker variant={cardSticker(i + gi + di)} className="wiggle" />
                            </div>

                            <div className="text-sm text-slate-700 font-medium mb-2 flex items-center gap-2">
                              {it.featured ? <span className="px-2 py-1 text-xs rounded-full bg-purple-600 text-white">featured</span> : null}
                            </div>

                            <button
                              type="button"
                              onClick={() => openModal(it)}
                              className="block w-full text-left rounded-2xl overflow-hidden crystal-edge outline-none focus:ring-2 focus:ring-purple-300 transition-all"
                              title="Open"
                            >
                              <img
                                src={it.srcThumb}
                                alt=""
                                className="w-full h-[200px] sm:h-[240px] md:h-[280px] object-cover transition-transform duration-300 hover:scale-[1.08]"
                                loading="lazy"
                              />
                            </button>

                            <div className="mt-3 flex items-center justify-between gap-3">
                              <div className="text-sm text-slate-800 line-clamp-2 whitespace-pre-wrap">
                                {(it.message || '').trim() ? (it.message || '').trim() : '✿ No message yet — add one in Admin'}
                              </div>
                              <button
                                type="button"
                                onClick={() => openModal(it)}
                                className="flex-shrink-0 px-3 py-2 rounded-lg bg-white/85 border border-white/95 text-slate-800 hover:bg-white shadow-sm hover:shadow-md transition-all"
                              >
                                Open
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <StoryModal open={open} item={selected} onClose={closeModal} />
    </>
  )
}
