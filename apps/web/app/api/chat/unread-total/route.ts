import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { Role } from '@prisma/client'
import { countUnreadMessagesTotal, isStaffRole } from '@/lib/internal-chat'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role as Role
  if (!isStaffRole(role)) return NextResponse.json({ total: 0 })

  const total = await countUnreadMessagesTotal(session.user.id, role)
  return NextResponse.json({ total })
}
