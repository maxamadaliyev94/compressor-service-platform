import { db } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { hasPermission, requirePermission } from '@/lib/permissions'
import type { Role } from '@prisma/client'
import { unstable_noStore as noStore } from 'next/cache'
import KanbanBoard from './KanbanBoard'
import {
  prismaWhereClientPortalTaskList,
  prismaWhereEngineerTaskAssignment,
} from '@/lib/api-access'
import { sanitizeTasksForClientPortal } from '@/lib/client-portal-tasks'

export const dynamic = 'force-dynamic'

export default async function KanbanPage() {
  noStore()
  await requirePermission('section:tasks')
  const session = await auth()
  if (!session) redirect('/login')
  const role = session.user.role
  const isAdmin = role === 'ADMIN'
  const canCreateTask = role !== 'ENGINEER' && (await hasPermission(role as Role, 'action:task.create'))

  let tasks = await db.serviceTask.findMany({
    where:
      role === 'CLIENT'
        ? prismaWhereClientPortalTaskList(session.user.clientId)
        : {
            status: { not: 'CANCELLED' },
            deletedAt: null,
            ...(role === 'ENGINEER' ? prismaWhereEngineerTaskAssignment(session.user.id) : {}),
          },
    include: {
      equipment: { include: { object: { include: { branch: { include: { client: true } } } } } },
      assignedTo: true,
      longTermEngineers: { include: { engineer: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (role === 'CLIENT') {
    tasks = await sanitizeTasksForClientPortal(tasks)
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Канбан</h1>
          <p className="text-sm text-gray-500 mt-1">Управление задачами</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3">
          {isAdmin && (
            <a href="/tasks/trash" className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Корзина
            </a>
          )}
          <a href="/tasks" className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            Список
          </a>
          {canCreateTask && (
            <a
              href="/tasks/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              + Создать задачу
            </a>
          )}
        </div>
      </div>
      <KanbanBoard tasks={tasks} />
    </div>
  )
}
