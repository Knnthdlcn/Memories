import { NextResponse } from 'next/server'
import sharp from 'sharp'
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

  try {
    const buf = await downloadFromGoogleDrive(id)

    // If width requested, return a resized WebP (much faster on mobile).
    if (w) {
      const out = await sharp(buf)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 72 })
        .toBuffer()

      return new NextResponse(new Blob([toU8(out)]), {
        status: 200,
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=86400'
        }
      })
    }

    // Default: try to return original bytes. Most uploads are JPEG/PNG; browsers can often sniff.
    // (If needed later, we can add a Drive metadata call to set exact mimeType.)
    return new NextResponse(new Blob([toU8(buf)]), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400'
      }
    })
  } catch (e: any) {
    const msg = e?.message || 'Failed to fetch from Drive'
    return new NextResponse(msg, { status: 502 })
  }
}
