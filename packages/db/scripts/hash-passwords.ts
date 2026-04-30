import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('password123', 10)
  await prisma.user.updateMany({ data: { password: hash } })
  console.log('✅ Все пароли обновлены. Пароль: password123')
}

main().catch(console.error).finally(() => prisma.$disconnect())
