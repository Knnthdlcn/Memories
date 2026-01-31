import { NextResponse } from 'next/server'

export async function POST(request: Request){
  const form = await request.formData()
  const password = form.get('password')
  const ADMIN = process.env.ADMIN_PASSWORD || 'changeme'
  if (password === ADMIN){
    const res = NextResponse.json({ success: true })
    // set simple cookie
    res.cookies.set('admin', '1', { httpOnly: true, path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
    return res
  }
  return NextResponse.json({ success: false }, { status: 401 })
}
