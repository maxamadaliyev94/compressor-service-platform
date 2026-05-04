import { db } from '@/lib/db'
import { getSession } from '@/lib/roles'
import { getMaintenanceStatus, getWarrantyStatus } from '@csp/shared'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import EngineerShiftToggle from './EngineerShiftToggle'
import { prismaWhereManagerEquipment, prismaWhereManagerTasks } from '@/lib/api-access'
import { formatTaskScheduleRangeRu, isTaskEndDateOverdue } from '@/lib/task-schedule-display'

export default async function DashboardPage() {
  const session = await getSession()
  const role = session.user.role
  const userId = session.user.id

  if (role === 'CLIENT') {
    redirect('/my-company')
  }

  if (role === 'ENGINEER') {
    const myTasks = await db.serviceTask.findMany({
      where: {
        assignedToId: userId,
        deletedAt: null,
        status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] },
      },
      include: {
        equipment: { include: { object: { include: { branch: { include: { client: true } } } } } },
      },
      orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
    })

    const priorityColors: Record<string, string> = {
      EMERGENCY: 'border-l-4 border-red-500 bg-red-50',
      HIGH: 'border-l-4 border-orange-400 bg-orange-50',
      MEDIUM: 'border-l-4 border-blue-400 bg-white',
      LOW: 'border-l-4 border-gray-300 bg-white',
    }
    const priorityLabels: Record<string, string> = {
      EMERGENCY: '🔴 Аварийный',
      HIGH: '🟠 Высокий',
      MEDIUM: '🔵 Средний',
      LOW: '⚪ Низкий',
    }
    const typeLabels: Record<string, string> = {
      PLANNED_MAINTENANCE: 'Плановое ТО',
      DIAGNOSTICS: 'Диагностика',
      WARRANTY_REPAIR: 'Гарантийный ремонт',
      EMERGENCY: 'Аварийный выезд',
      INSTALLATION: 'Монтаж',
      COMMISSIONING: 'Пусконаладка',
    }

    return (
      <main className="p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold">Мои задачи</h1>
          <p className="text-gray-500 text-sm mt-1">
            Добро пожаловать, {session.user.name ?? 'инженер'} · {myTasks.length} активных задач
          </p>
        </div>
        <EngineerShiftToggle />

        {myTasks.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Нет активных задач</h2>
            <p className="text-gray-400 text-sm">Все задачи выполнены или задачи ещё не назначены</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myTasks.map((task) => {
              const eq = task.equipment
              const client = eq.object.branch.client
              return (
                <div
                  key={task.id}
                  className={`relative rounded-xl p-5 hover:shadow-md transition-shadow ${priorityColors[task.priority]}`}
                >
                  <Link
                    href={`/tasks/${task.id}`}
                    className="absolute inset-0 z-0 rounded-xl"
                    aria-label="Открыть задачу"
                  />
                  <div className="relative z-[1] flex flex-col md:flex-row justify-between items-start gap-4 pointer-events-none">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-500">
                          {priorityLabels[task.priority]}
                        </span>
                        <span className="font-semibold text-gray-900">{typeLabels[task.type]}</span>
                      </div>
                      <div className="text-lg font-bold text-gray-900 mb-1">
                        {eq.brand} {eq.model}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">🏭 {client.name}</div>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>
                          📍 {eq.object.name}, {eq.object.branch.name}
                        </span>
                        {eq.object.branch.address && <span>{eq.object.branch.address}</span>}
                        {client.phone && (
                          <a
                            href={`tel:${client.phone}`}
                            className="pointer-events-auto text-blue-600 hover:underline relative z-10"
                          >
                            📞 {client.phone}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-gray-500">
                          Моточасы: <strong>{eq.currentHours} м/ч</strong>
                        </span>
                        {eq.nextServiceHours != null && (
                          <span
                            className={`font-medium ${
                              eq.nextServiceHours - eq.currentHours < 0
                                ? 'text-red-600'
                                : 'text-green-600'
                            }`}
                          >
                            До ТО: {eq.nextServiceHours - eq.currentHours} м/ч
                          </span>
                        )}
                      </div>
                      {task.comment && (
                        <div className="mt-2 text-xs text-gray-500 italic bg-white/60 rounded px-2 py-1">
                          &ldquo;{task.comment}&rdquo;
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {formatTaskScheduleRangeRu(task) !== '—' && (
                        <div
                          className={`text-sm font-medium mb-2 ${
                            isTaskEndDateOverdue(task) ? 'text-red-600' : 'text-gray-700'
                          }`}
                        >
                          📅 {formatTaskScheduleRangeRu(task)}
                        </div>
                      )}
                      <div className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-medium">
                        ▶ Приступить
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    )
  }

  const roleGreetings: Record<string, string> = {
    ADMIN: 'Панель администратора',
    MANAGER: 'Панель менеджера',
    CHIEF_ENGINEER: 'Панель главного инженера',
    ENGINEER: 'Мои задачи',
    CLIENT: 'Мои объекты',
  }

  const allEquipment = await db.equipment.findMany({
    where: {
      status: { not: 'DECOMMISSIONED' },
      ...(role === 'MANAGER'
        ? prismaWhereManagerEquipment(userId)
        : {
            object: {
              branch: {
                client: { status: { not: 'PASSIVE' } },
              },
            },
          }),
    },
  })

  const stats = allEquipment.reduce(
    (acc, eq) => {
      if (eq.nextServiceHours) {
        const status = getMaintenanceStatus(eq.currentHours, eq.nextServiceHours)
        if (status === 'OVERDUE') acc.overdue++
        if (status === 'WARNING' || status === 'URGENT') acc.warning++
      }
      if (eq.warrantyUntil) {
        const ws = getWarrantyStatus(eq.warrantyUntil, eq.warrantyVoided)
        if (ws === 'EXPIRING') acc.warrantyExpiring++
      }
      return acc
    },
    { overdue: 0, warning: 0, warrantyExpiring: 0 }
  )

  const activeTasks = await db.serviceTask.count({
    where: {
      status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] },
      deletedAt: null,
      ...(role === 'MANAGER' ? prismaWhereManagerTasks(userId) : {}),
    },
  })

  const allTasks = await db.serviceTask.findMany({
    where: {
      deletedAt: null,
      ...(role === 'MANAGER' ? prismaWhereManagerTasks(userId) : {}),
    },
    include: {
      assignedTo: true,
      equipment: { include: { object: { include: { branch: { include: { client: true } } } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const engineerStats = allTasks.reduce(
    (acc: Record<string, { name: string; total: number; done: number }>, task) => {
      if (!task.assignedTo) return acc
      const name = task.assignedTo.name
      if (!acc[name]) acc[name] = { name, total: 0, done: 0 }
      acc[name].total++
      if (task.status === 'DONE') acc[name].done++
      return acc
    },
    {}
  )
  const topEngineers = Object.values(engineerStats)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      label: d.toLocaleString('ru-RU', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    }
  })
  const tasksByMonth = months.map((m) => ({
    label: m.label,
    count: allTasks.filter((t) => {
      const d = new Date(t.createdAt)
      return d.getFullYear() === m.year && d.getMonth() === m.month
    }).length,
    done: allTasks.filter((t) => {
      const d = new Date(t.createdAt)
      return (
        d.getFullYear() === m.year && d.getMonth() === m.month && t.status === 'DONE'
      )
    }).length,
  }))

  const maxCount = Math.max(...tasksByMonth.map((m) => m.count), 1)
  const recentTasks = await db.serviceTask.findMany({
    where: {
      deletedAt: null,
      ...(role === 'MANAGER' ? prismaWhereManagerTasks(userId) : {}),
    },
    include: {
      equipment: { include: { object: { include: { branch: { include: { client: true } } } } } },
      assignedTo: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  const statusColors: Record<string, string> = {
    NEW: 'bg-gray-100 text-gray-700',
    ASSIGNED: 'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
    DONE: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    REVIEW: 'bg-purple-100 text-purple-700',
    DRAFT: 'bg-gray-100 text-gray-500',
    REVISION: 'bg-orange-100 text-orange-700',
  }
  const statusLabels: Record<string, string> = {
    NEW: 'Новая',
    ASSIGNED: 'Назначена',
    IN_PROGRESS: 'В работе',
    DONE: 'Выполнено',
    CANCELLED: 'Отменена',
    REVIEW: 'На проверке',
    DRAFT: 'Черновик',
    REVISION: 'Доработка',
  }

  return (
    <main className="p-4 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm">
            {roleGreetings[session.user.role] || 'Compressor Service Platform'}
            {' · '}
            {session.user.name}
          </p>
        </div>
        <p className="text-sm text-gray-400">
          {new Date().toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>
      {role === 'CHIEF_ENGINEER' && <EngineerShiftToggle />}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 mb-1">Просрочено ТО</p>
          <p className="text-3xl font-bold text-red-700">{stats.overdue}</p>
          <p className="text-xs text-red-400 mt-1">требует срочного выезда</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-600 mb-1">Скоро ТО</p>
          <p className="text-3xl font-bold text-yellow-700">{stats.warning}</p>
          <p className="text-xs text-yellow-400 mt-1">менее 300 м/ч</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm text-orange-600 mb-1">Гарантии истекают</p>
          <p className="text-3xl font-bold text-orange-700">{stats.warrantyExpiring}</p>
          <p className="text-xs text-orange-400 mt-1">менее 30 дней</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-600 mb-1">Активные задачи</p>
          <p className="text-3xl font-bold text-blue-700">{activeTasks}</p>
          <p className="text-xs text-blue-400 mt-1">в работе сейчас</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 mb-6">
        <div className="xl:col-span-2 bg-white border rounded-xl p-4 md:p-5">
          <h2 className="font-semibold mb-4">Задачи по месяцам</h2>
          <div className="flex items-end gap-3 h-40">
            {tasksByMonth.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{m.count}</span>
                <div
                  className="w-full flex flex-col gap-0.5"
                  style={{ height: '120px', justifyContent: 'flex-end' }}
                >
                  <div
                    className="w-full bg-blue-200 rounded-t"
                    style={{
                      height: `${(m.count / maxCount) * 100}%`,
                      minHeight: m.count > 0 ? '4px' : '0',
                    }}
                  />
                </div>
                <span className="text-xs text-gray-400">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-200 rounded" />
              <span className="text-xs text-gray-500">Создано</span>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 md:p-5">
          <h2 className="font-semibold mb-4">Топ инженеров</h2>
          <div className="space-y-3">
            {topEngineers.length === 0 && <p className="text-sm text-gray-400">Нет данных</p>}
            {(topEngineers as { name: string; total: number; done: number }[]).map((eng, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{eng.name}</div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{
                        width: `${(eng.total / (topEngineers[0] as { total: number }).total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold">{eng.total}</div>
                  <div className="text-xs text-green-600">{eng.done} ✓</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="font-semibold">Последние задачи</h2>
            <a href="/tasks" className="text-xs text-blue-600 hover:underline">
              Все задачи →
            </a>
          </div>
          <div className="divide-y">
            {recentTasks.map((task) => (
              <div key={task.id} className="p-3 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {task.equipment?.brand} {task.equipment?.model}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {task.equipment?.object?.branch?.client?.name}
                    </div>
                  </div>
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusColors[task.status]}`}
                  >
                    {statusLabels[task.status]}
                  </span>
                </div>
                {task.assignedTo && (
                  <div className="text-xs text-gray-400 mt-1">👤 {task.assignedTo.name}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="font-semibold">Требует внимания</h2>
            <a href="/equipment" className="text-xs text-blue-600 hover:underline">
              Всё оборудование →
            </a>
          </div>
          <div className="divide-y">
            {allEquipment
              .filter(
                (eq) =>
                  eq.nextServiceHours &&
                  getMaintenanceStatus(eq.currentHours, eq.nextServiceHours) !== 'NORMAL'
              )
              .slice(0, 5)
              .map((eq) => {
                const ms = getMaintenanceStatus(eq.currentHours, eq.nextServiceHours!)
                const diff = eq.nextServiceHours! - eq.currentHours
                return (
                  <div key={eq.id} className="p-3 hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">
                          {eq.brand} {eq.model}
                        </div>
                        <div className="text-xs text-gray-500">{eq.serialNumber}</div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-xs font-bold ${
                            ms === 'OVERDUE'
                              ? 'text-red-600'
                              : ms === 'URGENT'
                                ? 'text-orange-600'
                                : 'text-yellow-600'
                          }`}
                        >
                          {diff < 0 ? `+${Math.abs(diff)} м/ч просрочено` : `${diff} м/ч осталось`}
                        </div>
                        <div
                          className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${
                            ms === 'OVERDUE'
                              ? 'bg-red-100 text-red-700'
                              : ms === 'URGENT'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {ms === 'OVERDUE'
                            ? 'Просрочено'
                            : ms === 'URGENT'
                              ? 'Срочно'
                              : 'Скоро ТО'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            {allEquipment.filter(
              (eq) =>
                eq.nextServiceHours &&
                getMaintenanceStatus(eq.currentHours, eq.nextServiceHours) !== 'NORMAL'
            ).length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">Всё оборудование в норме ✓</div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
