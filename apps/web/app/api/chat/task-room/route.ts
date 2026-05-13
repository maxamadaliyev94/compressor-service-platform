import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { Role } from '@prisma/client'
import { assertStaffCanAccessTaskChat, getOrCreateTaskRoom } from '@/lib/internal-chat'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role as Role

  const taskId = req.nextUrl.searchParams.get('taskId')?.trim() ?? ''
  if (!taskId) return NextResponse.json({ error: 'taskId обязателен' }, { status: 400 })

  try {
    await assertStaffCanAccessTaskChat(session.user.id, role, taskId)
  } catch (e) {
    const err = e as Error
    if (err.message === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const room = await getOrCreateTaskRoom(taskId)
  return NextResponse.json({ roomId: room.id })
}
