import { auth } from '@/auth'
import { db } from '@/lib/db'
import { prismaWhereManagerTasks } from '@/lib/api-access'
import { requirePermission } from '@/lib/permissions'
import { redirect, notFound } from 'next/navigation'

function parseIsoDate(s: string | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0))
  return Number.isNaN(dt.getTime()) ? null : dt
}

function monthStartIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function EngineerReportPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { dateFrom?: string; dateTo?: string }
}) {
  await requirePermission('section:reports')
  const session = await auth()
  if (!session) redirect('/login')

  const isManager = session.user.role === 'MANAGER'
  const managerId = session.user.id

  const dateFrom = searchParams.dateFrom?.trim() || monthStartIso()
  const dateTo = searchParams.dateTo?.trim() || todayIso()
  const from = parseIsoDate(dateFrom)
  const to = parseIsoDate(dateTo)
  if (!from || !to || from.getTime() > to.getTime()) {
    redirect(`/reports/engineers/${params.id}?dateFrom=${monthStartIso()}&dateTo=${todayIso()}`)
  }
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 23, 59, 59, 999))

  const engineer = await db.user.findFirst({
    where: {
      id: params.id,
      role: { in: ['ENGINEER', 'CHIEF_ENGINEER'] },
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
    select: { id: true, name: true, role: true },
  })
  if (!engineer) notFound()

  const completionDateWhere = {
    OR: [
      { completedAt: { gte: start, lte: end } },
      {
        AND: [
          { completedAt: null },
          {
            OR: [
              { report: { finishedAt: { gte: start, lte: end } } },
              {
                AND: [{ report: { finishedAt: null } }, { report: { createdAt: { gte: start, lte: end } } }],
              },
            ],
          },
        ],
      },
    ],
  }

  const engineerParticipationWhere = {
    OR: [
      { assignedToId: engineer.id },
      { longTermEngineers: { some: { engineerId: engineer.id } } },
      { report: { engineerId: engineer.id } },
    ],
  }

  const tasksRaw = await db.serviceTask.findMany({
    where: {
      deletedAt: null,
      status: 'DONE',
      ...(isManager ? prismaWhereManagerTasks(managerId) : {}),
      AND: [completionDateWhere, engineerParticipationWhere],
    },
    select: {
      id: true,
      requestNumber: true,
      type: true,
      createdAt: true,
      completedAt: true,
      report: {
        select: { finishedAt: true, createdAt: true },
      },
      equipment: {
        select: {
          id: true,
          brand: true,
          model: true,
          serialNumber: true,
          object: { select: { branch: { select: { client: { select: { name: true } } } } } },
        },
      },
    },
  })

  const tasks = [...tasksRaw].sort((a, b) => {
    const ta = (a.completedAt ?? a.report?.finishedAt ?? a.report?.createdAt)?.getTime() ?? 0
    const tb = (b.completedAt ?? b.report?.finishedAt ?? b.report?.createdAt)?.getTime() ?? 0
    return tb - ta
  })

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex items-center gap-3">
        <a href="/reports" className="text-gray-400 hover:text-gray-600">
          ← Отчёты
        </a>
        <h1 className="text-2xl font-bold">{engineer.name}</h1>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <form method="GET" className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            <span>От</span>
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
              className="min-h-11 border rounded-lg px-3 py-2 text-sm bg-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            <span>До</span>
            <input
              type="date"
              name="dateTo"
              defaultValue={dateTo}
              className="min-h-11 border rounded-lg px-3 py-2 text-sm bg-white"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700"
          >
            Применить
          </button>
        </form>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="p-4 border-b bg-gray-50 text-sm text-gray-600">
          Выполнено задач за период: <span className="font-semibold text-gray-900">{tasks.length}</span>
        </div>
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">За выбранный период выполненных задач нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium">Дата выполнения</th>
                  <th className="text-left p-3 font-medium">№ заявки</th>
                  <th className="text-left p-3 font-medium">Тип задачи</th>
                  <th className="text-left p-3 font-medium">Оборудование</th>
                  <th className="text-left p-3 font-medium">Клиент</th>
                  <th className="text-left p-3 font-medium">Действие</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-b last:border-0">
                    <td className="p-3">
                      {task.completedAt ? new Date(task.completedAt).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    <td className="p-3">{task.requestNumber}</td>
                    <td className="p-3">{task.type}</td>
                    <td className="p-3">
                      {task.equipment.brand} {task.equipment.model} ({task.equipment.serialNumber})
                    </td>
                    <td className="p-3">{task.equipment.object.branch.client.name}</td>
                    <td className="p-3">
                      <a href={`/tasks/${task.id}`} className="text-blue-600 hover:underline">
                        Открыть
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
