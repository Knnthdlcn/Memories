import { NextResponse } from 'next/server'
import { downloadFromGoogleDrive } from '@/src/lib/googleDrive'

function toU8(buf: Buffer) {
  // @types/node models Buffer.buffer as ArrayBufferLike (which can include SharedArrayBuffer).
  // In practice here it's an ArrayBuffer; cast to satisfy BlobPart typing.
  return new Uint8Array(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength)
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  if (!id || typeof id !== 'string') {
    return new NextResponse('Missing id', { status: 400 })
  }

  // Check env vars early and return helpful error
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.error('Missing Google OAuth env vars')
    return new NextResponse('Server configuration error: Missing Google credentials', { status: 500 })
  }

  try {
    console.log(`[drive-media] Fetching file ${id}`)
    const buf = await downloadFromGoogleDrive(id)
    console.log(`[drive-media] Downloaded ${buf.length} bytes`)

    // Return original image directly
    return new NextResponse(toU8(buf), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400'
      }
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
