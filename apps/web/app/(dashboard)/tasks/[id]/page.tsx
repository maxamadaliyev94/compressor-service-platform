import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { checklistActionLabelRu } from '@/lib/checklist-diagnostics'
import { parseDelegationParentTaskId } from '@/lib/task-delegation'
import { hasPermission } from '@/lib/permissions'
import TaskAdminActions from './TaskAdminActions'
import TaskDelegatePanel from './TaskDelegatePanel'
import TaskChiefWorkTypePanel from './TaskChiefWorkTypePanel'
import TaskLongTermChiefPanel from './TaskLongTermChiefPanel'
import TaskScheduledAtEditor from './TaskScheduledAtEditor'
import TaskLongTermDatesEditor from './TaskLongTermDatesEditor'
import ClientSignaturePanel from './ClientSignaturePanel'
import type { Role } from '@prisma/client'

const typeLabels: Record<string, string> = {
  PLANNED_MAINTENANCE: 'Плановое ТО', DIAGNOSTICS: 'Диагностика',
  WARRANTY_REPAIR: 'Гарантийный ремонт', EMERGENCY: 'Аварийный выезд',
  INSTALLATION: 'Монтаж', COMMISSIONING: 'Пусконаладка',
}
const statusLabels: Record<string, string> = {
  NEW: 'Новая', ASSIGNED: 'Назначена', IN_PROGRESS: 'В работе',
  DONE: 'Выполнено', CANCELLED: 'Отменена', REVIEW: 'На проверке',
  DRAFT: 'Черновик', REVISION: 'Доработка',
}
const statusColors: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700', ASSIGNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700', DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700', REVIEW: 'bg-purple-100 text-purple-700',
  DRAFT: 'bg-gray-100 text-gray-500', REVISION: 'bg-orange-100 text-orange-700',
}

/** Префикс «ДД.ММ.ГГГГ — » в пунктах сводного чек-листа долгосрочной задачи */
function longTermChecklistLabelForClient(label: string): string {
  return label.replace(/^\d{1,2}\.\d{1,2}\.\d{4}\s*[\u2014\u2013-]\s*/u, '')
}

/** Убирает заголовки журнала «--- дата · ФИО ---» из текста заметок акта для клиента */
function longTermReportNotesForClient(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n')
  return normalized
    .replace(/\n*--- \d{1,2}\.\d{1,2}\.\d{4} · (.+?) ---\s*\n/g, '\n\n$1:\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  const isAdmin = session?.user?.role === 'ADMIN'
  const canEditDone = ['ADMIN', 'MANAGER'].includes(session?.user?.role ?? '')
  const canExecute = ['ENGINEER', 'CHIEF_ENGINEER', 'ADMIN', 'MANAGER'].includes(
    session?.user?.role ?? ''
  )

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: {
      equipment: {
        include: { object: { include: { branch: { include: { client: true } } } } }
      },
      assignedTo: true,
      createdBy: true,
      report: {
        include: {
          checklistItems: true,
          partsUsed: true,
          attachments: { orderBy: { createdAt: 'asc' } },
        },
      },
      dailyWorks: {
        include: { engineer: { select: { id: true, name: true } } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      },
      longTermEngineers: {
        include: { engineer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!task || task.deletedAt) notFound()

  const client = task.equipment.object.branch.client
  if (session.user.role === 'CLIENT') {
    const sessionClientId = session.user.clientId ?? null
    if (!sessionClientId || sessionClientId !== client.id) {
      notFound()
    }
  }
  if (session.user.role === 'ENGINEER') {
    const onTask =
      task.assignedToId === session.user.id ||
      task.longTermEngineers.some((r) => r.engineerId === session.user.id)
    if (!onTask) notFound()
  }

  const isNotDone = !['DONE', 'CANCELLED'].includes(task.status)
  const canAssignTasks = await hasPermission(session.user.role as Role, 'action:task.assign')
  const showChiefDelegate =
    task.taskType !== 'LONG_TERM' &&
    canAssignTasks &&
    (session?.user?.role === 'ADMIN' ||
      (session?.user?.role === 'CHIEF_ENGINEER' &&
        (task.assignedToId === session.user.id || task.managedByChiefId === session.user.id)) ||
      session?.user?.role === 'MANAGER') &&
    isNotDone &&
    !task.report

  const showLongTermChiefPanel =
    task.taskType === 'LONG_TERM' &&
    isNotDone &&
    !task.report &&
    (session.user.role === 'ADMIN' ||
      (session.user.role === 'CHIEF_ENGINEER' &&
        (task.managedByChiefId === session.user.id ||
          (!task.managedByChiefId && task.assignedToId === session.user.id))))

  let chiefOwnsDelegatedSubtree = false
  if (session.user.role === 'CHIEF_ENGINEER') {
    const parentId = parseDelegationParentTaskId(task.comment)
    if (parentId) {
      const parentRow = await db.serviceTask.findUnique({
        where: { id: parentId },
        select: { assignedToId: true, managedByChiefId: true, deletedAt: true },
      })
      chiefOwnsDelegatedSubtree = Boolean(
        parentRow &&
          !parentRow.deletedAt &&
          (parentRow.assignedToId === session.user.id || parentRow.managedByChiefId === session.user.id)
      )
    }
  }

  const canEditScheduledAt =
    isNotDone &&
    (session.user.role === 'ADMIN' ||
      (session.user.role === 'CHIEF_ENGINEER' &&
        (task.assignedToId === session.user.id ||
          task.managedByChiefId === session.user.id ||
          chiefOwnsDelegatedSubtree)))

  const canEditLongTermPlanDates =
    isNotDone &&
    (session.user.role === 'ADMIN' ||
      (session.user.role === 'CHIEF_ENGINEER' &&
        (task.managedByChiefId === session.user.id ||
          (!task.managedByChiefId && task.assignedToId === session.user.id))))

  const eq = task.equipment
  const branch = eq.object.branch
  const destinationText = [client.city, branch.address, eq.object.name, client.name].filter(Boolean).join(', ')
  const yandexRouteUrl =
    branch.latitude !== null && branch.longitude !== null
      ? `https://yandex.ru/maps/?mode=routes&rtext=~${branch.latitude},${branch.longitude}&rtt=auto`
      : `https://yandex.ru/maps/?text=${encodeURIComponent(destinationText)}`

  const role = session?.user?.role ?? ''
  const clientHidesLongTermDayDetails = role === 'CLIENT'
  const longTermEngineerIds = new Set(task.longTermEngineers.map((r) => r.engineerId))
  const coEngineerNamesForDisplay = (() => {
    if (task.longTermEngineers.length === 0) return null
    const seen = new Set<string>()
    const names: string[] = []
    for (const r of task.longTermEngineers) {
      if (!seen.has(r.engineerId)) {
        seen.add(r.engineerId)
        names.push(r.engineer.name)
      }
    }
    if (task.assignedToId && task.assignedTo && !seen.has(task.assignedToId)) {
      names.push(task.assignedTo.name)
    }
    return names.length > 0 ? names.join(', ') : null
  })()
  const longTermEngineerDisplayNames =
    task.taskType === 'LONG_TERM' ? coEngineerNamesForDisplay : null
  const quickEngineerDisplayNames = task.taskType !== 'LONG_TERM' ? coEngineerNamesForDisplay : null
  const showWorkDayLink =
    task.taskType === 'LONG_TERM' &&
    isNotDone &&
    role === 'ENGINEER' &&
    (task.assignedToId === session.user.id || longTermEngineerIds.has(session.user.id))
  const isQuickParticipant =
    task.assignedToId === session.user.id ||
    longTermEngineerIds.has(session.user.id)
  const chiefObserverOnly =
    role === 'CHIEF_ENGINEER' &&
    task.managedByChiefId === session.user.id &&
    task.assignedToId !== session.user.id
  const showExecuteLink =
    task.taskType !== 'LONG_TERM' &&
    canExecute &&
    isNotDone &&
    !chiefObserverOnly &&
    (role === 'ENGINEER' || role === 'CHIEF_ENGINEER' ? isQuickParticipant : true)
  const isDelegatedChild = Boolean(parseDelegationParentTaskId(task.comment))
  const canChiefSetWorkType =
    isNotDone &&
    !task.report &&
    (role === 'ADMIN' ||
      (!isDelegatedChild &&
        role === 'CHIEF_ENGINEER' &&
        (task.assignedToId === session.user.id ||
          (task.managedByChiefId !== null && task.managedByChiefId === session.user.id))))
  const sessionClientId = session?.user?.clientId ?? null
  const clientSignaturePending =
    task.status === 'DONE' && task.report && !task.report.clientSignature
  const canAddClientSignature =
    clientSignaturePending &&
    role === 'CLIENT' &&
    sessionClientId !== null &&
    sessionClientId === client.id

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <a
          href={session.user.role === 'CLIENT' ? '/my-company' : '/tasks'}
          className="text-gray-400 hover:text-gray-600"
        >
          ← {session.user.role === 'CLIENT' ? 'Моя компания' : 'Задачи'}
        </a>
        <span className="text-gray-300">/</span>
        <span className="font-medium">{typeLabels[task.type]}</span>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-start mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">№{task.requestNumber} · {typeLabels[task.type]}</h1>
            {task.taskType === 'LONG_TERM' && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900 border border-amber-200"
                title="Долгосрочная задача"
              >
                📅 Долгосрочная
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {eq.brand} {eq.model} · {client.name}
          </p>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap md:justify-end">
          {clientSignaturePending && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-900 border border-amber-200">
              Без подписи клиента
            </span>
          )}
          {isAdmin && (
            <TaskAdminActions
              taskId={task.id}
              canCancel={!['DONE', 'CANCELLED'].includes(task.status)}
              canDelete={!task.report}
            />
          )}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[task.status]}`}>
            {statusLabels[task.status]}
          </span>
          {showWorkDayLink && (
            <a
              href={`/tasks/${task.id}/daily`}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 flex items-center gap-2"
            >
              📅 Работа за день
            </a>
          )}
          {showExecuteLink && (
            <a
              href={`/tasks/${task.id}/execute`}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 flex items-center gap-2"
            >
              ▶ Приступить к работе
            </a>
          )}
          <a
            href={yandexRouteUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-600 flex items-center gap-2"
            title={
              branch.latitude !== null && branch.longitude !== null
                ? 'Построить маршрут до оборудования в Яндекс Картах'
                : 'Открыть адрес оборудования в Яндекс Картах'
            }
          >
            📍 Маршрут в Яндекс
          </a>
          {task.report && (
            <a href={`/api/tasks/${task.id}/pdf`} target="_blank"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2">
              📄 Печать акта
            </a>
          )}
          {task.status === 'DONE' && canEditDone && (
            <a
              href={`/tasks/${task.id}/edit`}
              className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              ✏️ Изменить данные
            </a>
          )}
        </div>
      </div>

      {clientSignaturePending && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Задача закрыта, акт сформирован, но <span className="font-medium">подпись клиента ещё не получена</span>. Её
          может поставить только представитель клиента (вход под учётной записью клиента).
        </div>
      )}

      {clientSignaturePending && role === 'CLIENT' && !sessionClientId && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Чтобы поставить подпись, аккаунт должен быть привязан к вашей организации в системе. Обратитесь к
          администратору.
        </div>
      )}

      {canAddClientSignature && (
        <div className="mb-6">
          <ClientSignaturePanel
            taskId={task.id}
            signerName={client.contactPerson?.trim() || client.name}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6">
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Оборудование</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><span className="text-gray-500 w-28">Бренд/Модель:</span>
              <a href={`/equipment/${eq.id}`} className="font-medium hover:text-blue-600">{eq.brand} {eq.model}</a>
            </div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Серийный №:</span><span>{eq.serialNumber}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Клиент:</span>
              {session.user.role === 'CLIENT' ? (
                <span>{client.name}</span>
              ) : (
                <a href={`/clients/${client.id}`} className="hover:text-blue-600">
                  {client.name}
                </a>
              )}
            </div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Объект:</span><span>{eq.object.name}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Адрес:</span><span>{branch.address || 'Не указан'}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Моточасы:</span><span>{eq.currentHours} м/ч</span></div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Детали задачи</h2>
          <div className="space-y-2 text-sm">
            <TaskChiefWorkTypePanel
              taskId={task.id}
              taskType={task.taskType === 'LONG_TERM' ? 'LONG_TERM' : 'QUICK'}
              canEdit={canChiefSetWorkType}
              hasDailyEntries={task.dailyWorks.length > 0}
              startDateIso={task.startDate ? task.startDate.toISOString() : null}
              endDateIso={task.endDate ? task.endDate.toISOString() : null}
              scheduledAtIso={task.scheduledAt ? task.scheduledAt.toISOString() : null}
              canEditLongTermPlanDates={canEditLongTermPlanDates}
              canEditScheduledAt={canEditScheduledAt}
              embedScheduleFields={canChiefSetWorkType}
            />
            <div className="flex gap-2"><span className="text-gray-500 w-28">Тип:</span><span>{typeLabels[task.type]}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Приоритет:</span>
              <span className={`font-medium ${task.priority === 'EMERGENCY' ? 'text-red-600' : task.priority === 'HIGH' ? 'text-orange-600' : 'text-gray-700'}`}>
                {task.priority === 'LOW' ? 'Низкий' : task.priority === 'MEDIUM' ? 'Средний' : task.priority === 'HIGH' ? 'Высокий' : 'Аварийный'}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-28 shrink-0">Инженер:</span>
              <span>
                {longTermEngineerDisplayNames ??
                  quickEngineerDisplayNames ??
                  task.assignedTo?.name ??
                  'Не назначен'}
              </span>
            </div>
            <div className="flex gap-2"><span className="text-gray-500 w-28">Создал:</span><span>{task.createdBy.name}</span></div>
            {!canChiefSetWorkType &&
              (task.taskType === 'LONG_TERM' ? (
                <div className="flex gap-2 items-start">
                  <span className="text-gray-500 w-28 shrink-0 pt-0.5">Период:</span>
                  <div className="flex-1 min-w-0">
                    <TaskLongTermDatesEditor
                      taskId={task.id}
                      startDateIso={task.startDate ? task.startDate.toISOString() : null}
                      endDateIso={task.endDate ? task.endDate.toISOString() : null}
                      canEdit={canEditLongTermPlanDates}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 items-baseline">
                  <span className="text-gray-500 w-28 shrink-0">Срок:</span>
                  <TaskScheduledAtEditor
                    taskId={task.id}
                    scheduledAtIso={task.scheduledAt ? task.scheduledAt.toISOString() : null}
                    canEdit={canEditScheduledAt}
                  />
                </div>
              ))}
            {task.completedAt && (
              <div className="flex gap-2"><span className="text-gray-500 w-28">Выполнено:</span>
                <span>{new Date(task.completedAt).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {task.comment && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-sm text-yellow-800 mb-1">Комментарий</h3>
          <p className="text-sm text-yellow-700">{task.comment}</p>
        </div>
      )}

      {showLongTermChiefPanel && (
        <TaskLongTermChiefPanel
          key={task.id}
          taskId={task.id}
          initialEngineerIds={
            task.longTermEngineers.length > 0
              ? task.longTermEngineers.map((r) => r.engineerId)
              : task.assignedToId
                ? [task.assignedToId]
                : []
          }
          initialAssignedEngineers={(() => {
            const rows = task.longTermEngineers.map((r) => ({ id: r.engineerId, name: r.engineer.name }))
            if (
              task.assignedToId &&
              task.assignedTo &&
              !rows.some((r) => r.id === task.assignedToId)
            ) {
              rows.push({ id: task.assignedTo.id, name: task.assignedTo.name })
            }
            return rows
          })()}
          equipmentCurrentHours={eq.currentHours}
          equipmentNextServiceHours={eq.nextServiceHours}
        />
      )}

      {task.taskType === 'LONG_TERM' && !clientHidesLongTermDayDetails && (
        <div className="bg-white border rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-gray-900">
            <span aria-hidden>📅</span>
            Журнал работ по дням
          </h2>
          {task.dailyWorks.length === 0 ? (
            <p className="text-sm text-gray-500">Записей пока нет</p>
          ) : (
            <ul className="space-y-4">
              {task.dailyWorks.map((dw) => {
                const items = Array.isArray(dw.checklist)
                  ? (dw.checklist as { label?: string; checked?: boolean }[])
                  : []
                const checkedItems = items.filter((c) => c.checked && typeof c.label === 'string')
                return (
                  <li key={dw.id} className="border-l-2 border-indigo-200 pl-4 ml-0.5">
                    <div className="text-xs font-semibold text-indigo-700">
                      {new Date(dw.date).toLocaleDateString('ru-RU', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-sm font-medium text-gray-900 mt-0.5">{dw.engineer.name}</div>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{dw.description}</p>
                    {checkedItems.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-600 list-disc pl-4 space-y-0.5">
                        {checkedItems.map((c, idx) => (
                          <li key={idx}>{c.label}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {showChiefDelegate && (
        <TaskDelegatePanel
          taskId={task.id}
          hasScheduledAt={Boolean(task.scheduledAt)}
        />
      )}

      {task.report ? (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">Отчёт о выполнении</h2>
              {task.report.actNumber && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Акт № {task.report.actNumber}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Моточасы</div>
                <div className="text-xl font-bold">{task.report.currentHours}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Следующее ТО</div>
                <div className="text-xl font-bold">{task.report.nextServiceHours || '—'}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Запчасти</div>
                <div className="text-xl font-bold">{task.report.partsUsed.length}</div>
              </div>
            </div>
            {task.report.notes && (
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">Комментарий инженера</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {clientHidesLongTermDayDetails && task.taskType === 'LONG_TERM'
                    ? longTermReportNotesForClient(task.report.notes)
                    : task.report.notes}
                </p>
              </div>
            )}
            {task.report.recommendations && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Рекомендации клиенту</div>
                <p className="text-sm text-gray-700">{task.report.recommendations}</p>
              </div>
            )}

            {task.report.attachments && task.report.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-3 font-medium">Фотографии к отчёту</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {task.report.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-gray-200 overflow-hidden bg-gray-50 hover:ring-2 hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                      title={att.caption || 'Открыть фото'}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={att.url}
                        alt={att.caption || 'Фото отчёта'}
                        className="w-full h-40 object-cover"
                      />
                      {att.caption && (
                        <div className="text-[10px] text-gray-500 px-2 py-1 truncate">{att.caption}</div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(task.report.engineerSignature || task.report.clientSignature) && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm font-medium text-gray-800 mb-3">Подписи акта</div>
                <div className="grid md:grid-cols-2 gap-4">
                  {task.report.engineerSignature && (
                    <div className="rounded-lg border bg-gray-50 p-3">
                      <div className="text-xs text-gray-500 mb-2 font-medium">Подпись инженера</div>
                      <div className="flex flex-wrap items-end gap-3 justify-between border border-gray-200 rounded-md bg-white/60 p-3 min-h-[6.5rem]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={task.report.engineerSignature}
                          alt=""
                          className="max-h-28 object-contain bg-white border border-gray-100 rounded shrink min-w-0"
                        />
                        {task.report.engineerSignedAt && (
                          <div className="shrink-0 text-center border border-green-300 bg-green-50 text-green-900 rounded px-3.5 py-2.5 text-[10px] leading-snug max-w-[220px] shadow-sm">
                            <div className="font-bold text-[11px] tracking-[0.06em] text-green-800">
                              ПОДПИСАНО
                            </div>
                            <div className="text-[9px] font-medium text-green-700 mt-1.5">
                              {new Date(task.report.engineerSignedAt).toLocaleString('ru-RU', {
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })}
                            </div>
                            <div className="text-[9px] text-green-950 mt-1.5 break-words">
                              {task.assignedTo?.name ?? '—'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {task.report.clientSignature && (
                    <div className="rounded-lg border bg-gray-50 p-3">
                      <div className="text-xs text-gray-500 mb-2 font-medium">Подпись клиента</div>
                      <div className="flex flex-wrap items-end gap-3 justify-between border border-gray-200 rounded-md bg-white/60 p-3 min-h-[6.5rem]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={task.report.clientSignature}
                          alt=""
                          className="max-h-28 object-contain bg-white border border-gray-100 rounded shrink min-w-0"
                        />
                        {task.report.clientSignedAt && (
                          <div className="shrink-0 text-center border border-blue-300 bg-blue-50 text-blue-900 rounded px-3.5 py-2.5 text-[10px] leading-snug max-w-[220px] shadow-sm">
                            <div className="font-bold text-[11px] tracking-[0.06em] text-blue-800">
                              ПОДПИСАНО
                            </div>
                            <div className="text-[9px] font-medium text-blue-700 mt-1.5">
                              {new Date(task.report.clientSignedAt).toLocaleString('ru-RU', {
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })}
                            </div>
                            <div className="text-[9px] text-blue-950 mt-1.5 break-words">
                              {client.contactPerson?.trim() || client.name}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {task.report.checklistItems.filter(i => i.checked).length > 0 && (
            <div className="bg-white border rounded-xl p-5">
              <h2 className="font-semibold mb-3">
                Выполненные работы ({task.report.checklistItems.filter(i => i.checked).length})
              </h2>
              <div className="space-y-1">
                {task.report.checklistItems
                  .filter(item => item.checked)
                  .map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm py-1 flex-wrap">
                    <span className="text-green-500">✓</span>
                    <span className="text-gray-700">
                      {clientHidesLongTermDayDetails && task.taskType === 'LONG_TERM'
                        ? longTermChecklistLabelForClient(item.label)
                        : item.label}
                    </span>
                    {item.performedAction && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-100">
                        {checklistActionLabelRu(item.performedAction)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.report.partsUsed.length > 0 && (
            <div className="bg-white border rounded-xl p-4 md:p-5">
              <h2 className="font-semibold mb-3">Использованные запчасти</h2>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-2 font-medium">Наименование</th>
                    <th className="text-left p-2 font-medium">Артикул</th>
                    <th className="text-center p-2 font-medium">Кол-во</th>
                    <th className="text-left p-2 font-medium">Ед.</th>
                  </tr>
                </thead>
                <tbody>
                  {task.report.partsUsed.map(part => (
                    <tr key={part.id} className="border-b last:border-0">
                      <td className="p-2">{part.name}</td>
                      <td className="p-2 text-gray-500">{part.article || '—'}</td>
                      <td className="p-2 text-center font-medium">{part.quantity}</td>
                      <td className="p-2 text-gray-500">{part.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <a href={`/api/tasks/${task.id}/pdf`} target="_blank"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2">
              📄 Открыть PDF акт
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm">Отчёт ещё не заполнен</p>
          <p className="text-xs mt-1">
            Инженер заполнит отчёт в браузере (кнопка «Приступить к работе») или в мобильном приложении
          </p>
        </div>
      )}
    </div>
  )
}
