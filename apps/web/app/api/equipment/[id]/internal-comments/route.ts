import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'
import { fetchBranchInternalComments } from '@/lib/engineer-internal-comments'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as Role
  if (role === 'CLIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const equipment = await db.equipment.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      brand: true,
      model: true,
      serialNumber: true,
      object: { select: { branchId: true, branch: { select: { name: true } } } },
    },
  })
  if (!equipment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const comments = await fetchBranchInternalComments(equipment.object.branchId, 5)

  return NextResponse.json({
    branchName: equipment.object.branch.name,
    equipment: {
      id: equipment.id,
      brand: equipment.brand,
      model: equipment.model,
      serialNumber: equipment.serialNumber,
    },
    comments,
  })
}
