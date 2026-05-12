import type { NextRequest } from 'next/server'

/** HTTP Basic для /superadmin — учётные данные только из env, не из таблицы User. */
export function verifySuperadminBasicAuth(req: NextRequest): boolean {
  const username = process.env.SUPERADMIN_USERNAME
  const password = process.env.SUPERADMIN_PASSWORD
  if (!username || !password) return false
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Basic ')) return false
  let decoded: string
  try {
    decoded = atob(authHeader.slice(6))
  } catch {
    return false
  }
  const i = decoded.indexOf(':')
  const user = i === -1 ? decoded : decoded.slice(0, i)
  const pass = i === -1 ? '' : decoded.slice(i + 1)
  return user === username && pass === password
}
