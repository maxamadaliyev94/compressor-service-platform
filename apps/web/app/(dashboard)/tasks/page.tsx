import { db } from '@/lib/db'
import { getSession } from '@/lib/roles'
import TasksTable from './TasksTable'

export default async function TasksPage() {
  const session = await getSession()
  const role = session.user.role

  const tasks = await db.serviceTask.findMany({
    where: role === 'ENGINEER'
      ? { assignedToId: session.user.id }
      : {},
    include: {
      equipment: { include: { object: { include: { branch: { include: { client: true } } } } } },
      assignedTo: true,
      createdBy: true,
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
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Задачи</h1>
        <div className="flex gap-3">
          <a href="/tasks/kanban" className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            Канбан
          </a>
          <a href="/tasks/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            + Создать задачу
          </a>
        </div>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden">
        <TasksTable
          tasks={tasks}
          typeLabels={typeLabels}
          statusColors={statusColors}
          statusLabels={statusLabels}
          priorityColors={priorityColors}
        />
      </div>
    </div>
  )
}
