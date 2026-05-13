export type DeviceKind = 'mobile' | 'tablet' | 'desktop' | 'unknown'

export function parseUserAgentHints(ua: string | null | undefined): {
  deviceType: DeviceKind
  browserName: string
} {
  if (!ua || !ua.trim()) return { deviceType: 'unknown', browserName: '—' }
  const s = ua
  let deviceType: DeviceKind = 'desktop'
  if (/tablet|ipad|playbook|silk/i.test(s)) deviceType = 'tablet'
  else if (/mobile|iphone|ipod|android.*mobile|webos|blackberry|opera mini|iemobile/i.test(s))
    deviceType = 'mobile'

  let browserName = 'Другой'
  if (/edg/i.test(s)) browserName = 'Edge'
  else if (/opr\//i.test(s) || /opera/i.test(s)) browserName = 'Opera'
  else if (/chrome|crios/i.test(s)) browserName = 'Chrome'
  else if (/firefox|fxios/i.test(s)) browserName = 'Firefox'
  else if (/safari/i.test(s) && !/chrome/i.test(s)) browserName = 'Safari'

  return { deviceType, browserName }
}

export function deviceTypeLabel(d: DeviceKind | string | null | undefined): string {
  switch (d) {
    case 'mobile':
      return 'Телефон'
    case 'tablet':
      return 'Планшет'
    case 'desktop':
      return 'Компьютер'
    default:
      return 'Неизвестно'
  }
}
