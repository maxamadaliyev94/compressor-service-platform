import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  if (body.action === 'toggle') {
    const user = await db.user.findUnique({ where: { id: params.id } })
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated = await db.user.update({
      where: { id: params.id },
      data: { isActive: !user.isActive },
    })
    return NextResponse.json({ isActive: updated.isActive })
  }

  if (body.action === 'resetPassword') {
    const hash = await bcrypt.hash('password123', 10)
    await db.user.update({
      where: { id: params.id },
      data: { password: hash },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    await db.user.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Невозможно удалить пользователя' }, { status: 400 })
  }
}
