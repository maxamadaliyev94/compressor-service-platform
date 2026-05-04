import type { NextRequest } from 'next/server'

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function getWebAuthnRpName(): string {
  return process.env.WEBAUTHN_RP_NAME?.trim() || 'Compressor Service'
}

/** Статический список origin из env (без учёта текущего запроса). */
export function getWebAuthnExpectedOrigins(): string[] {
  const extra = process.env.WEBAUTHN_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? []
  const primary = process.env.NEXTAUTH_URL?.trim()
  const pub = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const set = new Set<string>(extra)
  if (primary) set.add(primary)
  if (pub) set.add(pub)
  if (set.size === 0) set.add('http://localhost:3000')
  return [...set]
}

/**
 * RP ID и разрешённые origin для WebAuthn с учётом реального хоста запроса
 * (Railway: x-forwarded-host / x-forwarded-proto). Иначе rp.id в опциях не совпадает с
 * страницей в браузере — биометрия падает с SecurityError.
 */
export function resolveWebAuthnForRequest(req: NextRequest): { rpId: string; expectedOrigins: string[] } {
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const rawHost = forwardedHost || req.headers.get('host') || ''
  const hostOnly = rawHost.split(':')[0] || ''

  const proto: 'http' | 'https' =
    forwardedProto === 'http' || forwardedProto === 'https'
      ? forwardedProto
      : req.nextUrl.protocol === 'https:'
        ? 'https'
        : 'http'

  const origins = new Set(getWebAuthnExpectedOrigins())
  if (rawHost) {
    origins.add(`${proto}://${rawHost}`)
  }

  const envRpOverride = process.env.WEBAUTHN_RP_ID?.trim()
  const fromEnvUrl = hostnameFromUrl(process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '')

  const rpId = envRpOverride || hostOnly || fromEnvUrl || 'localhost'

  return {
    rpId,
    expectedOrigins: [...origins].filter(Boolean),
  }
}

/** @deprecated Используйте resolveWebAuthnForRequest(req) на проде с прокси. */
export function getWebAuthnRpId(): string {
  const fromEnv = process.env.WEBAUTHN_RP_ID?.trim()
  if (fromEnv) return fromEnv
  const url = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return hostnameFromUrl(url) ?? 'localhost'
}
