/** Фазы окна технических работ (по времени сервера / БД). */
export type MaintenancePhase = 'none' | 'announce' | 'warning' | 'blocked'

export type MaintenanceRow = {
  maintenanceStart: Date | null
  maintenanceEnd: Date | null
  maintenanceMessage: string | null
}

export type MaintenancePublicState = {
  phase: MaintenancePhase
  start: Date | null
  end: Date | null
  message: string | null
}

const THIRTY_MIN_MS = 30 * 60 * 1000

/** План считается действительным только если заданы оба конца и конец в будущем. */
export function computeMaintenanceState(now: Date, row: MaintenanceRow | null): MaintenancePublicState {
  if (!row) return { phase: 'none', start: null, end: null, message: null }
  const s = row.maintenanceStart
  const e = row.maintenanceEnd
  const msg = row.maintenanceMessage?.trim() ? row.maintenanceMessage : null
  if (!s || !e) return { phase: 'none', start: null, end: null, message: null }
  if (e.getTime() <= now.getTime()) return { phase: 'none', start: null, end: null, message: null }
  if (now.getTime() >= s.getTime() && now.getTime() < e.getTime()) {
    return { phase: 'blocked', start: s, end: e, message: msg }
  }
  if (now.getTime() < s.getTime()) {
    if (now.getTime() >= s.getTime() - THIRTY_MIN_MS) {
      return { phase: 'warning', start: s, end: e, message: msg }
    }
    return { phase: 'announce', start: s, end: e, message: msg }
  }
  return { phase: 'none', start: null, end: null, message: null }
}
