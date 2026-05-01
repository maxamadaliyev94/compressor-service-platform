import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name?: string
    login?: string
    email?: string
    password?: string
  }

  const name = body.name?.trim()
  const login = body.login?.trim().toLowerCase()
  const email = body.email?.trim().toLowerCase() || null
  const password = body.password ?? ''

  if (!name || !login || !password) {
    return NextResponse.json({ error: 'Заполните все обязательные поля' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 })
  }

  const existingLogin = await db.user.findUnique({ where: { login } })
  if (existingLogin) {
    return NextResponse.json({ error: 'Пользователь с таким логином уже существует' }, { status: 409 })
  }
  if (email) {
    const existingEmail = await db.user.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 409 })
    }
  }

  const hash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: {
      name,
      login,
      email,
      password: hash,
      role: 'CLIENT',
      isActive: true,
    },
    select: { id: true, name: true, login: true, email: true, role: true },
  })

  return NextResponse.json(user, { status: 201 })
}
