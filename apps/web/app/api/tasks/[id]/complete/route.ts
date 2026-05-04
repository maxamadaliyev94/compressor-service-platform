import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createNotification } from '@/lib/notifications'
import { syncEngineerFreeIfNoActiveTasks } from '@/lib/engineerPresence'
import { parsePngDataUrlSignature } from '@/lib/signature-png'
import type { Role, ServiceTask } from '@prisma/client'

function canExecuteServiceTask(role: Role, userId: string, task: ServiceTask): boolean {
  if (role === 'CLIENT') return false
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'CHIEF_ENGINEER') return true
  if (role === 'ENGINEER') return task.assignedToId === userId
  return false
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseSignedAt(value: unknown): Date {
  if (typeof value !== 'string') return new Date()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date() : d
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
  const reportPhotosRaw = (body as { reportPhotos?: unknown }).reportPhotos
  const reportPhotos = Array.isArray(reportPhotosRaw)
    ? reportPhotosRaw.filter((v): v is string => typeof v === 'string' && v.startsWith('data:image/')).slice(0, 10)
    : []

  const engineerSignature = parsePngDataUrlSignature((body as { engineerSignature?: unknown }).engineerSignature)
  if (!engineerSignature) {
    return NextResponse.json({ error: 'Требуется подпись инженера (PNG)' }, { status: 400 })
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
          pressure: pressureUpper,
          oilTemp,
          airTemp: ambientTemp,
          roomCondition,
          notes,
          recommendations,
          actNumber,
          engineerSignature,
          clientSignature: optionalClient,
          engineerSignedAt,
          clientSignedAt: optionalClient ? parseSignedAt((body as { clientSignedAt?: unknown }).clientSignedAt) : null,
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
          attachments: {
            create: reportPhotos.map((url, index) => ({
              url,
              type: 'OTHER',
              caption: `Фото отчета ${index + 1}`,
            })),
          },
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

  if (task.assignedToId) {
    await syncEngineerFreeIfNoActiveTasks(task.assignedToId)
  }

  return NextResponse.json({ ok: true })
}
