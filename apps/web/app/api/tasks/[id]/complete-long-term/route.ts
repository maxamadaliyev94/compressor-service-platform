import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createNotification, notifyClientSubscriberForEquipmentWork } from '@/lib/notifications'
import { syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'
import { parsePngDataUrlSignature } from '@/lib/signature-png'
import type { Role } from '@prisma/client'

function parseSignedAt(value: unknown): Date {
  if (typeof value !== 'string') return new Date()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as Role
  if (role !== 'CHIEF_ENGINEER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Только главный инженер или администратор может закрыть долгосрочную задачу' }, { status: 403 })
  }

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

  const chiefNotes =
    typeof (body as { chiefNotes?: unknown }).chiefNotes === 'string'
      ? (body as { chiefNotes: string }).chiefNotes.trim()
      : ''
  const recommendations =
    typeof (body as { recommendations?: unknown }).recommendations === 'string'
      ? (body as { recommendations: string }).recommendations.trim()
      : null

  const engineerSignature = parsePngDataUrlSignature((body as { engineerSignature?: unknown }).engineerSignature)
  if (!engineerSignature) {
    return NextResponse.json({ error: 'Требуется подпись главного инженера (PNG)' }, { status: 400 })
  }
  const optionalClient = parsePngDataUrlSignature((body as { clientSignature?: unknown }).clientSignature)
  const engineerSignedAt = parseSignedAt((body as { engineerSignedAt?: unknown }).engineerSignedAt)

  const loadHours = toOptionalNumber((body as { loadHours?: unknown }).loadHours)
  const voltageL1 = toOptionalNumber((body as { voltageL1?: unknown }).voltageL1)
  const voltageL2 = toOptionalNumber((body as { voltageL2?: unknown }).voltageL2)
  const voltageL3 = toOptionalNumber((body as { voltageL3?: unknown }).voltageL3)
  const currentL1 = toOptionalNumber((body as { currentL1?: unknown }).currentL1)
  const currentL2 = toOptionalNumber((body as { currentL2?: unknown }).currentL2)
  const currentL3 = toOptionalNumber((body as { currentL3?: unknown }).currentL3)
  const ambientTemp = toOptionalNumber((body as { ambientTemp?: unknown }).ambientTemp)
  const oilTemp = toOptionalNumber((body as { oilTemp?: unknown }).oilTemp)
  const pressureUpper = toOptionalNumber((body as { pressureUpper?: unknown }).pressureUpper)
  const pressureLower = toOptionalNumber((body as { pressureLower?: unknown }).pressureLower)

  const roomConditionLines: string[] = []
  if (voltageL1 !== null || voltageL2 !== null || voltageL3 !== null) {
    roomConditionLines.push(
      `Напряжение: L1=${voltageL1 ?? '—'}V, L2=${voltageL2 ?? '—'}V, L3=${voltageL3 ?? '—'}V`
    )
  }
  if (currentL1 !== null || currentL2 !== null || currentL3 !== null) {
    roomConditionLines.push(
      `Ток: Ф1=${currentL1 ?? '—'}A, Ф2=${currentL2 ?? '—'}A, Ф3=${currentL3 ?? '—'}A`
    )
  }
  if (pressureLower !== null) {
    roomConditionLines.push(`Давление нижнее: ${pressureLower} бар`)
  }
  if (loadHours !== null) {
    roomConditionLines.push(`Моточасы под нагрузкой: ${loadHours}`)
  }
  const roomCondition = roomConditionLines.length > 0 ? roomConditionLines.join('; ') : null

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: { report: true, equipment: true },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.deletedAt) return NextResponse.json({ error: 'Задача находится в корзине' }, { status: 400 })
  if (task.taskType !== 'LONG_TERM') {
    return NextResponse.json({ error: 'Это не долгосрочная задача' }, { status: 400 })
  }
  if (task.report) return NextResponse.json({ error: 'Отчёт уже существует' }, { status: 400 })
  if (task.status === 'DONE' || task.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Задача уже закрыта' }, { status: 400 })
  }

  if (role === 'CHIEF_ENGINEER') {
    if (!task.managedByChiefId || task.managedByChiefId !== session.user.id) {
      return NextResponse.json({ error: 'Вы не ответственный главный инженер по этой задаче' }, { status: 403 })
    }
  }

  const dailyWorks = await db.dailyWork.findMany({
    where: { taskId: task.id },
    include: { engineer: { select: { name: true } } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })

  const journalLines: string[] = []
  for (const dw of dailyWorks) {
    const ds = new Date(dw.date).toLocaleDateString('ru-RU')
    journalLines.push(`--- ${ds} · ${dw.engineer.name} ---\n${dw.description}`)
    const arr = dw.checklist as { label?: string; checked?: boolean }[]
    if (Array.isArray(arr)) {
      for (const c of arr) {
        if (c.checked && typeof c.label === 'string') {
          journalLines.push(`  ✓ ${c.label}`)
        }
      }
    }
    journalLines.push('')
  }
  const journalText = journalLines.join('\n').trim()
  const notesCombined = [chiefNotes || null, journalText || 'Журнал работ пуст.'].filter(Boolean).join('\n\n')

  const checklistCreates: { label: string; checked: boolean; order: number; performedAction: null }[] = []
  let order = 0
  checklistCreates.push({
    label: 'Долгосрочная задача: сводный журнал работ по дням (см. раздел «Заметки»)',
    checked: true,
    order: order++,
    performedAction: null,
  })
  for (const dw of dailyWorks) {
    const ds = new Date(dw.date).toLocaleDateString('ru-RU')
    checklistCreates.push({
      label: `${ds} — ${dw.engineer.name}: ${dw.description.slice(0, 400)}${dw.description.length > 400 ? '…' : ''}`,
      checked: true,
      order: order++,
      performedAction: null,
    })
  }

  const actNumber = `AKT-LT-${task.id.slice(-8).toUpperCase()}`
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
          pressure: pressureUpper,
          oilTemp,
          airTemp: ambientTemp,
          roomCondition,
          notes: notesCombined,
          recommendations,
          actNumber,
          engineerSignature,
          clientSignature: optionalClient,
          engineerSignedAt,
          clientSignedAt: optionalClient ? parseSignedAt((body as { clientSignedAt?: unknown }).clientSignedAt) : null,
          checklistItems: {
            create: checklistCreates,
          },
          partsUsed: { create: [] },
          attachments: { create: [] },
        },
      })

      await tx.serviceTask.update({
        where: { id: task.id },
        data: {
          status: 'DONE',
          completedAt: new Date(),
          engineerSignature,
          clientSignature: optionalClient,
        },
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
            comment: `Закрытие долгосрочной задачи ${task.id}`,
          },
        })
      }
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сохранения' }, { status: 500 })
  }

  if (task.createdById && task.createdById !== session.user.id) {
    await createNotification({
      userId: task.createdById,
      title: '✅ Долгосрочная задача закрыта',
      message: 'Главный инженер закрыл долгосрочную задачу и сформировал сводный акт.',
      type: 'SUCCESS',
      link: `/tasks/${task.id}`,
    })
  }

  await notifyClientSubscriberForEquipmentWork(
    task.equipmentId,
    {
      title: '✅ Долгосрочная задача выполнена',
      message: 'Долгосрочная задача закрыта, сводный акт сформирован.',
      type: 'SUCCESS',
      link: `/tasks/${task.id}`,
    },
    { skipUserIds: task.createdById ? [task.createdById] : [] }
  )

  if (task.assignedToId) {
    await syncEngineerFreeIfNoActiveTasks(task.assignedToId)
  }

  return NextResponse.json({ ok: true })
}
