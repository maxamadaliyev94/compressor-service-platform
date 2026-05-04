import { auth } from '@/auth'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { verifyRegistrationChallengeToken } from '@/lib/webauthn-challenge'
import { getWebAuthnExpectedOrigins, getWebAuthnRpId } from '@/lib/webauthn-config'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import type { Role } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const canManageUsers = await hasPermission(session.user.role as Role, 'action:user.manage')
  if (!canManageUsers) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null) as {
    response?: RegistrationResponseJSON
    challengeToken?: string
  } | null
  if (!body?.response || !body.challengeToken) {
    return NextResponse.json({ error: 'response и challengeToken обязательны' }, { status: 400 })
  }

  const payload = verifyRegistrationChallengeToken(body.challengeToken)
  if (!payload) return NextResponse.json({ error: 'Недействительный или истёкший challenge' }, { status: 400 })

  const expectedOrigins = getWebAuthnExpectedOrigins()
  const rpID = getWebAuthnRpId()

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: payload.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
    })
  } catch {
    return NextResponse.json({ error: 'Ошибка проверки WebAuthn' }, { status: 400 })
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Регистрация не подтверждена' }, { status: 400 })
  }

  const { credential } = verification.registrationInfo

  const user = await db.user.findUnique({ where: { id: payload.userId } })
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })

  const publicKeyBuf = Buffer.from(credential.publicKey)

  try {
    await db.webAuthnCredential.create({
      data: {
        userId: user.id,
        credentialID: credential.id,
        credentialPublicKey: publicKeyBuf,
        counter: credential.counter,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Этот ключ уже зарегистрирован' }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
