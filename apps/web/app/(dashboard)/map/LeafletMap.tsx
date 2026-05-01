'use client'
import { useEffect, useRef } from 'react'

const CITY_COORDS: Record<string, [number, number]> = {
  'Ташкент':    [41.2995, 69.2401],
  'Самарканд':  [39.6547, 66.9597],
  'Наманган':   [41.0011, 71.6722],
  'Андижан':    [40.7821, 72.3442],
  'Фергана':    [40.3842, 71.7843],
  'Нукус':      [42.4619, 59.6166],
  'Карши':      [38.8571, 65.7911],
  'Бухара':     [39.7747, 64.4286],
  'Навои':      [40.1000, 65.3667],
  'Термез':     [37.2242, 67.2783],
  'Коканд':     [40.5283, 70.9425],
  'Маргилан':   [40.4714, 71.7239],
  'Ургенч':     [41.5500, 60.6333],
  'Хива':       [41.3783, 60.3622],
  'Зарафшан':   [41.5636, 64.2097],
  'Джизак':     [40.1158, 67.8422],
  'Гулистан':   [40.4897, 68.7839],
  'Янгиюль':    [41.1108, 69.0486],
  'Чирчик':     [41.4686, 69.5811],
  'Алмалык':    [40.8436, 69.5981],
  'Ангрен':     [41.0167, 70.1500],
  'Бекабад':    [40.2214, 69.2647],
}

interface Props {
  cityData: any[]
  branchPoints: any[]
  onCityClick: (data: any) => void
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
        const coords = CITY_COORDS[data.city]
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

      branchPoints.forEach((point: any) => {
        if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') return
        const marker = L.marker([point.latitude, point.longitude]).addTo(map)
        marker.bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:210px">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px">📌 ${point.name}</div>
            <div style="font-size:12px;color:#374151;margin-bottom:4px">${point.clientName}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:6px">${point.address || 'Адрес не указан'}</div>
            <div style="font-size:11px;color:#6b7280">${point.equipmentCount} ед. оборудования</div>
          </div>
        `)
      })
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
