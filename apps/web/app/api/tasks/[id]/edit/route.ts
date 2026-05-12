import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { ChecklistItemAction } from '@prisma/client'
import { isValidDiagnosticsActionForLabel, needsDiagnosticsPerformedAction } from '@/lib/checklist-diagnostics'
import { MAX_REPORT_PHOTOS } from '@/lib/photo-limits'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as
    | {
        comment?: string
        scheduledAt?: string | null
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY'
        report?: {
          currentHours?: number
          nextServiceHours?: number | null
          pressure?: number | null
          oilTemp?: number | null
          airTemp?: number | null
          roomCondition?: string | null
          notes?: string | null
          recommendations?: string | null
          checklist?: Array<{ label?: string; checked?: boolean; isAuto?: boolean; action?: string | null }>
          partsUsed?: Array<{ name?: string; quantity?: number; unit?: string }>
          reportPhotos?: string[]
        }
      }
    | null
  if (!body) return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 })

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: { report: true, equipment: true },
  })
  if (!task || task.deletedAt) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 })
  if (task.status !== 'DONE') {
    return NextResponse.json({ error: 'Редактирование доступно только для выполненных задач' }, { status: 400 })
  }
  if (!task.report) {
    return NextResponse.json({ error: 'У задачи нет отчёта для редактирования' }, { status: 400 })
  }

  const priority = body.priority && ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].includes(body.priority) ? body.priority : task.priority
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : body.scheduledAt === null ? null : task.scheduledAt

  const reportCurrentHours =
    typeof body.report?.currentHours === 'number' && Number.isFinite(body.report.currentHours)
      ? Math.max(0, Math.floor(body.report.currentHours))
      : task.report.currentHours
  const reportNextServiceHours =
    typeof body.report?.nextServiceHours === 'number' && Number.isFinite(body.report.nextServiceHours)
      ? Math.max(0, Math.floor(body.report.nextServiceHours))
      : body.report?.nextServiceHours === null
        ? null
        : task.report.nextServiceHours
  const reportPressure =
    typeof body.report?.pressure === 'number' && Number.isFinite(body.report.pressure)
      ? body.report.pressure
      : body.report?.pressure === null
        ? null
        : task.report.pressure
  const reportOilTemp =
    typeof body.report?.oilTemp === 'number' && Number.isFinite(body.report.oilTemp)
      ? body.report.oilTemp
      : body.report?.oilTemp === null
        ? null
        : task.report.oilTemp
  const reportAirTemp =
    typeof body.report?.airTemp === 'number' && Number.isFinite(body.report.airTemp)
      ? body.report.airTemp
      : body.report?.airTemp === null
        ? null
        : task.report.airTemp
  const reportRoomCondition =
    typeof body.report?.roomCondition === 'string'
      ? body.report.roomCondition
      : body.report?.roomCondition === null
        ? null
        : task.report.roomCondition
  const checklistItems = Array.isArray(body.report?.checklist)
    ? body.report!.checklist
        .filter((c) => typeof c?.label === 'string' && typeof c?.checked === 'boolean')
        .map((c) => ({
          label: c.label as string,
          checked: c.checked as boolean,
          isAuto: Boolean(c.isAuto),
          action: typeof c.action === 'string' || c.action === null ? c.action : null,
        }))
    : null

  if (checklistItems && task.type === 'DIAGNOSTICS') {
    for (const row of checklistItems) {
      if (needsDiagnosticsPerformedAction(row)) {
        if (!isValidDiagnosticsActionForLabel(row.label, row.action ?? undefined)) {
          return NextResponse.json(
            { error: 'Для диагностики у каждого отмеченного пункта выберите действие' },
            { status: 400 }
          )
        }
      }
    }
  }
  const partsUsed = Array.isArray(body.report?.partsUsed)
    ? body.report!.partsUsed
        .filter(
          (p) =>
            typeof p?.name === 'string' &&
            p.name.trim().length > 0 &&
            typeof p?.quantity === 'number' &&
            Number.isFinite(p.quantity) &&
            typeof p?.unit === 'string'
        )
        .map((p) => ({
          name: (p.name as string).trim(),
          quantity: p.quantity as number,
          unit: (p.unit as string).trim() || 'шт',
        }))
    : null
  const reportPhotos = Array.isArray(body.report?.reportPhotos)
    ? body.report!.reportPhotos
        .filter((url) => typeof url === 'string' && (url.startsWith('data:image/') || url.startsWith('http')))
        .slice(0, MAX_REPORT_PHOTOS)
    : null

  await db.$transaction(async (tx) => {
    await tx.serviceTask.update({
      where: { id: task.id },
      data: {
        comment: typeof body.comment === 'string' ? body.comment : task.comment,
        scheduledAt,
        priority,
      },
    })

    await tx.workReport.update({
      where: { id: task.report!.id },
      data: {
        currentHours: reportCurrentHours,
        nextServiceHours: reportNextServiceHours,
        pressure: reportPressure,
        oilTemp: reportOilTemp,
        airTemp: reportAirTemp,
        roomCondition: reportRoomCondition,
        notes: body.report?.notes ?? task.report!.notes,
        recommendations: body.report?.recommendations ?? task.report!.recommendations,
        checklistItems:
          checklistItems !== null
            ? {
                deleteMany: {},
                create: checklistItems.map((item, index) => ({
                  label: item.label,
                  checked: item.checked,
                  order: index,
                  performedAction:
                    task.type === 'DIAGNOSTICS' && needsDiagnosticsPerformedAction(item) && item.action
                      ? (item.action as ChecklistItemAction)
                      : null,
                })),
              }
            : undefined,
        partsUsed:
          partsUsed !== null
            ? {
                deleteMany: {},
                create: partsUsed.map((part) => ({
                  name: part.name,
                  quantity: part.quantity,
                  unit: part.unit,
                })),
              }
            : undefined,
        attachments:
          reportPhotos !== null
            ? {
                deleteMany: {},
                create: reportPhotos.map((url, index) => ({
                  url,
                  type: 'OTHER',
                  caption: `Фото отчета ${index + 1}`,
                })),
              }
            : undefined,
      },
    })

    await tx.equipment.update({
      where: { id: task.equipmentId },
      data: {
        currentHours: reportCurrentHours,
        nextServiceHours: reportNextServiceHours,
        lastServiceHours: reportCurrentHours,
      },
    })
  })

  return NextResponse.json({ ok: true })
}
