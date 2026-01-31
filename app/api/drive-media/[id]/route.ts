import { NextResponse } from 'next/server'
import { downloadFromGoogleDrive } from '@/src/lib/googleDrive'

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

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    console.log(`[drive-media] Fetching file ${id}${w ? ` with width=${w}` : ''}`)
    const buf = await downloadFromGoogleDrive(id)
    console.log(`[drive-media] Downloaded ${buf.length} bytes`)

    // If width requested, return a resized WebP (much faster on mobile).
    if (w) {
      try {
        const sharp = (await import('sharp')).default
        const out = await sharp(buf)
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: 72 })
          .toBuffer()
        
        console.log(`[drive-media] Resized to ${out.length} bytes`)

        return new NextResponse(new Blob([toU8(out)]), {
          status: 200,
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=86400'
          }
        })
      } catch (sharpErr: any) {
        console.error('[drive-media] Sharp failed, returning original:', sharpErr.message)
        // Fall through to return original
      }
    }

    // Default: try[drive-media] ERROR:', {
      message: e?.message,
      name: e?.name,
      stack: e?.stack?.split('\n').slice(0, 3)
    })
    const msg = e?.message || 'Failed to fetch from Drive'
    return new NextResponse(`Error: ${msg}`, { status: 500
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400'
      }
    })
  } catch (e: any) {
    console.error('Drive media fetch error:', e)
    const msg = e?.message || 'Failed to fetch from Drive'
    return new NextResponse(`Error: ${msg}`, { status: 502 })
  }
}
