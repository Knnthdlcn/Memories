import { NextResponse } from 'next/server'

export async function GET(){
  // Vercel deploys often don't have DATABASE_URL set (and SQLite isn't a great fit there).
  // Instead of crashing with a 500, return an empty list with a helpful message.
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      ok: false,
      items: [],
      error: 'DATABASE_URL is not set. Configure it in Vercel Environment Variables.'
    }, { status: 200 })
  }

  const { prisma } = await import('@/src/lib/prisma')
  const items = await prisma.media.findMany({ orderBy: { dateTaken: 'desc' } })
  return NextResponse.json({ ok: true, items })
}
