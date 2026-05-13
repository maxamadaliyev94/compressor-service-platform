import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { logUserActivity, UserActivityAction } from '@/lib/user-activity-log'
import { canMutateEquipment, type AuthedSession } from '@/lib/api-access'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canMutateEquipment(session as AuthedSession, params.id)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { comment } = await req.json()
  if (!comment?.trim()) return NextResponse.json({ error: 'Комментарий пуст' }, { status: 400 })

  const log = await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'COMMENT',
      entity: 'Equipment',
      entityId: params.id,
      oldValue: null,
      newValue: null,
      comment: comment.trim(),
    },
    include: { user: { select: { name: true, role: true } } }
  })
  await logUserActivity(session.user.id, UserActivityAction.EQUIPMENT_COMMENT, req, {
    page: `/equipment/${params.id}`,
    metadata: { equipmentId: params.id },
  })
  return NextResponse.json(log)
}
