import { auth } from '@/auth'
import { db } from '@/lib/db'
import { issueSignActChallengeToken } from '@/lib/webauthn-challenge'
import { resolveWebAuthnForRequest } from '@/lib/webauthn-config'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { NextRequest, NextResponse } from 'next/server'

/** WebAuthn для подтверждения подписи акта (уже вошедший пользователь). */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const creds = await db.webAuthnCredential.findMany({
    where: { userId: session.user.id },
    select: { credentialID: true },
  })
  if (creds.length === 0) {
    return NextResponse.json({ error: 'no_webauthn' }, { status: 404 })
  }

  const { rpId: rpID } = resolveWebAuthnForRequest(req)
  const options = await generateAuthenticationOptions({
    rpID: rpID,
    allowCredentials: creds.map((c) => ({ id: c.credentialID })),
    userVerification: 'preferred',
  })

  const challengeToken = issueSignActChallengeToken(session.user.id, options.challenge)
  return NextResponse.json({ options, challengeToken })
}
