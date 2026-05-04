import { db } from '@/lib/db'
import { issueLoginChallengeDiscoverable, issueLoginChallengeUser } from '@/lib/webauthn-challenge'
import { resolveWebAuthnForRequest } from '@/lib/webauthn-config'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const login = typeof body.login === 'string' ? body.login.trim().toLowerCase() : ''

  const { rpId: rpID } = resolveWebAuthnForRequest(req)

  if (!login) {
    const anyCred = await db.webAuthnCredential.findFirst({ select: { id: true } })
    if (!anyCred) {
      return NextResponse.json({ error: 'no_credentials' }, { status: 404 })
    }
    const options = await generateAuthenticationOptions({
      rpID: rpID,
      userVerification: 'preferred',
    })
    const challengeToken = issueLoginChallengeDiscoverable(options.challenge)
    return NextResponse.json({ options, challengeToken, mode: 'discoverable' as const })
  }

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

  const options = await generateAuthenticationOptions({
    rpID: rpID,
    allowCredentials: user.webauthnCredentials.map((c) => ({
      id: c.credentialID,
    })),
    userVerification: 'preferred',
  })

  const challengeToken = issueLoginChallengeUser(user.login, options.challenge)

  return NextResponse.json({ options, challengeToken, mode: 'user' as const })
}
