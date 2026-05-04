export function getWebAuthnRpId(): string {
  const fromEnv = process.env.WEBAUTHN_RP_ID?.trim()
  if (fromEnv) return fromEnv
  const url = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    return new URL(url).hostname
  } catch {
    return 'localhost'
  }
}

export function getWebAuthnRpName(): string {
  return process.env.WEBAUTHN_RP_NAME?.trim() || 'Compressor Service'
}

/** Origins, разрешённые для WebAuthn (например http://localhost:3000 и прод-домен). */
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
