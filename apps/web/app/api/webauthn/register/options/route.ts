import { auth } from '@/auth'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { issueRegistrationChallengeToken } from '@/lib/webauthn-challenge'
import { getWebAuthnRpId, getWebAuthnRpName } from '@/lib/webauthn-config'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import type { Role } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const canManageUsers = await hasPermission(session.user.role as Role, 'action:user.manage')
  if (!canManageUsers) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { webauthnCredentials: { select: { credentialID: true } } },
  })
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

  const rpID = getWebAuthnRpId()
  const rpName = getWebAuthnRpName()
  const userID = new TextEncoder().encode(user.id)

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.login,
    userDisplayName: user.name,
    userID,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
    excludeCredentials: user.webauthnCredentials.map((c) => ({
      id: c.credentialID,
    })),
  })

  const challengeToken = issueRegistrationChallengeToken(user.id, options.challenge)

  return NextResponse.json({ options, challengeToken })
}
