import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/** Совпадает с apps/web/lib/uzbekistan.ts — начальный справочник городов */
const UZBEKISTAN_CITIES_SEED = [
  'Ташкент',
  'Самарканд',
  'Наманган',
  'Андижан',
  'Фергана',
  'Нукус',
  'Карши',
  'Бухара',
  'Балтакент',
  'Термез',
  'Коканд',
  'Маргилан',
  'Чирчик',
  'Ангрен',
  'Алмалык',
  'Зарафшан',
  'Навои',
  'Гулистан',
  'Джизак',
  'Ургенч',
  'Хива',
  'Нурафшон',
  'Бекабад',
  'Газалкент',
  'Янгиюль',
  'Другой',
] as const

async function seedCities() {
  for (let i = 0; i < UZBEKISTAN_CITIES_SEED.length; i++) {
    const name = UZBEKISTAN_CITIES_SEED[i]
    await prisma.city.upsert({
      where: { name },
      update: { sortOrder: i },
      create: { name, sortOrder: i },
    })
  }
  console.log('✅ Cities seeded')
}

const WORK_TYPES_SEED = [
  { code: 'PLANNED_MAINTENANCE', nameRu: 'Плановое ТО', sortOrder: 0 },
  { code: 'DIAGNOSTICS', nameRu: 'Диагностика', sortOrder: 1 },
  { code: 'WARRANTY_REPAIR', nameRu: 'Гарантийный ремонт', sortOrder: 2 },
  { code: 'EMERGENCY', nameRu: 'Аварийный выезд', sortOrder: 3 },
  { code: 'INSTALLATION', nameRu: 'Монтаж', sortOrder: 4 },
  { code: 'COMMISSIONING', nameRu: 'Пусконаладка', sortOrder: 5 },
] as const

async function seedWorkTypes() {
  for (const wt of WORK_TYPES_SEED) {
    await prisma.workTypeRef.upsert({
      where: { code: wt.code },
      update: { nameRu: wt.nameRu, isSystem: true, sortOrder: wt.sortOrder, isActive: true },
      create: {
        code: wt.code,
        nameRu: wt.nameRu,
        isSystem: true,
        sortOrder: wt.sortOrder,
      },
    })
  }
  console.log('✅ Work types seeded')
}

type PermissionDef = {
  key: string
  category: 'section' | 'action' | 'field'
  label: string
  description?: string
}

const PERMISSIONS: PermissionDef[] = [
  { key: 'section:dashboard', category: 'section', label: 'Раздел Dashboard' },
  { key: 'section:clients', category: 'section', label: 'Раздел Клиенты' },
  { key: 'section:equipment', category: 'section', label: 'Раздел Оборудование' },
  { key: 'section:tasks', category: 'section', label: 'Раздел Задачи' },
  { key: 'section:reports', category: 'section', label: 'Раздел Отчёты' },
  { key: 'section:users', category: 'section', label: 'Раздел Пользователи' },
  { key: 'section:map', category: 'section', label: 'Раздел Карта' },
  { key: 'section:references', category: 'section', label: 'Раздел Справочники' },
  { key: 'section:account', category: 'section', label: 'Раздел Настройка аккаунта (профиль)' },
  {
    key: 'section:client_portal',
    category: 'section',
    label: 'Портал клиента (филиалы, объекты)',
  },
  { key: 'action:task.create', category: 'action', label: 'Создание задачи' },
  { key: 'action:task.assign', category: 'action', label: 'Назначение задачи' },
  { key: 'action:task.close', category: 'action', label: 'Закрытие задачи' },
  { key: 'action:equipment.create', category: 'action', label: 'Добавление оборудования' },
  { key: 'action:equipment.export', category: 'action', label: 'Экспорт оборудования' },
  { key: 'action:user.manage', category: 'action', label: 'Управление пользователями' },
  {
    key: 'action:act.clientSign',
    category: 'action',
    label: 'Подписание акта клиентом',
    description: 'Передача подписи в карточке задачи (клиентский портал)',
  },
  { key: 'field:user.phone', category: 'field', label: 'Поле Телефон пользователя' },
  { key: 'field:equipment.warranty', category: 'field', label: 'Поле Гарантия оборудования' },
  { key: 'field:task.internalComment', category: 'field', label: 'Внутренние комментарии задачи' },
]

const ROLE_ALLOWED: Record<string, Set<string>> = {
  ADMIN: new Set(PERMISSIONS.map((p) => p.key)),
  MANAGER: new Set([
    'section:dashboard',
    'section:clients',
    'section:equipment',
    'section:tasks',
    'section:reports',
    'section:map',
    'section:references',
    'section:account',
    'action:task.create',
    'action:task.assign',
    'action:equipment.create',
    'action:equipment.export',
    'field:user.phone',
    'field:equipment.warranty',
    'field:task.internalComment',
  ]),
  CHIEF_ENGINEER: new Set([
    'section:dashboard',
    'section:clients',
    'section:equipment',
    'section:tasks',
    'section:reports',
    'section:map',
    'section:account',
    'action:task.create',
    'action:task.assign',
    'action:task.close',
    'field:user.phone',
    'field:equipment.warranty',
    'field:task.internalComment',
  ]),
  ENGINEER: new Set([
    'section:dashboard',
    'section:equipment',
    'section:tasks',
    'section:account',
    'action:task.close',
    'field:equipment.warranty',
  ]),
  CLIENT: new Set([
    'section:client_portal',
    'section:equipment',
    'section:tasks',
    'section:account',
    'action:act.clientSign',
  ]),
}

async function seedRolePermissions() {
  for (const permission of PERMISSIONS) {
    const permissionId = `perm_${randomUUID()}`
    await prisma.$executeRaw`
      INSERT INTO "permissions" ("id", "key", "category", "label", "description", "createdAt")
      VALUES (${permissionId}, ${permission.key}, ${permission.category}, ${permission.label}, ${permission.description ?? null}, NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "category" = EXCLUDED."category",
          "label" = EXCLUDED."label",
          "description" = EXCLUDED."description"
    `
  }

  const permissionRows = (await prisma.$queryRaw`
    SELECT "id", "key" FROM "permissions"
  `) as Array<{ id: string; key: string }>

  const roles = ['ADMIN', 'MANAGER', 'CHIEF_ENGINEER', 'ENGINEER', 'CLIENT'] as const
  for (const role of roles) {
    const allowSet = ROLE_ALLOWED[role]
    for (const permission of permissionRows) {
      const allowed = allowSet.has(permission.key)
      const rolePermissionId = `rp_${randomUUID()}`
      await prisma.$executeRaw`
        INSERT INTO "role_permissions" ("id", "role", "permissionId", "allowed", "createdAt", "updatedAt")
        VALUES (${rolePermissionId}, CAST(${role} AS "Role"), ${permission.id}, ${allowed}, NOW(), NOW())
        ON CONFLICT ("role", "permissionId") DO UPDATE
        SET "allowed" = EXCLUDED."allowed",
            "updatedAt" = NOW()
      `
    }
  }
  console.log('✅ RBAC permissions seeded')
}

async function main() {
  console.log('Seeding database...')
  await seedCities()
  await seedWorkTypes()

  const hashedPassword = await bcrypt.hash('Admin123!', 10)
  const hashedPassword2 = await bcrypt.hash('Manager123!', 10)
  const hashedPassword3 = await bcrypt.hash('Engineer123!', 10)
  const hashedPasswordVimpel = await bcrypt.hash('2585058Dd!', 10)

  // Пользователи
  const admin = await prisma.user.upsert({
    where: { email: 'admin@csp.uz' },
    update: { password: hashedPassword },
    create: {
      login: 'admin',
      email: 'admin@csp.uz',
      password: hashedPassword,
      name: 'Администратор',
      role: 'ADMIN',
      phone: '+998901234567',
    },
  })

  const manager = await prisma.user.upsert({
    where: { email: 'manager@csp.uz' },
    update: { password: hashedPassword2 },
    create: {
      login: 'manager',
      email: 'manager@csp.uz',
      password: hashedPassword2,
      name: 'Алишер Каримов',
      role: 'MANAGER',
      phone: '+998901234568',
    },
  })

  const engineer1 = await prisma.user.upsert({
    where: { email: 'engineer1@csp.uz' },
    update: { password: hashedPassword3 },
    create: {
      login: 'engineer1',
      email: 'engineer1@csp.uz',
      password: hashedPassword3,
      name: 'Бобур Рахимов',
      role: 'ENGINEER',
      phone: '+998901234569',
    },
  })

  const engineer2 = await prisma.user.upsert({
    where: { email: 'engineer2@csp.uz' },
    update: { password: hashedPassword3 },
    create: {
      login: 'engineer2',
      email: 'engineer2@csp.uz',
      password: hashedPassword3,
      name: 'Жавлон Усманов',
      role: 'ENGINEER',
      phone: '+998901234570',
    },
  })

  const vimpel = await prisma.user.upsert({
    where: { email: 'makdastin@gmail.com' },
    update: { password: hashedPasswordVimpel },
    create: {
      login: 'vimpel94',
      email: 'makdastin@gmail.com',
      password: hashedPasswordVimpel,
      name: 'Администратор Vimpel',
      role: 'ADMIN',
      phone: '+998901234567',
    },
  })

  // Клиенты
  const client1 = await prisma.client.create({
    data: {
      name: 'ООО "Ташкент Текстиль"',
      inn: '123456789',
      contactPerson: 'Юсупов Акбар',
      phone: '+998712345678',
      email: 'akbar@textile.uz',
      status: 'VIP',
      city: 'Ташкент',
      comment: 'Крупный клиент, 3 производственных цеха',
    },
  })

  const client2 = await prisma.client.create({
    data: {
      name: 'АО "Самарканд Цемент"',
      inn: '987654321',
      contactPerson: 'Миrzaev Санжар',
      phone: '+998662345678',
      email: 'sanjarbek@cement.uz',
      status: 'STANDART',
      city: 'Самарканд',
    },
  })

  const client3 = await prisma.client.create({
    data: {
      name: 'ЧП "Фергана Пластик"',
      inn: '456789123',
      contactPerson: 'Хасанов Дилшод',
      phone: '+998732345678',
      email: 'dilshod@plastic.uz',
      status: 'PASSIVE',
      city: 'Фергана',
    },
  })

  // Филиалы
  const branch1 = await prisma.branch.create({
    data: {
      clientId: client1.id,
      name: 'Производственная площадка №1',
      address: 'г. Ташкент, Юнусабадский р-н, ул. Амира Темура 15',
      latitude: 41.3775,
      longitude: 69.2951,
      contactPerson: 'Каримов Санжар',
      workingHours: '24/7',
    },
  })

  const branch2 = await prisma.branch.create({
    data: {
      clientId: client2.id,
      name: 'Главный завод',
      address: 'г. Самарканд, ул. Промышленная 45',
      latitude: 39.6547,
      longitude: 66.9597,
      contactPerson: 'Тошматов Баходир',
      workingHours: '08:00-18:00',
    },
  })

  // Объекты
  const object1 = await prisma.object.create({
    data: {
      branchId: branch1.id,
      name: 'Компрессорная №1',
      description: 'Главная компрессорная станция, 3 компрессора',
    },
  })

  const object2 = await prisma.object.create({
    data: {
      branchId: branch1.id,
      name: 'Цех покраски',
      description: 'Покрасочный цех, требует сухого воздуха',
    },
  })

  const object3 = await prisma.object.create({
    data: {
      branchId: branch2.id,
      name: 'Дробильный цех',
      description: 'Основной производственный цех',
    },
  })

  // Оборудование
  const equipment1 = await prisma.equipment.create({
    data: {
      objectId: object1.id,
      type: 'COMPRESSOR',
      brand: 'AIR FORCE',
      model: 'AF-7.5',
      serialNumber: 'AF2021-001234',
      yearOfManufacture: 2021,
      installDate: new Date('2021-06-15'),
      warrantyUntil: new Date('2024-06-15'),
      currentHours: 8450,
      lastServiceHours: 8000,
      lastServiceDate: new Date('2024-02-10'),
      nextServiceHours: 10000,
      status: 'WORKING',
    },
  })

  const equipment2 = await prisma.equipment.create({
    data: {
      objectId: object1.id,
      type: 'COMPRESSOR',
      brand: 'Dalgakiran',
      model: 'COMPAKT 7',
      serialNumber: 'DG2022-005678',
      yearOfManufacture: 2022,
      installDate: new Date('2022-03-20'),
      warrantyUntil: new Date('2025-03-20'),
      currentHours: 4200,
      lastServiceHours: 4000,
      lastServiceDate: new Date('2024-03-01'),
      nextServiceHours: 6000,
      status: 'WORKING',
    },
  })

  const equipment3 = await prisma.equipment.create({
    data: {
      objectId: object2.id,
      type: 'DRYER',
      brand: 'Airpol',
      model: 'NRD-15',
      serialNumber: 'AP2020-009012',
      yearOfManufacture: 2020,
      installDate: new Date('2020-11-05'),
      warrantyUntil: new Date('2023-11-05'),
      currentHours: 14800,
      lastServiceHours: 12000,
      lastServiceDate: new Date('2023-08-15'),
      nextServiceHours: 14000,
      status: 'WORKING',
    },
  })

  const equipment4 = await prisma.equipment.create({
    data: {
      objectId: object3.id,
      type: 'COMPRESSOR',
      brand: 'AIR FORCE',
      model: 'AF-15',
      serialNumber: 'AF2023-003456',
      yearOfManufacture: 2023,
      installDate: new Date('2023-09-10'),
      warrantyUntil: new Date('2026-09-10'),
      currentHours: 2150,
      lastServiceHours: 2000,
      lastServiceDate: new Date('2024-04-01'),
      nextServiceHours: 4000,
      status: 'WORKING',
    },
  })

  // Задачи
  await prisma.serviceTask.create({
    data: {
      equipmentId: equipment1.id,
      createdById: manager.id,
      assignedToId: engineer1.id,
      type: 'PLANNED_MAINTENANCE',
      priority: 'HIGH',
      status: 'ASSIGNED',
      scheduledAt: new Date('2024-05-15'),
      comment: 'Плановое ТО 10000 м/ч. Заменить масло, фильтры, проверить ремень.',
    },
  })

  await prisma.serviceTask.create({
    data: {
      equipmentId: equipment3.id,
      createdById: manager.id,
      assignedToId: engineer2.id,
      type: 'PLANNED_MAINTENANCE',
      priority: 'EMERGENCY',
      status: 'NEW',
      scheduledAt: new Date('2024-05-10'),
      comment: 'ТО просрочено! Осушитель Airpol NRD-15 превысил 14000 м/ч.',
    },
  })

  await prisma.serviceTask.create({
    data: {
      equipmentId: equipment2.id,
      createdById: manager.id,
      type: 'DIAGNOSTICS',
      priority: 'MEDIUM',
      status: 'NEW',
      scheduledAt: new Date('2024-05-20'),
      comment: 'Клиент сообщает о повышенном шуме при запуске.',
    },
  })

  const brands = [
    'AIR FORCE', 'Dalgakiran', 'Airpol', 'Epsea',
    'Atlas Copco', 'Kaeser', 'CompAir', 'Boge',
    'Fini', 'Abac', 'Chicago Pneumatic', 'Gardner Denver',
    'Ingersoll Rand', 'Sullair', 'Quincy', 'Doosan',
    'COMARO', 'REMEZA', 'Ceccato', 'Mattei',
  ]
  for (const name of brands) {
    await prisma.equipmentBrandRef.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log('✅ Brands seeded')

  const equipmentTypes = [
    { name: 'COMPRESSOR', nameRu: 'Компрессор', isSystem: true },
    { name: 'DRYER', nameRu: 'Осушитель', isSystem: true },
    { name: 'RECEIVER', nameRu: 'Ресивер', isSystem: true },
    { name: 'FILTER', nameRu: 'Фильтр', isSystem: true },
    { name: 'NITROGEN_GENERATOR', nameRu: 'Азотный генератор', isSystem: true },
  ]
  for (const type of equipmentTypes) {
    await prisma.equipmentTypeRef.upsert({
      where: { name: type.name },
      update: { nameRu: type.nameRu, isSystem: type.isSystem, isActive: true },
      create: type,
    })
  }
  console.log('✅ Equipment types seeded')

  const reg1 = await prisma.maintenanceRegulation.upsert({
    where: { id: 'reg-planned-2000' },
    update: {},
    create: {
      id: 'reg-planned-2000',
      name: 'Плановое ТО каждые 2000 м/ч',
      equipmentType: 'COMPRESSOR',
      intervalHours: 2000,
      taskType: 'PLANNED_MAINTENANCE',
      description: 'Стандартное плановое обслуживание винтового компрессора',
    }
  })

  await prisma.maintenanceRegulationItem.deleteMany({ where: { regulationId: reg1.id } })
  const checklistItems2000 = [
    'Проверено общее состояние компрессора',
    'Проверен уровень масла',
    'Проверена рабочая температура',
    'Проверено рабочее давление',
    'Проверены утечки воздуха',
    'Проверены утечки масла',
    'Заменён воздушный фильтр',
    'Заменён масляный фильтр',
    'Заменено масло',
    'Радиатор очищен/продут',
    'Проверен ремень/муфта',
    'Проверена электрика и клеммы',
    'Проверены ошибки контроллера',
    'Сервисный счётчик сброшен',
    'Компрессор запущен и проверен под нагрузкой',
  ]
  for (let i = 0; i < checklistItems2000.length; i++) {
    await prisma.maintenanceRegulationItem.create({
      data: { regulationId: reg1.id, label: checklistItems2000[i], order: i }
    })
  }

  const reg2 = await prisma.maintenanceRegulation.upsert({
    where: { id: 'reg-diagnostics' },
    update: {},
    create: {
      id: 'reg-diagnostics',
      name: 'Диагностика',
      equipmentType: 'COMPRESSOR',
      intervalHours: 0,
      taskType: 'DIAGNOSTICS',
      description: 'Диагностика неисправностей',
    }
  })

  await prisma.maintenanceRegulationItem.deleteMany({ where: { regulationId: reg2.id } })
  const checklistDiag = [
    'Проверены коды ошибок контроллера',
    'Измерена температура масла',
    'Измерено рабочее давление',
    'Проверена система охлаждения',
    'Проверены электрические соединения',
    'Проверен ремень/муфта',
    'Составлен акт диагностики',
  ]

  for (let i = 0; i < checklistDiag.length; i++) {
    await prisma.maintenanceRegulationItem.create({
      data: { regulationId: reg2.id, label: checklistDiag[i], order: i }
    })
  }

  const reg3 = await prisma.maintenanceRegulation.upsert({
    where: { id: 'reg-emergency' },
    update: {},
    create: {
      id: 'reg-emergency',
      name: 'Аварийный выезд',
      equipmentType: 'COMPRESSOR',
      intervalHours: 0,
      taskType: 'EMERGENCY',
      description: 'Устранение аварийной неисправности',
    }
  })

  await prisma.maintenanceRegulationItem.deleteMany({ where: { regulationId: reg3.id } })
  const checklistEmergency = [
    'Выявлена причина аварии',
    'Оборудование остановлено безопасно',
    'Неисправность устранена',
    'Проведена проверка после ремонта',
    'Оборудование запущено в работу',
    'Составлен акт аварийного ремонта',
  ]

  for (let i = 0; i < checklistEmergency.length; i++) {
    await prisma.maintenanceRegulationItem.create({
      data: { regulationId: reg3.id, label: checklistEmergency[i], order: i }
    })
  }

  console.log('✅ Regulations seeded')
  await seedRolePermissions()

  console.log('✅ Seed completed!')
  console.log(`Created: 4 users, 3 clients, 2 branches, 3 objects, 4 equipment, 3 tasks`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
