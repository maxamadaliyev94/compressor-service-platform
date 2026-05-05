import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/register', '/api/webauthn/login/', '/api/cron/']

export default auth((req) => {
  const pathname = req.nextUrl.pathname

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
