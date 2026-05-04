import { db } from '@/lib/db'
import { issueWebAuthnSessionToken, verifyLoginChallengeToken } from '@/lib/webauthn-challenge'
import { getWebAuthnExpectedOrigins, getWebAuthnRpId } from '@/lib/webauthn-config'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    response?: AuthenticationResponseJSON
    challengeToken?: string
  } | null
  if (!body?.response || !body.challengeToken) {
    return NextResponse.json({ error: 'response и challengeToken обязательны' }, { status: 400 })
  }

  const payload = verifyLoginChallengeToken(body.challengeToken)
  if (!payload) return NextResponse.json({ error: 'Недействительный или истёкший challenge' }, { status: 400 })

  const user = await db.user.findUnique({
    where: { login: payload.login },
    include: { webauthnCredentials: true },
  })
  if (!user?.isActive || user.webauthnCredentials.length === 0) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
  }

  const credId = body.response.id
  const dbCred = user.webauthnCredentials.find((c) => c.credentialID === credId)
  if (!dbCred) {
    return NextResponse.json({ error: 'Неизвестный ключ' }, { status: 400 })
  }

  const credential = {
    id: dbCred.credentialID,
    publicKey: new Uint8Array(dbCred.credentialPublicKey),
    counter: dbCred.counter,
  }

  const expectedOrigins = getWebAuthnExpectedOrigins()
  const rpID = getWebAuthnRpId()

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
    return NextResponse.json({ error: 'Вход не подтверждён' }, { status: 400 })
  }

  const { newCounter } = verification.authenticationInfo
  await db.webAuthnCredential.update({
    where: { id: dbCred.id },
    data: { counter: newCounter },
  })

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  const token = issueWebAuthnSessionToken(user.id)
  return NextResponse.json({ token })
}
