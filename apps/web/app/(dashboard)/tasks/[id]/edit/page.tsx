import { auth } from '@/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import EditCompletedTaskClient from './EditCompletedTaskClient'
import EditActiveTaskClient from './EditActiveTaskClient'

export default async function EditTaskPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const role = session.user.role
  const isManagerOrAdmin = role === 'ADMIN' || role === 'MANAGER'

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: {
      report: {
        include: {
          checklistItems: { orderBy: { order: 'asc' } },
          partsUsed: true,
          attachments: { orderBy: { createdAt: 'asc' } },
        },
      },
      equipment: { include: { object: { include: { branch: { include: { client: true } } } } } },
      assignedTo: { select: { id: true, name: true, role: true } },
    },
  })
  if (!task || task.deletedAt) notFound()

  if (task.status === 'DONE' && task.report) {
    if (!isManagerOrAdmin) redirect('/403')
    return (
      <div className="p-4 md:p-8 max-w-3xl">
        <div className="flex items-center gap-2 mb-6 text-sm">
          <a href={`/tasks/${task.id}`} className="text-gray-400 hover:text-gray-600">
            ← Назад к задаче
          </a>
        </div>
        <h1 className="text-2xl font-bold mb-4">Изменить данные выполненной задачи</h1>
        <EditCompletedTaskClient task={JSON.parse(JSON.stringify(task))} />
      </div>
    )
  }

  if (!isManagerOrAdmin) redirect('/403')
  if (['DONE', 'CANCELLED'].includes(task.status)) redirect(`/tasks/${params.id}`)

  const payload = {
    id: task.id,
    requestNumber: task.requestNumber,
    equipmentId: task.equipmentId,
    type: task.type,
    priority: task.priority,
    scheduledAt: task.scheduledAt?.toISOString() ?? null,
    startDate: task.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: task.endDate?.toISOString().slice(0, 10) ?? null,
    taskType: task.taskType,
    comment: task.comment,
    assignedToId: task.assignedToId,
    managedByChiefId: task.managedByChiefId,
    assignedTo: task.assignedTo,
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="flex items-center gap-2 md:gap-3 mb-6">
        <a href={`/tasks/${task.id}`} className="text-gray-400 hover:text-gray-600">
          ← Назад к задаче
        </a>
        <h1 className="text-2xl font-bold">Изменить задачу №{task.requestNumber}</h1>
      </div>
      <EditActiveTaskClient task={payload} />
    </div>
  )
}
