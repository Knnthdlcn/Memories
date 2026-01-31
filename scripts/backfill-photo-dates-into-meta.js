const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const exif = require('exif-parser')

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime())
}

function isReasonablePhotoDate(d) {
  const year = d.getFullYear()
  if (year < 1990) return false
  const maxFutureMs = 1000 * 60 * 60 * 24 * 365
  if (d.getTime() > Date.now() + maxFutureMs) return false
  return true
}

function parseExifDate(raw) {
  if (raw == null) return undefined
  let d
  if (raw instanceof Date) {
    d = raw
  } else if (typeof raw === 'number') {
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

async function readExifDate(filePath) {
  try {
    const handle = await fsp.open(filePath, 'r')
    try {
      const stat = await handle.stat()
      const readLen = Math.min(Number(stat.size || 0), 256 * 1024)
      if (!readLen) return undefined

      const buffer = Buffer.alloc(readLen)
      await handle.read(buffer, 0, readLen, 0)
      const parsed = exif.create(buffer).parse()

      const raw =
        (parsed.tags && parsed.tags.DateTimeOriginal) ||
        (parsed.tags && parsed.tags.CreateDate) ||
        (parsed.tags && parsed.tags.ModifyDate)

      return parseExifDate(raw)
    } finally {
      await handle.close()
    }
  } catch {
    return undefined
  }
}

function localFileFromKey(rootPhotos, key) {
  // key looks like /api/photos/raw/<encoded segments>
  const prefix = '/api/photos/raw/'
  if (!key.startsWith(prefix)) return null
  const rel = key.slice(prefix.length)
  const parts = rel.split('/').map(s => decodeURIComponent(s))
  return path.join(rootPhotos, ...parts)
}

async function main() {
  const repoRoot = process.cwd()
  const metaPath = path.join(repoRoot, 'photos-meta.json')
  const photosRoot = path.join(repoRoot, 'photos')

  if (!fs.existsSync(metaPath)) {
    console.error('photos-meta.json not found:', metaPath)
    process.exit(1)
  }

  const raw = await fsp.readFile(metaPath, 'utf8')
  const meta = JSON.parse(raw)

  let touched = 0
  let skipped = 0
  let missing = 0

  const keys = Object.keys(meta)
  for (const key of keys) {
    if (!key.startsWith('/api/photos/raw/')) continue

    const entry = meta[key] || {}
    const hasOverride = typeof entry.dateOverride === 'string' && entry.dateOverride.trim() !== ''
    if (hasOverride) {
      skipped++
      continue
    }

    const localPath = localFileFromKey(photosRoot, key)
    if (!localPath || !fs.existsSync(localPath)) {
      missing++
      continue
    }

    // Prefer EXIF. Fall back to filesystem timestamps.
    let date = await readExifDate(localPath)
    if (!date) {
      const st = await fsp.stat(localPath)
      const candidates = [st.mtime, st.birthtime, st.ctime]
        .filter(isValidDate)
        .filter(isReasonablePhotoDate)
        .sort((a, b) => a.getTime() - b.getTime())
      date = candidates[0] || (isValidDate(st.mtime) ? st.mtime : undefined)
    }

    if (date && isReasonablePhotoDate(date)) {
      entry.dateOverride = date.toISOString()
      meta[key] = entry
      touched++
    }
  }

  await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8')

  console.log(`Backfill complete. Updated: ${touched}, skipped(existing override): ${skipped}, missing local files: ${missing}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
