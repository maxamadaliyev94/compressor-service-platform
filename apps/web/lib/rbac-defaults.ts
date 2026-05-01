export type PermissionCategory = 'section' | 'action' | 'field'

export type PermissionDef = {
  key: string
  category: PermissionCategory
  label: string
  description?: string
}

export const PERMISSION_DEFINITIONS: PermissionDef[] = [
  { key: 'section:dashboard', category: 'section', label: 'Раздел Dashboard' },
  { key: 'section:clients', category: 'section', label: 'Раздел Клиенты' },
  { key: 'section:equipment', category: 'section', label: 'Раздел Оборудование' },
  { key: 'section:tasks', category: 'section', label: 'Раздел Задачи' },
  { key: 'section:reports', category: 'section', label: 'Раздел Отчёты' },
  { key: 'section:users', category: 'section', label: 'Раздел Пользователи' },
  { key: 'section:map', category: 'section', label: 'Раздел Карта' },
  { key: 'section:references', category: 'section', label: 'Раздел Справочники' },
  { key: 'action:task.create', category: 'action', label: 'Создание задачи' },
  { key: 'action:task.assign', category: 'action', label: 'Назначение задачи' },
  { key: 'action:task.close', category: 'action', label: 'Закрытие задачи' },
  { key: 'action:equipment.create', category: 'action', label: 'Добавление оборудования' },
  { key: 'action:equipment.export', category: 'action', label: 'Экспорт оборудования' },
  { key: 'action:user.manage', category: 'action', label: 'Управление пользователями' },
  { key: 'field:user.phone', category: 'field', label: 'Поле Телефон пользователя' },
  { key: 'field:equipment.warranty', category: 'field', label: 'Поле Гарантия оборудования' },
  { key: 'field:task.internalComment', category: 'field', label: 'Внутренние комментарии задачи' },
]

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSION_DEFINITIONS.map((p) => p.key),
  MANAGER: [
    'section:dashboard',
    'section:clients',
    'section:equipment',
    'section:tasks',
    'section:reports',
    'section:map',
    'section:references',
    'action:task.create',
    'action:task.assign',
    'action:equipment.create',
    'action:equipment.export',
    'field:user.phone',
    'field:equipment.warranty',
    'field:task.internalComment',
  ],
  CHIEF_ENGINEER: [
    'section:dashboard',
    'section:equipment',
    'section:tasks',
    'section:reports',
    'section:map',
    'action:task.create',
    'action:task.assign',
    'action:task.close',
    'field:user.phone',
    'field:equipment.warranty',
    'field:task.internalComment',
  ],
  ENGINEER: [
    'section:dashboard',
    'section:equipment',
    'section:tasks',
    'action:task.close',
    'field:equipment.warranty',
  ],
  CLIENT: [],
}
