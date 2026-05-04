import { auth } from '@/auth'
import { db } from '@/lib/db'
import { parsePngDataUrlSignature } from '@/lib/signature-png'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

const MIN_PASSWORD_LEN = 8

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    action?: string
    firstName?: string
    lastName?: string
    currentPassword?: string
    newPassword?: string
    dataUrl?: string | null
  } | null
  if (!body?.action) return NextResponse.json({ error: 'action обязателен' }, { status: 400 })

  if (body.action === 'profile') {
    const first = (body.firstName ?? '').trim()
    const last = (body.lastName ?? '').trim()
    const name = [first, last].filter(Boolean).join(' ').trim()
    if (!name) return NextResponse.json({ error: 'Укажите имя или фамилию' }, { status: 400 })
    await db.user.update({
      where: { id: session.user.id },
      data: { name },
    })
    return NextResponse.json({ ok: true, name })
  }

  if (body.action === 'password') {
    const current = body.currentPassword ?? ''
    const next = body.newPassword ?? ''
    if (next.length < MIN_PASSWORD_LEN) {
      return NextResponse.json({ error: `Пароль не короче ${MIN_PASSWORD_LEN} символов` }, { status: 400 })
    }
    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const ok = await bcrypt.compare(current, user.password)
    if (!ok) return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 400 })
    const hash = await bcrypt.hash(next, 10)
    await db.user.update({
      where: { id: session.user.id },
      data: { password: hash },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'savedActSignature') {
    const raw = body.dataUrl
    if (raw === null || raw === '') {
      await db.user.update({
        where: { id: session.user.id },
        data: { savedActSignature: null },
      })
      return NextResponse.json({ ok: true, savedActSignature: null })
    }
    const png = parsePngDataUrlSignature(raw)
    if (!png) {
      return NextResponse.json({ error: 'Нужна подпись в формате PNG (data URL)' }, { status: 400 })
    }
    await db.user.update({
      where: { id: session.user.id },
      data: { savedActSignature: png },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })
}
