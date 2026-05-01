import { auth } from '@/auth'
import { db } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import EditCompletedTaskClient from './EditCompletedTaskClient'

export default async function EditCompletedTaskPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')
  if (!['ADMIN', 'MANAGER'].includes(session.user.role)) redirect('/403')

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
    },
  })
  if (!task || task.deletedAt) notFound()
  if (task.status !== 'DONE' || !task.report) redirect(`/tasks/${params.id}`)

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <a href={`/tasks/${task.id}`} className="text-gray-400 hover:text-gray-600">← Назад к задаче</a>
      </div>
      <h1 className="text-2xl font-bold mb-4">Изменить данные выполненной задачи</h1>
      <EditCompletedTaskClient task={JSON.parse(JSON.stringify(task))} />
    </div>
  )
}
