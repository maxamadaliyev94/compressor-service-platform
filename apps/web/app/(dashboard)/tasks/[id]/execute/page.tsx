import { db } from '@/lib/db'
import { auth } from '@/auth'
import { notFound, redirect } from 'next/navigation'
import ExecuteTaskClient from './ExecuteTaskClient'

export default async function ExecuteTaskPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: {
      equipment: {
        include: { object: { include: { branch: { include: { client: true } } } } }
      },
      assignedTo: true,
      createdBy: true,
    }
  })
  if (!task) notFound()

  if (['DONE', 'CANCELLED'].includes(task.status)) {
    redirect(`/tasks/${params.id}`)
  }

  const regulation = await db.maintenanceRegulation.findFirst({
    where: {
      taskType: task.type,
      equipmentType: task.equipment.type,
      isActive: true,
    },
    include: { items: { orderBy: { order: 'asc' } } }
  })

  const role = session.user.role
  if (role === 'ENGINEER' && task.assignedToId !== session.user.id) {
    redirect('/')
  }

  return (
    <ExecuteTaskClient
      task={task}
      regulation={regulation}
      engineerId={session.user.id}
      engineerName={session.user.name || ''}
    />
  )
}
