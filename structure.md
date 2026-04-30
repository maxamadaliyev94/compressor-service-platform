# Compressor Service Platform — Структура проекта

## Монорепозиторий (pnpm workspaces)

```
compressor-service-platform/
├── .cursorrules                    ← правила для Cursor AI
├── .env.example                    ← шаблон переменных окружения
├── package.json                    ← root package (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json                      ← Turborepo конфиг
│
├── apps/
│   ├── web/                        ← Next.js 14 (веб-панель + клиентский кабинет)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                    ← Dashboard (главная)
│   │   │   │   ├── clients/
│   │   │   │   │   ├── page.tsx                ← Список клиентов
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   └── page.tsx            ← Карточка клиента
│   │   │   │   │   └── new/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── equipment/
│   │   │   │   │   ├── page.tsx                ← Всё оборудование
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx            ← Карточка оборудования
│   │   │   │   ├── tasks/
│   │   │   │   │   ├── page.tsx                ← Все задачи
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx            ← Карточка задачи
│   │   │   │   ├── reports/
│   │   │   │   │   └── page.tsx                ← Отчёты и KPI
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx                ← Справочники, регламенты
│   │   │   ├── client-portal/                  ← Клиентский кабинет
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   └── [equipmentId]/
│   │   │   │       └── page.tsx
│   │   │   └── api/
│   │   │       └── [...]/                      ← API роуты (если Next.js fullstack)
│   │   ├── components/
│   │   │   ├── ui/                             ← shadcn/ui компоненты
│   │   │   ├── dashboard/
│   │   │   │   ├── StatsCard.tsx
│   │   │   │   ├── TOAlertList.tsx             ← Скоро ТО / просрочено
│   │   │   │   ├── WarrantyStatus.tsx
│   │   │   │   └── RecentTasks.tsx
│   │   │   ├── equipment/
│   │   │   │   ├── EquipmentCard.tsx
│   │   │   │   ├── EquipmentForm.tsx
│   │   │   │   ├── QRCodeDisplay.tsx
│   │   │   │   └── ServiceHistory.tsx
│   │   │   ├── tasks/
│   │   │   │   ├── TaskCard.tsx
│   │   │   │   ├── TaskForm.tsx
│   │   │   │   └── StatusBadge.tsx
│   │   │   └── shared/
│   │   │       ├── DataTable.tsx
│   │   │       ├── PageHeader.tsx
│   │   │       └── Sidebar.tsx
│   │   ├── lib/
│   │   │   ├── auth.ts                         ← NextAuth конфиг
│   │   │   └── utils.ts
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── mobile/                     ← Expo (React Native) — приложение инженера
│       ├── app/
│       │   ├── (auth)/
│       │   │   └── login.tsx
│       │   ├── (tabs)/
│       │   │   ├── _layout.tsx
│       │   │   ├── index.tsx                   ← Мои задачи
│       │   │   └── profile.tsx
│       │   └── task/
│       │       ├── [id]/
│       │       │   ├── index.tsx               ← Детали задачи
│       │       │   ├── checklist.tsx           ← Заполнение чек-листа
│       │       │   ├── photos.tsx              ← Фото до/после
│       │       │   ├── parts.tsx               ← Запчасти
│       │       │   └── signature.tsx           ← Подпись клиента
│       │       └── complete.tsx                ← Закрытие задачи
│       ├── components/
│       │   ├── TaskListItem.tsx
│       │   ├── ChecklistItem.tsx
│       │   ├── SignaturePad.tsx
│       │   ├── PhotoPicker.tsx
│       │   └── HoursInput.tsx
│       ├── hooks/
│       │   ├── useOfflineSync.ts               ← Оффлайн синхронизация
│       │   └── useTasks.ts
│       ├── stores/
│       │   └── offlineStore.ts                 ← MMKV хранилище для оффлайн
│       ├── app.json
│       └── package.json
│
├── packages/
│   ├── db/                         ← Prisma + PostgreSQL
│   │   ├── prisma/
│   │   │   ├── schema.prisma       ← Главная схема БД
│   │   │   ├── seed.ts             ← Тестовые данные
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   └── index.ts            ← Экспорт Prisma client
│   │   └── package.json
│   │
│   ├── api/                        ← tRPC роутеры (бизнес-логика)
│   │   ├── src/
│   │   │   ├── router/
│   │   │   │   ├── index.ts        ← Корневой роутер
│   │   │   │   ├── clients.ts      ← CRUD клиентов
│   │   │   │   ├── equipment.ts    ← CRUD оборудования + расчёт ТО
│   │   │   │   ├── tasks.ts        ← Задачи + статусы
│   │   │   │   ├── reports.ts      ← Генерация отчётов
│   │   │   │   └── pdf.ts          ← Генерация PDF-актов
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts         ← Проверка ролей
│   │   │   └── services/
│   │   │       ├── maintenance.ts  ← Расчёт ТО по моточасам
│   │   │       ├── warranty.ts     ← Расчёт гарантийного статуса
│   │   │       ├── pdf.ts          ← Puppeteer генерация PDF
│   │   │       ├── qr.ts           ← Генерация QR-кодов
│   │   │       └── notifications.ts← Telegram + email уведомления
│   │   └── package.json
│   │
│   └── shared/                     ← Общие типы и утилиты
│       ├── src/
│       │   ├── types/
│       │   │   ├── equipment.ts
│       │   │   ├── tasks.ts
│       │   │   └── roles.ts
│       │   └── constants/
│       │       ├── maintenance.ts  ← MAINTENANCE_INTERVAL = 2000
│       │       └── warranty.ts
│       └── package.json
│
└── docs/
    ├── ТЗ_Сервисная_платформа.docx
    └── API.md
```
