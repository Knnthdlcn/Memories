import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/src/lib/prisma'

export async function POST(req: Request){
  try{
    const form = await req.formData()
    const file = form.get('file') as any
    if (!file || !file.stream) return NextResponse.json({ ok: false, error: 'no file' })

    const filename = file.name || `upload-${Date.now()}`
    const mediaDir = path.join(process.cwd(), 'public', 'media', 'photos')
    fs.mkdirSync(mediaDir, { recursive: true })
    const out = path.join(mediaDir, filename)
    const stream = file.stream()
    const writable = fs.createWriteStream(out)
    await stream.pipeTo(writable)

    const rel = path.relative(path.join(process.cwd(),'public'), out).replace(/\\/g,'/')
    await prisma.media.upsert({ where: { relativePath: rel }, update: {}, create: { type: 'photo', relativePath: rel } })

    return NextResponse.json({ ok: true, path: rel })
  }catch(e){
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
