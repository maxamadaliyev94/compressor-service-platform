import { db } from '@/lib/db'
import { getMaintenanceStatus, getWarrantyStatus } from '@csp/shared'
import { requirePermission } from '@/lib/permissions'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prismaWhereManagerEquipment, prismaWhereManagerTasks } from '@/lib/api-access'

export default async function ReportsPage() {
  await requirePermission('section:reports')
  const session = await auth()
  if (!session) redirect('/login')

  const isManager = session.user.role === 'MANAGER'
  const managerId = session.user.id

  const equipmentWhere = isManager ? prismaWhereManagerEquipment(managerId) : undefined
  const taskWhereBase = { deletedAt: null as const, ...(isManager ? prismaWhereManagerTasks(managerId) : {}) }

  const [
    totalEquipment,
    totalClients,
    totalTasks,
    doneTasks,
    allEquipment,
    allTasks,
    engineers,
  ] = await Promise.all([
    db.equipment.count({ where: equipmentWhere }),
    db.client.count({
      where: isManager
        ? { status: { not: 'PASSIVE' }, managerId }
        : { status: { not: 'PASSIVE' } },
    }),
    db.serviceTask.count({ where: taskWhereBase }),
    db.serviceTask.count({ where: { ...taskWhereBase, status: 'DONE' } }),
    db.equipment.findMany({
      where: equipmentWhere,
      include: { object: { include: { branch: { include: { client: true } } } } },
    }),
    db.serviceTask.findMany({
      where: taskWhereBase,
      include: { assignedTo: true, equipment: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.user.findMany({
      where: {
        role: { in: ['ENGINEER', 'CHIEF_ENGINEER'] },
        isActive: true,
        ...(isManager
          ? {
              assignedTasks: {
                some: {
                  deletedAt: null,
                  ...prismaWhereManagerTasks(managerId),
                },
              },
            }
          : {}),
      },
      select: { id: true, name: true },
    }),
  ])

  // Статусы ТО
  const maintenanceStats = allEquipment.reduce(
    (acc, eq) => {
      if (eq.nextServiceHours) {
        const s = getMaintenanceStatus(eq.currentHours, eq.nextServiceHours)
        acc[s] = (acc[s] || 0) + 1
      }
      return acc
    },
    {} as Record<string, number>
  )

  // Гарантии
  const warrantyStats = allEquipment.reduce(
    (acc, eq) => {
      const s = getWarrantyStatus(
        eq.warrantyUntil ? new Date(eq.warrantyUntil) : null,
        eq.warrantyVoided
      )
      acc[s] = (acc[s] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Просроченное оборудование
  const overdueEquipment = allEquipment.filter(
    (eq) =>
      eq.nextServiceHours != null &&
      getMaintenanceStatus(eq.currentHours, eq.nextServiceHours) === 'OVERDUE'
  )

  // Срочное ТО
  const urgentEquipment = allEquipment.filter(
    (eq) =>
      eq.nextServiceHours != null &&
      getMaintenanceStatus(eq.currentHours, eq.nextServiceHours) === 'URGENT'
  )

  // Гарантии истекают
  const expiringWarranty = allEquipment.filter((eq) => {
    const ws = getWarrantyStatus(
      eq.warrantyUntil ? new Date(eq.warrantyUntil) : null,
      eq.warrantyVoided
    )
    return ws === 'EXPIRING'
  })

  // Оборудование без ТО
  const noServiceEquipment = allEquipment.filter((eq) => !eq.lastServiceDate)

  // Статистика инженеров
  const engineerStats = engineers
    .map((eng) => {
      const engTasks = allTasks.filter((t) => t.assignedToId === eng.id)
      const doneEngTasks = engTasks.filter((t) => t.status === 'DONE')
      return {
        ...eng,
        total: engTasks.length,
        done: doneEngTasks.length,
        active: engTasks.filter((t) =>
          ['NEW', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status)
        ).length,
      }
    })
    .sort((a, b) => b.done - a.done)

  // Задачи по месяцам (последние 6)
  const now = new Date()
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const nextD = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1)
    const monthTasks = allTasks.filter((t) => {
      const td = new Date(t.createdAt)
      return td >= d && td < nextD
    })
    return {
      label: d.toLocaleString('ru-RU', { month: 'short' }),
      total: monthTasks.length,
      done: monthTasks.filter((t) => t.status === 'DONE').length,
    }
  })
  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1)

  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const watchlist = [...overdueEquipment, ...urgentEquipment]
  const maxEngTotal = engineerStats[0]?.total ?? 1

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Отчёты и аналитика</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isManager ? 'Показатели только по вашим закреплённым клиентам' : 'Общая картина по всей системе'}
          </p>
        </div>
      </div>

      {/* Главные KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Всего оборудования</p>
          <p className="text-3xl font-bold">{totalEquipment}</p>
          <p className="text-xs text-gray-400 mt-1">единиц</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Активных клиентов</p>
          <p className="text-3xl font-bold">{totalClients}</p>
          <p className="text-xs text-gray-400 mt-1">компаний</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Выполнено задач</p>
          <p className="text-3xl font-bold text-green-600">{doneTasks}</p>
          <p className="text-xs text-gray-400 mt-1">из {totalTasks} всего</p>
        </div>
        <div
          className={`border rounded-xl p-4 ${completionRate >= 70 ? 'bg-green-50' : completionRate >= 40 ? 'bg-yellow-50' : 'bg-red-50'}`}
        >
          <p className="text-xs text-gray-500 mb-1">Процент выполнения</p>
          <p
            className={`text-3xl font-bold ${completionRate >= 70 ? 'text-green-600' : completionRate >= 40 ? 'text-yellow-600' : 'text-red-600'}`}
          >
            {completionRate}%
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div
              className={`h-1.5 rounded-full ${completionRate >= 70 ? 'bg-green-500' : completionRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 mb-6">
        {/* Статус ТО */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Статус ТО</h2>
          <div className="space-y-3">
            {[
              {
                key: 'OVERDUE',
                label: 'Просрочено',
                color: 'bg-red-500',
                textColor: 'text-red-700',
                bg: 'bg-red-50',
              },
              {
                key: 'URGENT',
                label: 'Срочно (<100 м/ч)',
                color: 'bg-orange-400',
                textColor: 'text-orange-700',
                bg: 'bg-orange-50',
              },
              {
                key: 'WARNING',
                label: 'Скоро (<300 м/ч)',
                color: 'bg-yellow-400',
                textColor: 'text-yellow-700',
                bg: 'bg-yellow-50',
              },
              {
                key: 'NORMAL',
                label: 'Норма',
                color: 'bg-green-400',
                textColor: 'text-green-700',
                bg: 'bg-green-50',
              },
            ].map((item) => (
              <div
                key={item.key}
                className={`flex items-center justify-between p-2.5 rounded-lg ${item.bg}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className={`text-lg font-bold ${item.textColor}`}>
                  {maintenanceStats[item.key] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Статус гарантий */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Гарантии</h2>
          <div className="space-y-3">
            {[
              {
                key: 'ACTIVE',
                label: 'На гарантии',
                color: 'bg-green-400',
                textColor: 'text-green-700',
                bg: 'bg-green-50',
              },
              {
                key: 'EXPIRING',
                label: 'Истекает (≤30 дн)',
                color: 'bg-orange-400',
                textColor: 'text-orange-700',
                bg: 'bg-orange-50',
              },
              {
                key: 'EXPIRED',
                label: 'Истекла',
                color: 'bg-gray-400',
                textColor: 'text-gray-700',
                bg: 'bg-gray-50',
              },
              {
                key: 'VOIDED',
                label: 'Аннулирована',
                color: 'bg-red-400',
                textColor: 'text-red-700',
                bg: 'bg-red-50',
              },
            ].map((item) => (
              <div
                key={item.key}
                className={`flex items-center justify-between p-2.5 rounded-lg ${item.bg}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm">{item.label}</span>
                </div>
                <span className={`text-lg font-bold ${item.textColor}`}>
                  {warrantyStats[item.key] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Топ инженеров */}
        <div className="bg-white border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Инженеры</h2>
          <div className="space-y-3">
            {engineerStats.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Нет данных</p>
            )}
            {engineerStats.map((eng, i) => (
              <a
                key={eng.id}
                href={`/reports/engineers/${eng.id}`}
                className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-blue-50 transition-colors"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : i === 1
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{eng.name}</div>
                  <div className="flex gap-2 text-xs text-gray-400">
                    <span className="text-green-600">{eng.done} выполнено</span>
                    <span>·</span>
                    <span className="text-blue-600">{eng.active} активных</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full"
                      style={{
                        width: maxEngTotal ? `${(eng.total / maxEngTotal) * 100}%` : '0%',
                      }}
                    />
                  </div>
                </div>
                <div className="text-sm font-bold text-gray-700">{eng.total}</div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* График задач по месяцам */}
      <div className="bg-white border rounded-xl p-4 md:p-5 mb-6">
        <h2 className="font-semibold mb-4">Задачи по месяцам</h2>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-3 h-32 min-w-[520px]">
          {monthlyData.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500">{m.total}</span>
              <div
                className="w-full flex flex-col gap-0.5"
                style={{ height: '100px', justifyContent: 'flex-end' }}
              >
                <div
                  className="w-full bg-green-400 rounded-sm"
                  style={{
                    height: m.total > 0 ? `${(m.done / maxMonthly) * 100}%` : '0',
                    minHeight: m.done > 0 ? '3px' : '0',
                  }}
                />
                <div
                  className="w-full bg-blue-200 rounded-sm"
                  style={{
                    height:
                      m.total > 0 ? `${((m.total - m.done) / maxMonthly) * 100}%` : '0',
                    minHeight: m.total - m.done > 0 ? '3px' : '0',
                  }}
                />
              </div>
              <span className="text-xs text-gray-400">{m.label}</span>
            </div>
          ))}
          </div>
        </div>
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-400 rounded-sm" />
            <span className="text-xs text-gray-500">Выполнено</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-200 rounded-sm" />
            <span className="text-xs text-gray-500">В работе / Новые</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {/* Требует внимания */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-red-50 flex justify-between">
            <h2 className="font-semibold text-red-800">
              ⚠️ Требует внимания ({overdueEquipment.length + urgentEquipment.length})
            </h2>
          </div>
          <div className="divide-y max-h-72 overflow-y-auto">
            {watchlist.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">Всё в норме ✓</div>
            )}
            {watchlist.map((eq) => {
              const ms = getMaintenanceStatus(eq.currentHours, eq.nextServiceHours!)
              const diff = eq.nextServiceHours! - eq.currentHours
              return (
                <a
                  key={eq.id}
                  href={`/equipment/${eq.id}`}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {eq.brand} {eq.model}
                    </div>
                    <div className="text-xs text-gray-500">{eq.object.branch.client.name}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-xs font-bold ${diff < 0 ? 'text-red-600' : 'text-orange-600'}`}
                    >
                      {diff < 0 ? `+${Math.abs(diff)} просрочено` : `${diff} м/ч осталось`}
                    </div>
                    <div
                      className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${ms === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}
                    >
                      {ms === 'OVERDUE' ? 'Просрочено' : 'Срочно'}
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        {/* Гарантии истекают + без ТО */}
        <div className="space-y-4">
          {expiringWarranty.length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="p-4 border-b bg-orange-50">
                <h2 className="font-semibold text-orange-800">
                  🛡️ Гарантии истекают ({expiringWarranty.length})
                </h2>
              </div>
              <div className="divide-y max-h-40 overflow-y-auto">
                {expiringWarranty.map((eq) => (
                  <a
                    key={eq.id}
                    href={`/equipment/${eq.id}`}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {eq.brand} {eq.model}
                      </div>
                      <div className="text-xs text-gray-500">{eq.object.branch.client.name}</div>
                    </div>
                    <div className="text-xs text-orange-600 font-medium">
                      до {new Date(eq.warrantyUntil!).toLocaleDateString('ru-RU')}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {noServiceEquipment.length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h2 className="font-semibold text-gray-700">
                  📋 Без истории ТО ({noServiceEquipment.length})
                </h2>
              </div>
              <div className="divide-y max-h-40 overflow-y-auto">
                {noServiceEquipment.map((eq) => (
                  <a
                    key={eq.id}
                    href={`/equipment/${eq.id}`}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {eq.brand} {eq.model}
                      </div>
                      <div className="text-xs text-gray-500">{eq.object.branch.client.name}</div>
                    </div>
                    <span className="text-xs text-gray-400">Нет ТО</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
