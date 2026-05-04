import { db } from '@/lib/db'
import { auth } from '@/auth'
import { hasPermission } from '@/lib/permissions'
import type { Role } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

const MAX_SIGNATURE_BYTES = 2_000_000

function parsePngDataUrlSignature(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('data:image/png;base64,')) return null
  if (value.length > MAX_SIGNATURE_BYTES) return null
  return value
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (session.user.role !== 'CLIENT') {
    return NextResponse.json({ error: 'Подпись клиента может поставить только пользователь с ролью «Клиент»' }, { status: 403 })
  }

  if (!(await hasPermission(session.user.role as Role, 'action:act.clientSign'))) {
    return NextResponse.json({ error: 'Недостаточно прав для подписания акта' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const sig = parsePngDataUrlSignature((body as { clientSignature?: unknown })?.clientSignature)
  if (!sig) {
    return NextResponse.json({ error: 'Нужна подпись клиента (PNG)' }, { status: 400 })
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { clientId: true, role: true },
  })
  if (!dbUser?.clientId) {
    return NextResponse.json(
      {
        error:
          'Аккаунт не привязан к организации. Обратитесь к администратору, чтобы связать ваш логин с карточкой клиента.',
      },
      { status: 403 }
    )
  }

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: {
      report: true,
      equipment: { include: { object: { include: { branch: true } } } },
    },
  })

  if (!task || task.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!task.report) return NextResponse.json({ error: 'Нет отчёта по задаче' }, { status: 400 })
  if (task.report.clientSignature) {
    return NextResponse.json({ error: 'Подпись клиента уже сохранена' }, { status: 400 })
  }
  if (task.status !== 'DONE') {
    return NextResponse.json({ error: 'Задача ещё не закрыта' }, { status: 400 })
  }

  const taskClientId = task.equipment.object.branch.clientId
  if (dbUser.clientId !== taskClientId) {
    return NextResponse.json({ error: 'Эта задача относится к другому клиенту' }, { status: 403 })
  }

  const signedAt = new Date()

  await db.$transaction([
    db.workReport.update({
      where: { id: task.report.id },
      data: {
        clientSignature: sig,
        clientSignedAt: signedAt,
      },
    }),
    db.serviceTask.update({
      where: { id: task.id },
      data: { clientSignature: sig },
    }),
  ])

  return NextResponse.json({ ok: true, clientSignedAt: signedAt.toISOString() })
}
