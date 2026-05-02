'use client'
import { useEffect, useRef } from 'react'
import { MAP_CITY_COORDS } from '@/lib/mapCities'

interface Props {
  cityData: any[]
  branchPoints: any[]
  onCityClick: (data: any) => void
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

export default function LeafletMap({ cityData, branchPoints, onCityClick }: Props) {
  const mapRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const maxClients = Math.max(...cityData.map((c: any) => c.total), 1)

  useEffect(() => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    let map: any = null

    const init = async () => {
      const L = (await import('leaflet')).default

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!containerRef.current) return
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }

      map = L.map(containerRef.current, {
        center: [40.5, 64.5],
        zoom: 6,
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        touchZoom: true,
      })

      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map)

      cityData.forEach((data: any) => {
        const coords = MAP_CITY_COORDS[data.city]
        if (!coords) return

        const radius = 8 + (data.total / maxClients) * 20

        const circle = L.circleMarker(coords, {
          radius,
          fillColor: '#2563EB',
          color: 'white',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
          interactive: true,
        }).addTo(map)

        const label = L.divIcon({
          className: '',
          html: `<div style="
            background:white;
            border:1px solid #e5e7eb;
            border-radius:4px;
            padding:2px 6px;
            font-size:11px;
            font-weight:600;
            color:#374151;
            white-space:nowrap;
            box-shadow:0 1px 3px rgba(0,0,0,0.1);
            margin-top:${radius + 4}px;
            transform:translateX(-50%);
          ">${data.city} (${data.total})</div>`,
          iconAnchor: [0, 0],
        })
        L.marker(coords, { icon: label, interactive: false }).addTo(map)

        circle.bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px">📍 ${data.city}</div>
            <div style="color:#6b7280;font-size:12px;margin-bottom:8px">
              ${data.total} клиентов · ${data.equipment} ед. оборудования
            </div>
            <div style="border-top:1px solid #e5e7eb;padding-top:8px">
              ${data.clients.map((c: any) => `
                <div style="margin-bottom:4px">
                  <div style="font-size:13px;font-weight:500">${c.name}</div>
                  ${c.contactPerson ? `<div style="font-size:11px;color:#9ca3af">${c.contactPerson}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `, { maxWidth: 250 })

        circle.on('click', () => {
          onCityClick(data)
          circle.openPopup()
        })
      })

      const boundsPoints: [number, number][] = []

      branchPoints.forEach((point: any) => {
        const lat = Number(point.latitude)
        const lng = Number(point.longitude)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        boundsPoints.push([lat, lng])
        const marker = L.marker([lat, lng]).addTo(map)
        marker.bindPopup(branchPopupHtml(point), { maxWidth: 300, maxHeight: 340, className: 'branch-detail-popup' })
      })

      cityData.forEach((data: any) => {
        const coords = MAP_CITY_COORDS[data.city]
        if (coords) boundsPoints.push([coords[0], coords[1]])
      })

      if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], 10)
      } else if (boundsPoints.length > 1) {
        const b = L.latLngBounds(boundsPoints)
        if (b.isValid()) {
          map.fitBounds(b, { padding: [48, 48], maxZoom: 9 })
        }
      }
    }

    init()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [cityData, branchPoints, maxClients, onCityClick])

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%', zIndex: 0 }}
    />
  )
}
