import { NextResponse } from 'next/server'
import { fetchDriveMediaResponse, fetchDriveThumbnailResponse, getDriveFileMeta } from '@/src/lib/googleDrive'

function toU8(buf: Buffer) {
  // @types/node models Buffer.buffer as ArrayBufferLike (which can include SharedArrayBuffer).
  // In practice here it's an ArrayBuffer; cast to satisfy BlobPart typing.
  return new Uint8Array(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength)
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

  if (!id || typeof id !== 'string') {
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
      const meta = await getDriveFileMeta(id)
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
    }

    // Fallback: stream original bytes from Drive.
    const driveRes = await fetchDriveMediaResponse(id)
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
    })
    const msg = e?.message || 'Failed to fetch from Drive'
    return new NextResponse(`Error: ${msg}`, { status: 500 })
  }
}
