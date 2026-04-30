# Промпт для Cursor Agent — Инициализация проекта

Скопируй этот промпт и вставь в Cursor Agent (Ctrl+Shift+P → "Cursor: New Agent Session")

---

## ПРОМПТ:

Создай монорепозиторий `compressor-service-platform` с полной структурой файлов и конфигами.

### Что нужно создать:

**1. Root файлы:**
- `package.json` с pnpm workspaces, скриптами dev/build/db:migrate/db:seed
- `pnpm-workspace.yaml` с packages: ["apps/*", "packages/*"]
- `turbo.json` с тасками: build, dev, lint, type-check
- `.env.example` с переменными: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, STORAGE_URL, STORAGE_KEY, TELEGRAM_BOT_TOKEN, SMTP_*, YANDEX_MAPS_API_KEY
- `tsconfig.base.json` с strict: true, paths для @csp/*

**2. packages/shared** — общие типы:
- `src/types/roles.ts` — enum Role: ADMIN, MANAGER, CHIEF_ENGINEER, ENGINEER, CLIENT
- `src/types/equipment.ts` — типы Equipment, MaintenanceStatus, WarrantyStatus
- `src/types/tasks.ts` — типы ServiceTask, TaskStatus
- `src/constants/maintenance.ts` — MAINTENANCE_INTERVAL = 2000, WARNING_THRESHOLD = 300, URGENT_THRESHOLD = 100
- `src/utils/maintenance.ts` — функция getMaintenanceStatus(currentHours, nextServiceHours)
- `src/utils/warranty.ts` — функция getWarrantyStatus(warrantyUntil, isVoided)

**3. packages/db** — Prisma:
- `prisma/schema.prisma` — модели: User, Client, Branch, Object, Equipment, ServiceTask, WorkReport, ChecklistItem, PartUsed, Attachment, MaintenanceRegulation, AuditLog
- `src/index.ts` — экспорт PrismaClient singleton
- `package.json` с зависимостями: @prisma/client, prisma
- Скрипты: `migrate`, `seed`, `studio`, `generate`

**4. packages/api** — tRPC:
- `src/trpc.ts` — инициализация tRPC с context (session, db)
- `src/router/index.ts` — корневой appRouter
- `src/router/clients.ts` — CRUD клиентов
- `src/router/equipment.ts` — CRUD оборудования + расчёт ТО
- `src/router/tasks.ts` — CRUD задач + смена статусов
- `src/middleware/auth.ts` — protectedProcedure с проверкой ролей

**5. apps/web** — Next.js 14:
- `package.json` с зависимостями: next, react, @tanstack/react-query, next-auth, @trpc/*, tailwindcss, shadcn/ui
- `next.config.ts`
- `tailwind.config.ts`
- `app/layout.tsx` — root layout с Providers
- `app/(auth)/login/page.tsx` — страница входа
- `app/(dashboard)/layout.tsx` — layout с Sidebar
- `app/(dashboard)/page.tsx` — Dashboard (заглушка с 4 карточками: скоро ТО, просрочено, гарантии истекают, задачи)
- `app/(dashboard)/clients/page.tsx` — список клиентов (заглушка)
- `app/(dashboard)/equipment/page.tsx` — список оборудования (заглушка)
- `app/(dashboard)/tasks/page.tsx` — список задач (заглушка)
- `components/shared/Sidebar.tsx` — боковое меню с разделами
- `lib/auth.ts` — NextAuth конфиг с CredentialsProvider
- `lib/trpc.ts` — tRPC клиент

**6. apps/mobile** — Expo:
- `package.json` с зависимостями: expo, react-native, expo-router, nativewind, @tanstack/react-query, react-native-mmkv
- `app.json`
- `app/(auth)/login.tsx` — экран входа
- `app/(tabs)/_layout.tsx` — нижние табы
- `app/(tabs)/index.tsx` — список задач инженера (заглушка)
- `app/task/[id]/index.tsx` — детали задачи
- `stores/offlineStore.ts` — MMKV хранилище для оффлайн данных

### Требования к коду:
- TypeScript везде, strict mode
- Все типы из @csp/shared
- Prisma через @csp/db
- API только через tRPC
- Zod для валидации
- Заглушки (TODO комментарии) где нет логики

После создания структуры покажи команды для старта:
```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```
