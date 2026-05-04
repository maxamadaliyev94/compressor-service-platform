import { auth } from '@/auth'
import { db } from '@/lib/db'
import { verifySignActChallengeToken } from '@/lib/webauthn-challenge'
import { resolveWebAuthnForRequest } from '@/lib/webauthn-config'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    response?: AuthenticationResponseJSON
    challengeToken?: string
  } | null
  if (!body?.response || !body.challengeToken) {
    return NextResponse.json({ error: 'response и challengeToken обязательны' }, { status: 400 })
  }

  const payload = verifySignActChallengeToken(body.challengeToken)
  if (!payload || payload.userId !== session.user.id) {
    return NextResponse.json({ error: 'Недействительный challenge' }, { status: 400 })
  }

  const dbCred = await db.webAuthnCredential.findUnique({
    where: { credentialID: body.response.id },
    include: { user: true },
  })
  if (!dbCred || dbCred.userId !== session.user.id || !dbCred.user.isActive) {
    return NextResponse.json({ error: 'Ключ не найден' }, { status: 400 })
  }

  const credential = {
    id: dbCred.credentialID,
    publicKey: new Uint8Array(dbCred.credentialPublicKey),
    counter: dbCred.counter,
  }

  const { rpId: rpID, expectedOrigins } = resolveWebAuthnForRequest(req)

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: payload.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      credential,
    })
  } catch {
    return NextResponse.json({ error: 'Ошибка проверки WebAuthn' }, { status: 400 })
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Не подтверждено' }, { status: 400 })
  }

  await db.webAuthnCredential.update({
    where: { id: dbCred.id },
    data: { counter: verification.authenticationInfo.newCounter },
  })

  return NextResponse.json({ ok: true })
}
