const fs = require('fs')
const path = require('path')
const exif = require('exif-parser')
const sharp = require('sharp')

async function main(){
  const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db'
  // lazy import Prisma client
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()

  const root = path.join(process.cwd(), 'public', 'media')
  const photosDir = path.join(root, 'photos')
  const videosDir = path.join(root, 'videos')

  const exists = p => fs.existsSync(p)

  const walk = dir => fs.readdirSync(dir).flatMap(f => {
    const p = path.join(dir, f)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) return walk(p)
    return [p]
  })

  const photoFiles = exists(photosDir) ? walk(photosDir).filter(f=>/\.(jpe?g|png|webp)$/i.test(f)) : []
  const videoFiles = exists(videosDir) ? walk(videosDir).filter(f=>/\.(mp4|webm|mov)$/i.test(f)) : []

  console.log('Found', photoFiles.length, 'photos and', videoFiles.length, 'videos')

  const processPhoto = async (file) => {
    const buf = fs.readFileSync(file)
    let date = null
    try{
      const p = exif.create(buf).parse()
      if (p.tags && p.tags.DateTimeOriginal) {
        date = new Date(p.tags.DateTimeOriginal * 1000)
      }
    }catch(e){ }

    // fallback to file mtime
    if (!date) date = fs.statSync(file).mtime

    // generate small blur placeholder
    let blurDataUrl = null
    try{
      const b = await sharp(buf).resize(16,16,{fit:'inside'}).blur().toBuffer()
      blurDataUrl = `data:image/jpeg;base64,${b.toString('base64')}`
    }catch(e){ }

    const rel = path.relative(path.join(process.cwd(),'public'), file).replace(/\\/g, '/')

    await prisma.media.upsert({
      where: { relativePath: rel },
      update: { dateTaken: date },
      create: { type: 'photo', relativePath: rel, dateTaken: date }
    })
  }

  const processVideo = async (file) => {
    const stat = fs.statSync(file)
    const date = stat.birthtime || stat.mtime
    const rel = path.relative(path.join(process.cwd(),'public'), file).replace(/\\/g, '/')
    await prisma.media.upsert({
      where: { relativePath: rel },
      update: { dateTaken: date },
      create: { type: 'video', relativePath: rel, dateTaken: date }
    })
  }

  for (const f of photoFiles) await processPhoto(f)
  for (const f of videoFiles) await processVideo(f)

  await prisma.$disconnect()
  console.log('Ingest complete')
}

main().catch(err => { console.error(err); process.exit(1) })
