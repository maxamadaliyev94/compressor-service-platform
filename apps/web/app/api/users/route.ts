import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function GET() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, role: true, email: true, phone: true, isActive: true, createdAt: true },
  })
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const hash = await bcrypt.hash(body.password || 'password123', 10)
  const user = await db.user.create({
    data: {
      name: body.name,
      email: body.email,
      password: hash,
      role: body.role,
      phone: body.phone || null,
    },
  })
  return NextResponse.json({ id: user.id, name: user.name, role: user.role, email: user.email })
}
