# Compressor Service Platform

FSM-система для сервисного обслуживания компрессорного оборудования.

## Стек
- **Монорепо**: pnpm workspaces + Turborepo
- **Веб**: Next.js 14 + Tailwind + shadcn/ui
- **Мобилка**: Expo (React Native) + NativeWind
- **API**: tRPC
- **БД**: PostgreSQL + Prisma

## Быстрый старт

```bash
# 1. Установить зависимости
pnpm install

# 2. Скопировать и заполнить переменные окружения
cp .env.example .env
# → отредактируй .env: DATABASE_URL, NEXTAUTH_SECRET и др.

# 3. Создать БД и применить миграции
pnpm db:migrate

# 4. Заполнить тестовыми данными
pnpm db:seed

# 5. Запустить всё
pnpm dev
```

Веб: http://localhost:3000
Мобилка: expo start → scan QR

## Структура

```
apps/web      ← Веб-панель (Admin, Manager, Chief Engineer, Client portal)
apps/mobile   ← Мобилка для инженеров (Expo)
packages/db   ← Prisma схема и клиент
packages/api  ← tRPC роутеры (бизнес-логика)
packages/shared ← Общие типы, константы, утилиты
```

## Роли

| Роль | Доступ |
|---|---|
| ADMIN | Полный |
| MANAGER | Клиенты, задачи, отчёты |
| CHIEF_ENGINEER | Распределение задач, контроль |
| ENGINEER | Только свои задачи |
| CLIENT | Только свои объекты и история |

## Этапы разработки

- [x] Этап 1: Структура проекта и конфиги
- [ ] Этап 2: Схема БД (Prisma schema)
- [ ] Этап 3: Backend API (tRPC роутеры)
- [ ] Этап 4: Веб-панель (Next.js)
- [ ] Этап 5: Мобильное приложение (Expo)
