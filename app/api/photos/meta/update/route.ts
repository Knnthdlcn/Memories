import { NextResponse } from 'next/server'
import { upsertPhotoMeta } from '@/src/lib/photosMeta'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const key = String(body?.key || '')
    const message = typeof body?.message === 'string' ? body.message : ''
    const featured = !!body?.featured

    const meta = await upsertPhotoMeta(key, { message, featured })
    return NextResponse.json({ ok: true, meta })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 })
  }
}
