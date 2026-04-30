export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CHIEF_ENGINEER = 'CHIEF_ENGINEER',
  ENGINEER = 'ENGINEER',
  CLIENT = 'CLIENT',
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Администратор',
  [Role.MANAGER]: 'Менеджер',
  [Role.CHIEF_ENGINEER]: 'Главный инженер',
  [Role.ENGINEER]: 'Инженер',
  [Role.CLIENT]: 'Клиент',
}

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  [Role.ADMIN]: ['*'],
  [Role.MANAGER]: ['clients:read', 'clients:write', 'tasks:read', 'tasks:write', 'equipment:read', 'reports:read'],
  [Role.CHIEF_ENGINEER]: ['tasks:read', 'tasks:write', 'tasks:assign', 'equipment:read', 'reports:read'],
  [Role.ENGINEER]: ['tasks:own', 'equipment:read'],
  [Role.CLIENT]: ['own:read'],
}
