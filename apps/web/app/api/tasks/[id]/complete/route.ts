import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createNotification } from '@/lib/notifications'
import type { Role, ServiceTask } from '@prisma/client'

function canExecuteServiceTask(role: Role, userId: string, task: ServiceTask): boolean {
  if (role === 'CLIENT') return false
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'CHIEF_ENGINEER') return true
  if (role === 'ENGINEER') return task.assignedToId === userId
  return false
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 })
  }

  const currentHours = Number((body as { currentHours?: unknown }).currentHours)
  const nextServiceHours = Number((body as { nextServiceHours?: unknown }).nextServiceHours)
  if (!Number.isFinite(currentHours) || !Number.isInteger(currentHours) || currentHours < 0) {
    return NextResponse.json({ error: 'Некорректные моточасы' }, { status: 400 })
  }
  if (!Number.isFinite(nextServiceHours) || !Number.isInteger(nextServiceHours) || nextServiceHours < 0) {
    return NextResponse.json({ error: 'Некорректное следующее ТО' }, { status: 400 })
  }

  const checklistRaw = (body as { checklist?: unknown }).checklist
  const checklist = Array.isArray(checklistRaw) ? checklistRaw : []
  for (const c of checklist) {
    if (
      typeof c !== 'object' ||
      c === null ||
      typeof (c as { label?: unknown }).label !== 'string' ||
      typeof (c as { checked?: unknown }).checked !== 'boolean'
    ) {
      return NextResponse.json({ error: 'Некорректный чек-лист' }, { status: 400 })
    }
  }

  const partsRaw = (body as { partsUsed?: unknown }).partsUsed
  const partsUsed = Array.isArray(partsRaw) ? partsRaw : []
  for (const p of partsUsed) {
    if (
      typeof p !== 'object' ||
      p === null ||
      typeof (p as { name?: unknown }).name !== 'string' ||
      typeof (p as { quantity?: unknown }).quantity !== 'number' ||
      typeof (p as { unit?: unknown }).unit !== 'string'
    ) {
      return NextResponse.json({ error: 'Некорректные запчасти' }, { status: 400 })
    }
  }

  const notes =
    typeof (body as { notes?: unknown }).notes === 'string'
      ? (body as { notes: string }).notes
      : null
  const recommendations =
    typeof (body as { recommendations?: unknown }).recommendations === 'string'
      ? (body as { recommendations: string }).recommendations
      : null

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: { report: true, equipment: true },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.report) return NextResponse.json({ error: 'Отчёт уже существует' }, { status: 400 })
  if (task.status === 'DONE' || task.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Задача уже закрыта' }, { status: 400 })
  }

  if (!canExecuteServiceTask(session.user.role as Role, session.user.id, task)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const actNumber = `AKT-${task.id.slice(-8).toUpperCase()}`

  const prevHours = task.equipment.currentHours

  try {
    await db.$transaction(async (tx) => {
      await tx.workReport.create({
        data: {
          taskId: task.id,
          engineerId: session.user.id,
          startedAt: new Date(),
          finishedAt: new Date(),
          currentHours,
          nextServiceHours,
          notes,
          recommendations,
          actNumber,
          checklistItems: {
            create: checklist.map((c, i) => ({
              label: (c as { label: string }).label,
              checked: (c as { checked: boolean }).checked,
              order: i,
            })),
          },
          partsUsed: {
            create: partsUsed.map((p) => ({
              name: (p as { name: string }).name,
              quantity: (p as { quantity: number }).quantity,
              unit: (p as { unit: string }).unit,
            })),
          },
        },
      })

      await tx.serviceTask.update({
        where: { id: task.id },
        data: { status: 'DONE', completedAt: new Date() },
      })

      await tx.equipment.update({
        where: { id: task.equipmentId },
        data: {
          currentHours,
          nextServiceHours,
          lastServiceHours: currentHours,
          lastServiceDate: new Date(),
        },
      })

      if (prevHours !== currentHours) {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'UPDATE_HOURS',
            entity: 'Equipment',
            entityId: task.equipmentId,
            oldValue: String(prevHours),
            newValue: String(currentHours),
            comment: `Закрытие задачи ${task.id}`,
          },
        })
      }
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 })
  }

  if (task.createdById) {
    await createNotification({
      userId: task.createdById,
      title: '✅ Задача выполнена',
      message: 'Задача успешно закрыта инженером',
      type: 'SUCCESS',
      link: `/tasks/${task.id}`,
    })
  }

  return NextResponse.json({ ok: true })
}
