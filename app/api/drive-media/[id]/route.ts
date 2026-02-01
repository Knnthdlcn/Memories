import { NextResponse } from 'next/server'
import { fetchDriveMediaResponse, fetchDriveThumbnailResponse, getDriveFileMeta } from '@/src/lib/googleDrive'

function normalizeDriveFileId(raw: string): { id: string; changed: boolean } {
  let s = (raw || '').trim()

  // Sometimes callers may pass an encoded value.
  try {
    s = decodeURIComponent(s)
  } catch {
    // ignore
  }

  // Sometimes callers accidentally pass a full Drive URL.
  try {
    const u = new URL(s)
    const q = u.searchParams.get('id')
    if (q) s = q
  } catch {
    // ignore
  }

  // Strip accidental punctuation/quotes around the ID.
  const trimmed = s
    .replace(/^[^A-Za-z0-9_-]+/, '')
    .replace(/[^A-Za-z0-9_-]+$/, '')

  // If there's still extra junk, pick the first plausible token.
  const m = trimmed.match(/[A-Za-z0-9_-]{10,}/)
  const id = m ? m[0] : trimmed
  return { id, changed: id !== raw }
}

function extractWidth(reqUrl: string) {
  const url = new URL(reqUrl)
  const wParam = url.searchParams.get('w')
  if (!wParam) return null
  const w = Number(wParam)
  if (!Number.isFinite(w)) return null
  return Math.min(Math.max(Math.floor(w), 32), 1600)
}

function sizeDriveThumb(url: string, w: number) {
  // Drive thumbnailLink often ends with "=s220" (or similar). Replace/append size.
  if (/=s\d+/.test(url)) return url.replace(/=s\d+/, `=s${w}`)
  return `${url}=s${w}`
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const w = extractWidth(req.url)

  const normalized = typeof id === 'string' ? normalizeDriveFileId(id) : { id: '', changed: false }
  const fileId = normalized.id

  if (!fileId || typeof fileId !== 'string') {
    return new NextResponse('Missing id', { status: 400 })
  }

  // Check env vars early and return helpful error
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.error('Missing Google OAuth env vars')
    return new NextResponse('Server configuration error: Missing Google credentials', { status: 500 })
  }

  try {
    // If a width is requested, prefer Drive's thumbnail endpoint (smaller/faster).
    if (w) {
      try {
        const meta = await getDriveFileMeta(fileId)
        if (meta.thumbnailLink) {
          const thumbUrl = sizeDriveThumb(meta.thumbnailLink, w)
          const thumbRes = await fetchDriveThumbnailResponse(thumbUrl)
          const contentType = thumbRes.headers.get('content-type') || 'image/jpeg'
          const cache = 'public, max-age=2592000, stale-while-revalidate=86400'

          return new NextResponse(thumbRes.body, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': cache,
            },
          })
        }
      } catch (thumbErr: any) {
        console.error('[drive-media] Thumbnail fetch failed; falling back to original:', {
          message: thumbErr?.message,
          name: thumbErr?.name,
        })
        // fall through to original
      }
    }

    // Fallback: stream original bytes from Drive.
    const driveRes = await fetchDriveMediaResponse(fileId)
    const contentType = driveRes.headers.get('content-type') || 'application/octet-stream'
    const cache = 'public, max-age=604800, stale-while-revalidate=86400'

    return new NextResponse(driveRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cache,
      },
    })
  } catch (e: any) {
    console.error('[drive-media] ERROR:', {
      message: e?.message,
      name: e?.name,
      rawId: id,
      normalizedId: fileId,
      normalizedChanged: normalized.changed,
    })
    const msg = e?.message || 'Failed to fetch from Drive'

    // If Drive says 404, bubble that as 404 so the browser doesn't treat it as a server crash.
    if (typeof msg === 'string') {
      if (msg.includes('Drive media error (404)') || msg.includes('"code": 404') || msg.includes('"message": "File not found')) {
        return new NextResponse(`Error: ${msg}`, { status: 404 })
      }
      if (msg.includes('Drive media error (403)') || msg.includes('"code": 403')) {
        return new NextResponse(`Error: ${msg}`, { status: 403 })
      }
    }

    return new NextResponse(`Error: ${msg}`, { status: 500 })
  }
}
