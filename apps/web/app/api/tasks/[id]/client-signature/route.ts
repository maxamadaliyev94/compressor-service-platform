import { db } from '@/lib/db'
import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import type { Role } from '@prisma/client'

const MAX_SIGNATURE_BYTES = 2_000_000

function parsePngDataUrlSignature(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('data:image/png;base64,')) return null
  if (value.length > MAX_SIGNATURE_BYTES) return null
  return value
}

function canAddClientSignature(
  role: Role,
  userId: string,
  task: { assignedToId: string | null; status: string }
): boolean {
  if (task.status !== 'DONE') return false
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'CHIEF_ENGINEER') return true
  if (role === 'ENGINEER' && task.assignedToId === userId) return true
  return false
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const sig = parsePngDataUrlSignature((body as { clientSignature?: unknown })?.clientSignature)
  if (!sig) {
    return NextResponse.json({ error: 'Нужна подпись клиента (PNG)' }, { status: 400 })
  }

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: { report: true },
  })

  if (!task || task.deletedAt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!task.report) return NextResponse.json({ error: 'Нет отчёта по задаче' }, { status: 400 })
  if (task.report.clientSignature) {
    return NextResponse.json({ error: 'Подпись клиента уже сохранена' }, { status: 400 })
  }

  if (!canAddClientSignature(session.user.role as Role, session.user.id, task)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
