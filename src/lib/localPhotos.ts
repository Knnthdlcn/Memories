import fs from 'fs/promises'
import path from 'path'
import exif from 'exif-parser'
import { getPhotoMetaStore } from '@/src/lib/photosMeta'

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.dng'])

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime())
}

function isReasonablePhotoDate(d: Date){
  const year = d.getFullYear()
  // Treat very old years (like 1904 placeholder) as invalid.
  if (year < 1990) return false
  // Allow a bit of future skew for timezone/device clock issues.
  const maxFutureMs = 1000 * 60 * 60 * 24 * 365
  if (d.getTime() > Date.now() + maxFutureMs) return false
  return true
}

function parseExifDate(raw: unknown): Date | undefined {
  if (raw == null) return undefined

  let d: Date | undefined
  if (raw instanceof Date) {
    d = raw
  } else if (typeof raw === 'number') {
    // exif-parser returns seconds since epoch interpreted as UTC; treat it as *local wall clock*
    // to avoid timezone shifts when EXIF has no timezone.
    const ms = raw > 10_000_000_000 ? raw : raw * 1000
    const utc = new Date(ms)
    d = new Date(
      utc.getUTCFullYear(),
      utc.getUTCMonth(),
      utc.getUTCDate(),
      utc.getUTCHours(),
      utc.getUTCMinutes(),
      utc.getUTCSeconds()
    )
  } else if (typeof raw === 'string') {
    // Common EXIF format: "YYYY:MM:DD HH:MM:SS"
    const m = raw.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/)
    if (m) {
      const year = Number(m[1])
      const month = Number(m[2])
      const day = Number(m[3])
      const hh = Number(m[4] || '0')
      const mm = Number(m[5] || '0')
      const ss = Number(m[6] || '0')
      d = new Date(year, month - 1, day, hh, mm, ss)
    } else {
      const t = Date.parse(raw)
      if (!Number.isNaN(t)) d = new Date(t)
    }
  }

  if (!d || !isValidDate(d)) return undefined
  if (!isReasonablePhotoDate(d)) return undefined
  return d
}

export type LocalPhoto = {
  key: string
  filename: string
  date: Date
  srcThumb: string
  srcFull: string
  // optional extra info (best-effort)
  camera?: string
  message?: string
  featured?: boolean
  order?: number
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else {
      yield full
    }
  }
}

function safeApiPath(root: string, filePath: string) {
  const rel = path.relative(root, filePath).split(path.sep)
  const encoded = rel.map(s => encodeURIComponent(s)).join('/')
  return {
    thumb: `/api/photos/raw/${encoded}?w=600`,
    full: `/api/photos/raw/${encoded}`
  }
}

async function readExifDateAndCamera(filePath: string): Promise<{ date?: Date; camera?: string }> {
  // Read only the first chunk; EXIF is stored near the beginning for JPEGs.
  // This is best-effort and will safely fall back to filesystem timestamps.
  try {
    const handle = await fs.open(filePath, 'r')
    try {
      const stat = await handle.stat()
      const readLen = Math.min(Number(stat.size || 0), 256 * 1024)
      if (!readLen) return {}

      const buffer = Buffer.alloc(readLen)
      await handle.read(buffer, 0, readLen, 0)
      const parsed = exif.create(buffer).parse()

      const raw =
        (parsed.tags?.DateTimeOriginal as unknown) ??
        (parsed.tags?.CreateDate as unknown) ??
        (parsed.tags?.ModifyDate as unknown)

      const date = parseExifDate(raw)

      const make = parsed.tags?.Make ? String(parsed.tags.Make) : ''
      const model = parsed.tags?.Model ? String(parsed.tags.Model) : ''
      const camera = (make || model) ? `${make} ${model}`.trim() : undefined

      return { date, camera }
    } finally {
      await handle.close()
    }
  } catch {
    return {}
  }
}

// Disable in-memory cache to ensure realtime updates

export async function getLocalPhotos(): Promise<LocalPhoto[]> {
  const root = path.join(process.cwd(), 'photos')
  const meta = await getPhotoMetaStore()

  const filePaths: string[] = []
  for await (const p of walk(root)) {
    const ext = path.extname(p).toLowerCase()
    if (!ALLOWED_EXT.has(ext)) continue
    filePaths.push(p)
  }

  // No cache signature needed; always recompute for realtime updates.

  const items: LocalPhoto[] = []
  for (const p of filePaths) {
    const st = await fs.stat(p)

    const fsCandidates = [st.mtime, st.birthtime, st.ctime]
      .filter(isValidDate)
      .filter(isReasonablePhotoDate)
      .sort((a, b) => a.getTime() - b.getTime())

    // If the filesystem metadata is weird, fall back to mtime even if it's imperfect.
    const fallbackDate = fsCandidates[0] || (isValidDate(st.mtime) ? st.mtime : new Date())

    let date = fallbackDate
    let camera: string | undefined

    const { thumb, full } = safeApiPath(root, p)
    const m = meta[full] || {}
    if (typeof m.dateOverride === 'string') {
      const overrideTs = Date.parse(m.dateOverride)
      if (!Number.isNaN(overrideTs)) {
        const overrideDate = new Date(overrideTs)
        if (isReasonablePhotoDate(overrideDate)) date = overrideDate
      }
    }

    const ext = path.extname(p).toLowerCase()
    if (!m.dateOverride && (ext === '.jpg' || ext === '.jpeg' || ext === '.dng')) {
      const ex = await readExifDateAndCamera(p)
      if (ex.date && isReasonablePhotoDate(ex.date)) date = ex.date
      camera = ex.camera
    }
    items.push({
      key: full,
      filename: path.basename(p),
      date,
      srcThumb: thumb,
      srcFull: full,
      camera,
      message: typeof m.message === 'string' ? m.message : undefined,
      featured: !!m.featured,
      order: typeof m.order === 'number' ? m.order : undefined
    })
  }

  items.sort((a, b) => a.date.getTime() - b.date.getTime())

  return items
}
