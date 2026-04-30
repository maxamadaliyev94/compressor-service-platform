import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  return NextResponse.json(log)
}
