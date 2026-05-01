import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

const MAX_AVATAR_SIZE = 2_000_000

function isValidAvatarDataUrl(value: string) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const avatarUrl = typeof body?.avatarUrl === 'string' ? body.avatarUrl : ''

  if (!avatarUrl) {
    await db.user.update({
      where: { id: session.user.id },
      data: { avatarUrl: null },
      select: { id: true },
    })
    return NextResponse.json({ ok: true, avatarUrl: null })
  }

  if (!isValidAvatarDataUrl(avatarUrl)) {
    return NextResponse.json({ error: 'Неверный формат аватара' }, { status: 400 })
  }

  if (avatarUrl.length > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: 'Файл слишком большой (макс. 2MB)' }, { status: 400 })
  }

  const updated = await db.user.update({
    where: { id: session.user.id },
    data: { avatarUrl },
    select: { avatarUrl: true },
  })

  return NextResponse.json({ ok: true, avatarUrl: updated.avatarUrl })
}
