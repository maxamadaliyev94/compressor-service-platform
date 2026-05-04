import { db } from '@/lib/db'
import { getSession } from '@/lib/roles'
import { hasPermission, requirePermission } from '@/lib/permissions'
import type { Role } from '@prisma/client'
import TasksTable from './TasksTable'
import { prismaWhereManagerTasks } from '@/lib/api-access'

export default async function TasksPage() {
  await requirePermission('section:tasks')
  const session = await getSession()
  const role = session.user.role
  const isAdmin = role === 'ADMIN'
  const canCreateTask = role !== 'ENGINEER' && (await hasPermission(role as Role, 'action:task.create'))

  const tasks = await db.serviceTask.findMany({
    where:
      role === 'ENGINEER'
        ? { assignedToId: session.user.id, deletedAt: null }
        : role === 'MANAGER'
          ? { deletedAt: null, ...prismaWhereManagerTasks(session.user.id) }
          : { deletedAt: null },
    include: {
      equipment: { include: { object: { include: { branch: { include: { client: true } } } } } },
      assignedTo: true,
      createdBy: true,
      report: { select: { id: true, clientSignature: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const typeLabels: Record<string, string> = {
    PLANNED_MAINTENANCE: 'Плановое ТО',
    DIAGNOSTICS: 'Диагностика',
    WARRANTY_REPAIR: 'Гарантийный ремонт',
    EMERGENCY: 'Аварийный выезд',
    INSTALLATION: 'Монтаж',
    COMMISSIONING: 'Пусконаладка',
  }
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
        <h1 className="text-xl md:text-2xl font-bold">Задачи</h1>
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
          currentUserId={session.user.id}
          role={role}
        />
      </div>
    </div>
  )
}
