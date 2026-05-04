import { browserSupportsWebAuthn } from '@simplewebauthn/browser'

/** Встроенный WebView на Android почти всегда помечается `; wv)` в User-Agent. */
function looksLikeAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false
  return /\bwv\b/i.test(navigator.userAgent) || /; wv\)/i.test(navigator.userAgent)
}

/** Похоже на встроенный браузер приложений (часто без полноценного WebAuthn). */
function looksLikeInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    looksLikeAndroidWebView() ||
    /Instagram/i.test(ua) ||
    /FBAN|FBAV/i.test(ua) ||
    /Line\//i.test(ua) ||
    /Telegram/i.test(ua) ||
    /Twitter/i.test(ua) ||
    /Snapchat/i.test(ua)
  )
}

/**
 * Та же логика, что у @simplewebauthn/browser перед startRegistration(),
 * плюс эвристики для мобильных WebView / in-app.
 */
export function getWebAuthnUnsupportedReason(): string | null {
  if (typeof window === 'undefined') return null

  if (!window.isSecureContext) {
    return 'Нужен защищённый доступ: откройте сайт по HTTPS (или http://localhost). По IP в локальной сети без HTTPS WebAuthn не работает.'
  }

  if (looksLikeInAppBrowser()) {
    return 'Похоже, страница открыта во встроенном браузере приложения. На телефоне: нажмите «⋯» / «⋮» вверху → «Открыть в Chrome» / «В браузере», либо скопируйте адрес и вставьте в Chrome или Samsung Internet. Face ID внутри Telegram / Instagram / VK обычно не работает.'
  }

  if (!browserSupportsWebAuthn()) {
    return 'WebAuthn в этом окне недоступен (нет PublicKeyCredential). Установите или обновите Chrome / Samsung Internet, откройте сайт напрямую по https://…'
  }

  if (!navigator.credentials || typeof navigator.credentials.create !== 'function') {
    return 'Браузер не предоставляет credentials API. Обновите браузер или откройте страницу в Chrome.'
  }

  return null
}

export function isWebAuthnAvailable(): boolean {
  return getWebAuthnUnsupportedReason() === null
}
