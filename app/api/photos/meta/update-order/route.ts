import { NextRequest } from 'next/server'
import { upsertPhotoMeta } from '@/src/lib/photosMeta'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { updates } = body

    if (!Array.isArray(updates)) {
      return Response.json({ ok: false, error: 'Invalid updates format' })
    }

    // Update each photo's order
    for (const update of updates) {
      const { key, order } = update
      if (!key || typeof key !== 'string' || typeof order !== 'number') {
        continue
      }

      await upsertPhotoMeta(key, { order })
    }

    return Response.json({ ok: true })
  } catch (error: any) {
    console.error('Update order error:', error)
    return Response.json({ ok: false, error: error.message || 'Update failed' })
  }
}
