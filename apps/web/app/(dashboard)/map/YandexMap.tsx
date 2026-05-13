'use client'

import { useEffect, useRef } from 'react'
import { MAP_CITY_COORDS } from '@/lib/mapCities'

interface Props {
  cityData: any[]
  branchPoints: any[]
  onCityClick: (data: any) => void
  apiKey: string
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function branchPopupHtml(point: any): string {
  const items: { id: string; brand: string; model: string; serialNumber: string }[] = Array.isArray(point.equipment)
    ? point.equipment
    : []
  const listHtml =
    items.length === 0
      ? `<div style="font-size:11px;color:#9ca3af;margin-top:6px">Оборудование на этой площадке не добавлено</div>`
      : `<div style="margin-top:8px;border-top:1px solid #e5e7eb;padding-top:8px">
          <div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:6px">Оборудование (${items.length})</div>
          ${items
            .map(
              (eq) => `
            <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #f3f4f6;line-height:1.35">
              <div style="font-size:12px;font-weight:600;color:#111827">${escHtml(eq.brand)} ${escHtml(eq.model)}</div>
              <div style="font-size:11px;color:#6b7280">Серийный № ${escHtml(eq.serialNumber)}</div>
              <a href="/equipment/${encodeURIComponent(eq.id)}" style="font-size:11px;color:#2563eb;text-decoration:none;margin-top:2px;display:inline-block">Открыть карточку →</a>
            </div>`
            )
            .join('')}
        </div>`

  return `
          <div style="font-family:system-ui,sans-serif;min-width:220px;max-width:280px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">📌 ${escHtml(point.name)}</div>
            <div style="font-size:12px;color:#374151;margin-bottom:4px">${escHtml(point.clientName)}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px">${escHtml(point.address || 'Адрес не указан')}</div>
            <div style="font-size:11px;color:#6b7280">${point.equipmentCount ?? items.length} ед. оборудования</div>
            ${listHtml}
          </div>
        `
}

function cityBalloonBody(data: any): string {
  const clientsBlock = data.clients
    .map(
      (c: any) => `
                <div style="margin-bottom:4px">
                  <div style="font-size:13px;font-weight:500">${escHtml(c.name)}</div>
                  ${c.contactPerson ? `<div style="font-size:11px;color:#9ca3af">${escHtml(c.contactPerson)}</div>` : ''}
                </div>`
    )
    .join('')
  return `
            <div style="color:#6b7280;font-size:12px;margin-bottom:8px">
              ${data.total} клиентов · ${data.equipment} ед. оборудования
            </div>
            <div style="border-top:1px solid #e5e7eb;padding-top:8px">
              ${clientsBlock}
            </div>
          `
}

let ymapsScriptPromise: Promise<void> | null = null

function loadYandexMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  const w = window as unknown as { ymaps?: { ready: (cb: () => void) => void } }
  if (w.ymaps) {
    return new Promise((resolve) => {
      w.ymaps!.ready(() => resolve())
    })
  }
  if (ymapsScriptPromise) return ymapsScriptPromise

  ymapsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-yandex-maps-api="2.1"]')
    if (existing) {
      const wait = () => {
        if ((window as unknown as { ymaps?: unknown }).ymaps) {
          ;((window as unknown as { ymaps: { ready: (cb: () => void) => void } }).ymaps as { ready: (cb: () => void) => void }).ready(
            () => resolve()
          )
        } else setTimeout(wait, 30)
      }
      wait()
      return
    }
    const s = document.createElement('script')
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`
    s.async = true
    s.dataset.yandexMapsApi = '2.1'
    s.onload = () => {
      const y = (window as unknown as { ymaps?: { ready: (cb: () => void) => void } }).ymaps
      if (y) y.ready(() => resolve())
      else reject(new Error('ymaps not available'))
    }
    s.onerror = () => reject(new Error('Yandex Maps script failed to load'))
    document.head.appendChild(s)
  })

  return ymapsScriptPromise
}

export default function YandexMap({ cityData, branchPoints, onCityClick, apiKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<{ destroy: () => void } | null>(null)
  const maxClients = Math.max(...cityData.map((c: any) => c.total), 1)

  useEffect(() => {
    if (!apiKey?.trim() || !containerRef.current) return

    let cancelled = false

    loadYandexMapsScript(apiKey.trim())
      .then(() => {
        if (cancelled || !containerRef.current) return
        const w = window as unknown as {
          ymaps: {
            ready: (cb: () => void) => void
            Map: new (
              el: HTMLElement,
              state: { center: number[]; zoom: number; controls?: string[] },
              options?: Record<string, unknown>
            ) => {
              destroy: () => void
              geoObjects: {
                add: (o: unknown) => void
                getBounds?: () => number[][] | null
              }
              setCenter: (c: number[], z: number) => void
              setBounds: (b: number[][], opts?: Record<string, unknown>) => void
            }
            Circle: new (
              geometry: number[][] | [number[], number],
              properties?: Record<string, string>,
              options?: Record<string, string | number>
            ) => {
              events: { add: (ev: string, fn: () => void) => void }
              balloon: { open: () => void }
            }
            Placemark: new (
              geometry: number[],
              properties?: Record<string, string>,
              options?: Record<string, string | number | boolean>
            ) => unknown
            util?: { bounds?: { fromPoints: (pts: number[][]) => number[][] } }
          }
        }

        w.ymaps.ready(() => {
          if (cancelled || !containerRef.current) return

          if (mapRef.current) {
            mapRef.current.destroy()
            mapRef.current = null
          }

          const map = new w.ymaps.Map(
            containerRef.current,
            {
              center: [41.31, 69.28],
              zoom: 6,
              controls: ['zoomControl', 'fullscreenControl'],
            },
            { suppressMapOpenBlock: true }
          )
          mapRef.current = map

          const boundsPoints: number[][] = []

          cityData.forEach((data: any) => {
            const coords = MAP_CITY_COORDS[data.city]
            if (!coords) return
            const [lat, lng] = coords
            boundsPoints.push([lat, lng])

            const radiusMeters = 6000 + (data.total / maxClients) * 42000
            const circle = new w.ymaps.Circle(
              [[lat, lng], radiusMeters],
              {
                balloonContentHeader: `📍 ${escHtml(data.city)}`,
                balloonContentBody: cityBalloonBody(data),
              },
              {
                fillColor: '#2563EB',
                fillOpacity: 0.78,
                strokeColor: '#ffffff',
                strokeWidth: 2,
                strokeOpacity: 1,
              }
            )
            circle.events.add('click', () => {
              onCityClick(data)
              circle.balloon.open()
            })
            map.geoObjects.add(circle)

            const caption = new w.ymaps.Placemark(
              [lat, lng],
              { iconCaption: `${data.city} (${data.total})` },
              {
                preset: 'islands#blueCircleDotIcon',
                iconCaptionMaxWidth: 240,
                zIndex: 650,
              }
            )
            ;(caption as { options: { set: (k: string, v: boolean) => void } }).options.set('interactive', false)
            map.geoObjects.add(caption)
          })

          branchPoints.forEach((point: any) => {
            const lat = Number(point.latitude)
            const lng = Number(point.longitude)
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
            boundsPoints.push([lat, lng])
            const pm = new w.ymaps.Placemark(
              [lat, lng],
              {
                balloonContentHeader: `📌 ${escHtml(point.name)}`,
                balloonContentBody: branchPopupHtml(point),
              },
              { preset: 'islands#blueIcon' }
            )
            ;(pm as { options: { set: (k: string, v: number) => void } }).options.set('balloonMaxWidth', 300)
            ;(pm as { options: { set: (k: string, v: number) => void } }).options.set('balloonMaxHeight', 360)
            map.geoObjects.add(pm)
          })

          if (boundsPoints.length === 1) {
            map.setCenter(boundsPoints[0], 10)
          } else if (boundsPoints.length > 1) {
            const fromPoints = w.ymaps.util?.bounds?.fromPoints
            if (typeof fromPoints === 'function') {
              map.setBounds(fromPoints(boundsPoints), { checkZoomRange: true, zoomMargin: 48 })
            } else {
              const lats = boundsPoints.map((p) => p[0])
              const lngs = boundsPoints.map((p) => p[1])
              map.setBounds(
                [
                  [Math.min(...lats), Math.min(...lngs)],
                  [Math.max(...lats), Math.max(...lngs)],
                ],
                { checkZoomRange: true, zoomMargin: 48 }
              )
            }
          }
        })
      })
      .catch(() => {
        /* карта не инициализируется — ключ или сеть */
      })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [cityData, branchPoints, maxClients, onCityClick, apiKey])

  if (!apiKey?.trim()) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 text-sm text-gray-500 px-4 text-center">
        Не задан ключ{' '}
        <code className="text-xs bg-gray-100 px-1 rounded mx-1">YANDEX_MAPS_API_KEY</code> — добавьте его в переменные окружения
        сервера и перезапустите приложение.
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full" style={{ minHeight: '100%' }} />
}
