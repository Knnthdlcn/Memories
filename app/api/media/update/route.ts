import { NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function POST(request: Request){
  try{
    const body = await request.json()
    const { id, message, featured } = body
    const updated = await prisma.media.update({ where: { id }, data: { message, featured } })
    return NextResponse.json({ ok: true, media: updated })
  }catch(e){
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
