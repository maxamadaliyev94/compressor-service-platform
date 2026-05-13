import type { NextRequest } from 'next/server'

/** IP клиента за прокси (Vercel / nginx). */
export function getClientIp(req: NextRequest | Request): string | null {
  const h = req.headers
  const xf = h.get('x-forwarded-for')
  if (xf) {
    const first = xf.split(',')[0]?.trim()
    if (first) return first
  }
  const real = h.get('x-real-ip')?.trim()
  if (real) return real
  return null
}
