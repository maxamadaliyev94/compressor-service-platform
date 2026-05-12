import type { NextRequest } from 'next/server'
import { getSuperadminCredentials, logSuperadminEnvOnce } from '@/lib/superadmin-env'

let devCompareLogged = false

/** HTTP Basic для /superadmin — учётные данные только из env, не из таблицы User. */
export function verifySuperadminBasicAuth(req: NextRequest): boolean {
  logSuperadminEnvOnce('verifySuperadminBasicAuth')
  const creds = getSuperadminCredentials()
  if (!creds) return false

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Basic ')) return false

  let decoded: string
  try {
    decoded = atob(authHeader.slice(6))
  } catch {
    return false
  }

  const i = decoded.indexOf(':')
  const user = (i === -1 ? decoded : decoded.slice(0, i)).trim()
  const pass = (i === -1 ? '' : decoded.slice(i + 1)).trim()

  if (process.env.NODE_ENV === 'development' && !devCompareLogged) {
    devCompareLogged = true
    console.log('[superadmin-basic-auth] first compare (lengths / match flags)', {
      headerUserLen: user.length,
      headerPassLen: pass.length,
      envUserLen: creds.username.length,
      envPassLen: creds.password.length,
      userMatch: user === creds.username,
      passMatch: pass === creds.password,
    })
  }

  return user === creds.username && pass === creds.password
}
