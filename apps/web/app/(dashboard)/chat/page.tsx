import { Suspense } from 'react'
import { unstable_noStore as noStore } from 'next/cache'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import type { Role } from '@prisma/client'
import { assertStaffCanAccessTaskChat, getOrCreateTaskRoom } from '@/lib/internal-chat'
import ChatPageClient from './ChatPageClient'

export const dynamic = 'force-dynamic'

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined
  return Array.isArray(v) ? v[0] : v
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  noStore()
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.role === 'CLIENT') redirect('/403')

  const roomParam = firstParam(searchParams.room)
  const taskParam = firstParam(searchParams.task)

  if (taskParam && !roomParam) {
    try {
      await assertStaffCanAccessTaskChat(session.user.id, session.user.role as Role, taskParam)
      const room = await getOrCreateTaskRoom(taskParam)
      redirect(`/chat?room=${encodeURIComponent(room.id)}`)
    } catch {
      redirect('/chat')
    }
  }

  const initialRoomId = roomParam ?? null

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Чат сотрудников</h1>
        <p className="text-sm text-gray-500 mt-1">Общий чат, личные сообщения и обсуждения по задачам</p>
      </div>
      <Suspense fallback={<div className="text-gray-500 text-sm">Загрузка чата…</div>}>
        <ChatPageClient initialRoomId={initialRoomId} />
      </Suspense>
    </div>
  )
}
