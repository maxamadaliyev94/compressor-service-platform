import { createHmac, timingSafeEqual } from 'crypto'

function authSecret(): string {
  const s = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET (или AUTH_SECRET) обязателен для WebAuthn')
  return s
}

function signPayload(payloadB64url: string): string {
  return createHmac('sha256', authSecret()).update(payloadB64url).digest('base64url')
}

const enc = (o: object) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url')
const dec = <T>(s: string): T => JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as T

export type RegChallengePayload = { t: 'reg'; userId: string; challenge: string; exp: number }
export type LoginChallengePayload = { t: 'login'; login: string; challenge: string; exp: number }

function verifySignedPayload<T extends { t: string; exp: number }>(token: string, kind: string): T | null {
  const lastDot = token.lastIndexOf('.')
  if (lastDot <= 0) return null
  const payloadB64 = token.slice(0, lastDot)
  const sig = token.slice(lastDot + 1)
  const expected = signPayload(payloadB64)
  try {
    if (!timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))) return null
  } catch {
    return null
  }
  const data = dec<T>(payloadB64)
  if (data.exp < Date.now()) return null
  if (data.t !== kind) return null
  return data
}

const CHALLENGE_TTL_MS = 5 * 60_000

export function issueRegistrationChallengeToken(userId: string, challenge: string): string {
  const exp = Date.now() + CHALLENGE_TTL_MS
  const payload = enc({ t: 'reg', userId, challenge, exp })
  return `${payload}.${signPayload(payload)}`
}

export function verifyRegistrationChallengeToken(token: string): RegChallengePayload | null {
  return verifySignedPayload<RegChallengePayload>(token, 'reg')
}

export function issueLoginChallengeToken(login: string, challenge: string): string {
  const exp = Date.now() + CHALLENGE_TTL_MS
  const payload = enc({ t: 'login', login, challenge, exp })
  return `${payload}.${signPayload(payload)}`
}

export function verifyLoginChallengeToken(token: string): LoginChallengePayload | null {
  return verifySignedPayload<LoginChallengePayload>(token, 'login')
}

export type SessionHandoffPayload = { t: 'session'; userId: string; exp: number }

export function issueWebAuthnSessionToken(userId: string): string {
  const exp = Date.now() + 60_000
  const payload = enc({ t: 'session', userId, exp })
  return `${payload}.${signPayload(payload)}`
}

export function verifyWebAuthnSessionToken(token: string): SessionHandoffPayload | null {
  return verifySignedPayload<SessionHandoffPayload>(token, 'session')
}
