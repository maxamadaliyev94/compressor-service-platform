/** Геолокация по IP (внешний сервис, без ключа). Ошибки глотаем. */
export async function lookupIpGeo(ip: string | null): Promise<{ city: string | null; country: string | null }> {
  if (!ip) return { city: null, country: null }
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('fc00:') ||
    ip.startsWith('fe80:')
  ) {
    return { city: null, country: null }
  }
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      cache: 'no-store',
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!res.ok) return { city: null, country: null }
    const j = (await res.json()) as { city?: string; country_name?: string; error?: boolean }
    if (j.error) return { city: null, country: null }
    return {
      city: typeof j.city === 'string' && j.city.trim() ? j.city.trim() : null,
      country: typeof j.country_name === 'string' && j.country_name.trim() ? j.country_name.trim() : null,
    }
  } catch {
    return { city: null, country: null }
  }
}
