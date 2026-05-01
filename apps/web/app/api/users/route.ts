import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/auth'
import { hasPermission } from '@/lib/permissions'
import type { Role } from '@prisma/client'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = session.user.role as Role
  const canManageUsers = await hasPermission(role, 'action:user.manage')
  const canAssignTasks = await hasPermission(role, 'action:task.assign')
  if (!canManageUsers && !canAssignTasks) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, login: true, role: true, email: true, phone: true, isActive: true, createdAt: true },
  })
  if (canManageUsers) return NextResponse.json(users)

  return NextResponse.json(
    users.map((u) => ({ id: u.id, name: u.name, role: u.role, login: u.login, isActive: u.isActive }))
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const canManageUsers = await hasPermission(session.user.role as Role, 'action:user.manage')
  if (!canManageUsers) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const login = (body.login || '').trim().toLowerCase()
  const email = body.email?.trim().toLowerCase() || null
  if (!login) return NextResponse.json({ error: 'Логин обязателен' }, { status: 400 })

  const existingLogin = await db.user.findUnique({ where: { login } })
  if (existingLogin) {
    return NextResponse.json({ error: 'Логин уже используется' }, { status: 409 })
  }
  if (email) {
    const existingEmail = await db.user.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json({ error: 'Email уже используется' }, { status: 409 })
    }
  }

  const hash = await bcrypt.hash(body.password || 'password123', 10)
  const user = await db.user.create({
    data: {
      name: body.name,
      login,
      email,
      password: hash,
      role: body.role,
      phone: body.phone || null,
    },
  })
  return NextResponse.json({ id: user.id, name: user.name, role: user.role, login: user.login, email: user.email })
}
