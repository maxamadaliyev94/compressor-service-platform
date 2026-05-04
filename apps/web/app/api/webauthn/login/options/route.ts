import { db } from '@/lib/db'
import { issueLoginChallengeToken } from '@/lib/webauthn-challenge'
import { getWebAuthnRpId } from '@/lib/webauthn-config'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const login = typeof body.login === 'string' ? body.login.trim().toLowerCase() : ''
  if (!login) return NextResponse.json({ error: 'Логин обязателен' }, { status: 400 })

  const user = await db.user.findUnique({
    where: { login },
    include: { webauthnCredentials: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'no_credentials' }, { status: 404 })
  }
  if (!user.isActive || user.webauthnCredentials.length === 0) {
    return NextResponse.json({ error: 'no_credentials' }, { status: 404 })
  }

  const rpID = getWebAuthnRpId()
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: user.webauthnCredentials.map((c) => ({
      id: c.credentialID,
    })),
    userVerification: 'preferred',
  })

  const challengeToken = issueLoginChallengeToken(user.login, options.challenge)

  return NextResponse.json({ options, challengeToken })
}
