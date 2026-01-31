import { NextResponse } from 'next/server'
import { getLocalPhotos } from '@/src/lib/localPhotos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const photos = await getLocalPhotos()
  // Only return what the admin/story needs
  const items = photos.map(p => ({
    key: p.key,
    date: p.date.toISOString(),
    srcThumb: p.srcThumb,
    srcFull: p.srcFull,
    message: p.message || '',
    featured: !!p.featured,
    order: typeof p.order === 'number' ? p.order : undefined
  }))

  return NextResponse.json({ ok: true, items })
}
