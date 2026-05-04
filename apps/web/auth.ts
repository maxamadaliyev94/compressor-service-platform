import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.clientId = (user as { clientId?: string | null }).clientId ?? null
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
        const user = await db.user.findUnique({
          where: { login: credentials.login as string },
        })
        if (!user || !user.isActive) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
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
        const { verifyWebAuthnSessionToken } = await import('@/lib/webauthn-challenge')
        const payload = verifyWebAuthnSessionToken(token)
        if (!payload) return null
        const user = await db.user.findUnique({ where: { id: payload.userId } })
        if (!user?.isActive) return null
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
