import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.dng'])

function toU8(buf: Buffer) {
  // @types/node models Buffer.buffer as ArrayBufferLike (which can include SharedArrayBuffer).
  // In practice here it's an ArrayBuffer; cast to satisfy BlobPart typing.
  return new Uint8Array(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength)
}

function contentTypeForExt(ext: string) {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.avif':
      return 'image/avif'
    case '.dng':
      return 'image/x-adobe-dng'
    default:
      return 'application/octet-stream'
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await ctx.params
  const url = new URL(req.url)
  const wParam = url.searchParams.get('w')
  const w = wParam ? Math.min(Math.max(Number(wParam), 32), 1200) : null

  const root = path.resolve(process.cwd(), 'photos')
  const target = path.resolve(root, ...parts)

  if (!target.startsWith(root + path.sep) && target !== root) {
    return new NextResponse('Not found', { status: 404 })
  }

  const ext = path.extname(target).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    return new NextResponse('Unsupported file type', { status: 415 })
  }

  try {
    const st = await fs.stat(target)
    const variant = w ? `w=${w};fmt=webp;q=72` : `orig;fmt=${ext}`
    const etag = `"${st.size}-${Math.floor(st.mtimeMs)}-${variant}"`

    const ifNoneMatch = req.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': w
            ? 'public, max-age=2592000, stale-while-revalidate=86400'
            : 'public, max-age=604800, stale-while-revalidate=86400'
        }
      })
    }

    const buf = await fs.readFile(target)

    if (w) {
      // For decorative usage, return a smaller webp to keep page fast.
      const out = await sharp(buf).resize({ width: w, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer()
      return new NextResponse(new Blob([toU8(out)]), {
        status: 200,
        headers: {
          'Content-Type': 'image/webp',
          ETag: etag,
          'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=86400'
        }
      })
    }

    return new NextResponse(new Blob([toU8(buf)]), {
      status: 200,
      headers: {
        'Content-Type': contentTypeForExt(ext),
        ETag: etag,
        // Originals are larger; cache for a week to save data without being overly sticky.
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400'
      }
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
