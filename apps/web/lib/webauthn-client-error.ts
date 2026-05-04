function messageFromUnknown(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return ''
}

function translateKnownWebAuthnEnglish(msg: string): string | null {
  if (/webauthn is not supported/i.test(msg) || /not supported in this browser/i.test(msg)) {
    return 'WebAuthn недоступен в этом браузере. На телефоне: Chrome или Samsung Internet по HTTPS; из мессенджера — «Открыть в браузере».'
  }
  return null
}

/** Человекочитаемое сообщение об ошибке WebAuthn в браузере. */
export function webAuthnUserVisibleError(err: unknown): string {
  const name =
    err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : ''

  if (name === 'NotAllowedError') {
    return 'Операция отменена или устройство не предложило биометрию. Попробуйте снова.'
  }
  if (name === 'SecurityError') {
    return 'Ошибка безопасности WebAuthn (часто неверный домен или не HTTPS). Откройте сайт в обычном браузере, не во встроенном приложении.'
  }
  if (name === 'InvalidStateError') {
    return 'Ключ уже используется или недоступен. Удалите старый ключ или попробуйте другой способ входа.'
  }
  if (name === 'NotSupportedError' || name === 'AbortError') {
    return 'Браузер или устройство не поддерживают этот способ биометрии.'
  }

  const msg = messageFromUnknown(err)
  if (msg) {
    const t = translateKnownWebAuthnEnglish(msg)
    if (t) return t
    return msg
  }

  return 'Не удалось выполнить запрос к устройству. Нужны HTTPS (или localhost) и доступ к биометрии в обычном браузере.'
}
