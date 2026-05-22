import { db } from '@/lib/db'
import { getSession } from '@/lib/roles'
import { hasPermission, requirePermission } from '@/lib/permissions'
import type { Role, TaskStatus } from '@prisma/client'
import { unstable_noStore as noStore } from 'next/cache'
import TasksTable from './TasksTable'
import {
  prismaWhereClientPortalTaskList,
  prismaWhereEngineerTaskAssignment,
  prismaWhereManagerTasks,
} from '@/lib/api-access'
import { sanitizeTasksForClientPortal } from '@/lib/client-portal-tasks'

export const dynamic = 'force-dynamic'

function readCompletedTab(completed: string | string[] | undefined): boolean {
  const v = Array.isArray(completed) ? completed[0] : completed
  return v === '1' || v === 'true'
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: { completed?: string | string[] }
}) {
  noStore()
  await requirePermission('section:tasks')
  const session = await getSession()
  const role = session.user.role
  const isAdmin = role === 'ADMIN'
  const canCancelTask = isAdmin || role === 'MANAGER'
  const canCreateTask = role !== 'ENGINEER' && (await hasPermission(role as Role, 'action:task.create'))

  /** Для персонала по умолчанию — только активные (без выполненных и отменённых). Вкладка ?completed=1 — только DONE. Клиенту — все задачи организации, кроме отменённых. */
  const closedStatuses: TaskStatus[] = ['DONE', 'CANCELLED']
  const activeOnlyWhere = { status: { notIn: closedStatuses } }
  const showCompletedTab = role !== 'CLIENT' && readCompletedTab(searchParams?.completed)
  const staffStatusWhere = showCompletedTab ? { status: 'DONE' as const } : activeOnlyWhere

  let tasks = await db.serviceTask.findMany({
    where:
      role === 'ENGINEER'
        ? { deletedAt: null, ...staffStatusWhere, ...prismaWhereEngineerTaskAssignment(session.user.id) }
        : role === 'MANAGER'
          ? { deletedAt: null, ...prismaWhereManagerTasks(session.user.id), ...staffStatusWhere }
          : role === 'CLIENT'
            ? prismaWhereClientPortalTaskList(session.user.clientId)
            : { deletedAt: null, ...staffStatusWhere },
    include: {
      equipment: { include: { object: { include: { branch: { include: { client: true } } } } } },
      assignedTo: true,
      createdBy: true,
      report: { select: { id: true, clientSignature: true } },
      longTermEngineers: { include: { engineer: { select: { id: true, name: true } } } },
    },
    orderBy: showCompletedTab ? [{ completedAt: 'desc' }, { updatedAt: 'desc' }] : { createdAt: 'desc' },
  })

  if (role === 'CLIENT') {
    tasks = await sanitizeTasksForClientPortal(tasks)
  }

  const { fetchWorkTypeLabelMap } = await import('@/lib/work-types')
  const typeLabels = await fetchWorkTypeLabelMap()
  const statusColors: Record<string, string> = {
    NEW: 'bg-gray-100 text-gray-800',
    ASSIGNED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    DONE: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    REVIEW: 'bg-purple-100 text-purple-800',
    DRAFT: 'bg-gray-100 text-gray-600',
    REVISION: 'bg-orange-100 text-orange-800',
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
  const priorityColors: Record<string, string> = {
    LOW: 'text-gray-500',
    MEDIUM: 'text-blue-500',
    HIGH: 'text-orange-500',
    EMERGENCY: 'text-red-600',
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center mb-6">
        <div className="space-y-3">
          <h1 className="text-xl md:text-2xl font-bold">Задачи</h1>
          {role !== 'CLIENT' && (
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-sm">
              <a
                href="/tasks"
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  !showCompletedTab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Активные
              </a>
              <a
                href="/tasks?completed=1"
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                  showCompletedTab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Выполненные
              </a>
            </div>
          )}
        </div>
        <div className="flex flex-col w-full md:w-auto md:flex-row gap-2 md:gap-3">
          {isAdmin && (
            <a href="/tasks/trash" className="w-full md:w-auto min-h-11 border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 inline-flex items-center justify-center">
              Корзина
            </a>
          )}
          <a href="/tasks/kanban" className="w-full md:w-auto min-h-11 border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 inline-flex items-center justify-center">
            Канбан
          </a>
          {canCreateTask && (
            <a href="/tasks/new" className="w-full md:w-auto min-h-11 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 inline-flex items-center justify-center">
              + Создать задачу
            </a>
          )}
        </div>
      </div>
      <div className="bg-white border rounded-lg overflow-x-auto">
        <TasksTable
          tasks={tasks}
          typeLabels={typeLabels}
          statusColors={statusColors}
          statusLabels={statusLabels}
          priorityColors={priorityColors}
          isAdmin={isAdmin}
          canCancelTask={canCancelTask}
          currentUserId={session.user.id}
          role={role}
        />
      </div>
    </div>
  )
}
