import { NextResponse } from 'next/server'
import { getPhotoMetaStore } from '@/src/lib/photosMeta'

function extractDriveFileId(url: string): string | undefined {
  try {
    const u = new URL(url)
    const id = u.searchParams.get('id')
    return id || undefined
  } catch {
    return undefined
  }
}

function ensureWidthParam(urlPath: string, width: number) {
  if (!urlPath.includes('?')) return `${urlPath}?w=${width}`
  if (urlPath.includes('w=')) return urlPath
  return `${urlPath}&w=${width}`
}

function toThumbUrl(key: string, meta: any): string | undefined {
  const migratedUrl = typeof meta?.migratedToDriveUrl === 'string' ? meta.migratedToDriveUrl : undefined
  const driveUrl = migratedUrl || (typeof key === 'string' && key.startsWith('https://drive.google.com') ? key : undefined)
  const fileId = driveUrl ? extractDriveFileId(driveUrl) : undefined
  if (fileId) return `/api/drive-media/${encodeURIComponent(fileId)}?w=420`

  if (typeof key === 'string' && key.startsWith('/api/photos/raw/')) {
    return ensureWidthParam(key, 420)
  }

  return undefined
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '80'), 1), 200)

  // Reservoir sample to avoid loading everything into memory.
  // IMPORTANT: Use photos-meta.json so this works on Vercel (no local photos folder).
  const reservoir: string[] = []
  let seen = 0

  try {
    const meta = await getPhotoMetaStore()
    for (const [key, m] of Object.entries(meta)) {
      const thumb = toThumbUrl(key, m)
      if (!thumb) continue

      seen += 1
      if (reservoir.length < limit) {
        reservoir.push(thumb)
      } else {
        const j = Math.floor(Math.random() * seen)
        if (j < limit) reservoir[j] = thumb
      }
    }
  } catch (e) {
    // best-effort; fall through
  }

  return NextResponse.json({ ok: true, count: reservoir.length, items: reservoir })
}
