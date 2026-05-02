/** Координаты для подписи городов на карте и привязки филиалов к региону */
export const MAP_CITY_COORDS: Record<string, [number, number]> = {
  Ташкент: [41.2995, 69.2401],
  Самарканд: [39.6547, 66.9597],
  Наманган: [41.0011, 71.6722],
  Андижан: [40.7821, 72.3442],
  Фергана: [40.3842, 71.7843],
  Нукус: [42.4619, 59.6166],
  Карши: [38.8571, 65.7911],
  Бухара: [39.7747, 64.4286],
  Навои: [40.1, 65.3667],
  Термез: [37.2242, 67.2783],
  Коканд: [40.5283, 70.9425],
  Маргилан: [40.4714, 71.7239],
  Ургенч: [41.55, 60.6333],
  Хива: [41.3783, 60.3622],
  Зарафшан: [41.5636, 64.2097],
  Джизак: [40.1158, 67.8422],
  Гулистан: [40.4897, 68.7839],
  Янгиюль: [41.1108, 69.0486],
  Чирчик: [41.4686, 69.5811],
  Алмалык: [40.8436, 69.5981],
  Ангрен: [41.0167, 70.15],
  Бекабад: [40.2214, 69.2647],
}

/** Ближайший город из справочника (для группировки филиалов с GPS) */
export function nearestMapCityName(lat: number, lng: number): string {
  let best = 'Не указан'
  let bestD = Infinity
  for (const [name, [clat, clng]] of Object.entries(MAP_CITY_COORDS)) {
    const d = (lat - clat) ** 2 + (lng - clng) ** 2
    if (d < bestD) {
      bestD = d
      best = name
    }
  }
  return best
}

export function parseBranchCoords(
  latitude: unknown,
  longitude: unknown
): { lat: number; lng: number } | null {
  const lat = typeof latitude === 'number' ? latitude : Number(latitude)
  const lng = typeof longitude === 'number' ? longitude : Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
