import { auth } from '@/auth'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getSuperadminCredentials, logSuperadminEnvOnce } from '@/lib/superadmin-env'

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/register', '/api/webauthn/login/', '/api/cron/']

function superadminBasicAuthDenied(req: NextRequest): NextResponse | null {
  logSuperadminEnvOnce('middleware')
  const creds = getSuperadminCredentials()
  if (!creds) {
    return NextResponse.json({ error: 'Superadmin credentials not configured' }, { status: 503 })
  }
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Basic ')) {
    return new NextResponse(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Superadmin"' },
    })
  }
  let decoded: string
  try {
    decoded = atob(authHeader.slice(6))
  } catch {
    return new NextResponse(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Superadmin"' },
    })
  }
  const i = decoded.indexOf(':')
  const user = (i === -1 ? decoded : decoded.slice(0, i)).trim()
  const pass = (i === -1 ? '' : decoded.slice(i + 1)).trim()
  if (user !== creds.username || pass !== creds.password) {
    if (process.env.NODE_ENV === 'development') {
      const g = globalThis as { __cspLoggedSuperadminReject?: boolean }
      if (!g.__cspLoggedSuperadminReject) {
        g.__cspLoggedSuperadminReject = true
        console.warn('[middleware/superadmin] Basic auth rejected (once)', {
          headerUserLen: user.length,
          headerPassLen: pass.length,
          envUserLen: creds.username.length,
          envPassLen: creds.password.length,
          userMatch: user === creds.username,
          passMatch: pass === creds.password,
        })
      }
    }
    return new NextResponse(null, {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Superadmin"' },
    })
  }
  return null
}

async function fetchAppIsActive(req: NextRequest): Promise<boolean> {
  const base =
    process.env.INTERNAL_APP_URL?.replace(/\/$/, '') || req.nextUrl.origin
  try {
    const res = await fetch(`${base}/api/internal/app-status`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    })
    if (!res.ok) return true
    const data = (await res.json()) as { active?: boolean }
    return data.active !== false
  } catch {
    return true
  }
}

export default auth(async (req: NextRequest) => {
  const pathname = req.nextUrl.pathname

  // Нужен до проверки maintenance (middleware дергает сам себя через fetch)
  if (pathname === '/api/internal/app-status') {
    return NextResponse.next()
  }

  // Скрытая зона владельца — только HTTP Basic из env
  if (pathname.startsWith('/superadmin') || pathname.startsWith('/api/superadmin')) {
    const denied = superadminBasicAuthDenied(req)
    if (denied) return denied
    return NextResponse.next()
  }

  let active = true
  try {
    active = await fetchAppIsActive(req)
  } catch {
    active = true
  }

  if (!active) {
    if (pathname.startsWith('/api/cron/')) {
      return NextResponse.next()
    }
    if (pathname === '/system-unavailable' || pathname.startsWith('/system-unavailable/')) {
      return NextResponse.next()
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Система временно недоступна' }, { status: 503 })
    }
    return NextResponse.redirect(new URL('/system-unavailable', req.url))
  }

  if (pathname.startsWith('/api/')) {
    const isPublic = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
    if (!isPublic && !req.auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  const isLoggedIn = !!req.auth
  const isLoginPage = pathname === '/login'
  const isRegisterPage = pathname === '/register'

  if (!isLoggedIn && !isLoginPage && !isRegisterPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (isLoggedIn && (isLoginPage || isRegisterPage)) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
