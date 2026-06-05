import { db } from '@/lib/db'
import { auth } from '@/auth'
import { notFound, redirect } from 'next/navigation'
import ExecuteTaskClient from './ExecuteTaskClient'
import { canReadTask, type AuthedSession } from '@/lib/api-access'
import { findMaintenanceRegulation } from '@/lib/maintenance-regulations'

export default async function ExecuteTaskPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) redirect('/login')

  const task = await db.serviceTask.findUnique({
    where: { id: params.id },
    include: {
      equipment: {
        include: {
          object: {
            include: {
              branch: {
                include: { client: true },
              },
            },
          },
        },
      },
      assignedTo: true,
      createdBy: true,
      longTermEngineers: {
        select: { engineerId: true },
      },
    },
  })
  if (!task || task.deletedAt) notFound()

  if (session.user.role === 'CLIENT') {
    redirect(`/tasks/${params.id}`)
  }

  if (['DONE', 'CANCELLED'].includes(task.status)) {
    redirect(`/tasks/${params.id}`)
  }

  if (task.taskType === 'LONG_TERM') {
    const isLtMember =
      session.user.role === 'ENGINEER' &&
      (task.assignedToId === session.user.id || task.longTermEngineers.length > 0)
    if (isLtMember) {
      redirect(`/tasks/${params.id}/daily`)
    }
    redirect(`/tasks/${params.id}`)
  }

  const regulation = await findMaintenanceRegulation({
    taskType: task.type,
    equipmentType: task.equipment.type,
    taskScope: 'QUICK',
  })

  const role = session.user.role

  if (role === 'ENGINEER') {
    const canRead = await canReadTask(session as AuthedSession, params.id)
    if (!canRead) redirect(`/tasks/${params.id}`)
  }

  const signerProfile = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      savedActSignature: true,
      _count: { select: { webauthnCredentials: true } },
    },
  })

  return (
    <ExecuteTaskClient
      task={task}
      regulation={regulation}
      engineerId={session.user.id}
      engineerName={session.user.name || ''}
      savedActSignature={signerProfile?.savedActSignature ?? null}
      hasWebAuthnForSign={(signerProfile?._count.webauthnCredentials ?? 0) > 0}
    />
  )
}
