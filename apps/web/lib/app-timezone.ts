/** Часовой пояс для отображения слотов ТО и баннеров (по умолчанию — Узбекистан). */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'Asia/Tashkent'

export function formatTimeHHMM(d: Date, timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
