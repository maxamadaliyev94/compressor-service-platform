import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { isGloballyActive } from '@/lib/app-settings'
import bcrypt from 'bcryptjs'

const JWT_RECHECK_MS = 30_000
/** 30 суток в секундах — срок JWT и cookie сессии (Auth.js / NextAuth). */
const SESSION_MAX_AGE_SEC = 2592000

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SEC,
    /** Как часто обновлять запись сессии (не влияет на «выкидывание» при JWT). */
    updateAge: 24 * 60 * 60,
  },
  /** Срок зашифрованного JWE в cookie — должен совпадать с session.maxAge. */
  jwt: {
    maxAge: SESSION_MAX_AGE_SEC,
  },
  cookies: {
    sessionToken: {
      options: {
        maxAge: SESSION_MAX_AGE_SEC,
      },
    },
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.clientId = (user as { clientId?: string | null }).clientId ?? null
        token.lastValidityCheck = Date.now()
        token.exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC
        return token
      }
      const id = token.id as string | undefined
      if (!id) return token

      const last = (token.lastValidityCheck as number) || 0
      if (Date.now() - last < JWT_RECHECK_MS) return token
      token.lastValidityCheck = Date.now()

      let u: {
        isActive: boolean
        loginSuspendedByAdmin: boolean
        sessionInvalidatedAt: Date | null
      } | null
      try {
        u = await db.user.findUnique({
          where: { id },
          select: { isActive: true, loginSuspendedByAdmin: true, sessionInvalidatedAt: true },
        })
      } catch {
        return token
      }
      if (!u) return token

      if (!u.isActive || u.loginSuspendedByAdmin) {
        return { ...token, exp: Math.floor(Date.now() / 1000) - 3600 }
      }
      const iatSec = token.iat as number | undefined
      if (iatSec && u.sessionInvalidatedAt) {
        const issuedMs = iatSec * 1000
        if (issuedMs < u.sessionInvalidatedAt.getTime()) {
          return { ...token, exp: Math.floor(Date.now() / 1000) - 3600 }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role as string
        session.user.id = token.id as string
        session.user.clientId = (token.clientId as string | null | undefined) ?? null
      }
      return session
    },
  },
  providers: [
    Credentials({
      credentials: {
        login: { label: 'Логин', type: 'text' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null
        if (!(await isGloballyActive())) return null
        const user = await db.user.findUnique({
          where: { login: credentials.login as string },
        })
        if (!user || !user.isActive || user.loginSuspendedByAdmin) return null
        if (user.clientId) {
          const clientRow = await db.client.findUnique({
            where: { id: user.clientId },
            select: { isActive: true },
          })
          if (clientRow && clientRow.isActive === false) return null
        }
        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name,
          role: user.role,
          clientId: user.clientId,
        }
      },
    }),
    Credentials({
      id: 'webauthn',
      credentials: {
        token: { label: 'Token', type: 'text' },
      },
      async authorize(credentials) {
        const token = credentials?.token as string | undefined
        if (!token) return null
        if (!(await isGloballyActive())) return null
        const { verifyWebAuthnSessionToken } = await import('@/lib/webauthn-challenge')
        const payload = verifyWebAuthnSessionToken(token)
        if (!payload) return null
        const user = await db.user.findUnique({ where: { id: payload.userId } })
        if (!user?.isActive || user.loginSuspendedByAdmin) return null
        if (user.clientId) {
          const clientRow = await db.client.findUnique({
            where: { id: user.clientId },
            select: { isActive: true },
          })
          if (clientRow && clientRow.isActive === false) return null
        }
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name,
          role: user.role,
          clientId: user.clientId,
        }
      },
    }),
  ],
})
