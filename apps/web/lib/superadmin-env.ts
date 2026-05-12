/**
 * Учётные данные HTTP Basic для /superadmin (только env, не User в БД).
 * trim() — на Windows в .env часто остаётся \r в конце строки.
 */
export function getSuperadminCredentials(): { username: string; password: string } | null {
  const username = process.env.SUPERADMIN_USERNAME?.trim()
  const password = process.env.SUPERADMIN_PASSWORD?.trim()
  if (!username || !password) return null
  return { username, password }
}

/** Лог в dev: видно, подхватились ли переменные (без значений пароля). */
export function logSuperadminEnvOnce(context: string): void {
  if (process.env.NODE_ENV !== 'development') return
  const g = globalThis as { __cspLoggedSuperadminEnv?: boolean }
  if (g.__cspLoggedSuperadminEnv) return
  g.__cspLoggedSuperadminEnv = true
  const u = process.env.SUPERADMIN_USERNAME
  const p = process.env.SUPERADMIN_PASSWORD
  console.log(`[superadmin-env] ${context}`, {
    SUPERADMIN_USERNAME: u == null ? 'undefined' : `set (len=${u.trim().length}, rawCR=${u.includes('\r')})`,
    SUPERADMIN_PASSWORD: p == null ? 'undefined' : `set (len=${p.trim().length})`,
  })
}
