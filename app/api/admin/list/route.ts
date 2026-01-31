import { prisma } from '@/src/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(){
  const items = await prisma.media.findMany({ orderBy: { dateTaken: 'desc' } })
  return NextResponse.json({ ok: true, items })
}
