'use client'

// Loaded client-side only via next/dynamic ssr:false
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { ZONE_COLORS } from '@/lib/constants'

const GUWAHATI: [number, number] = [26.1445, 91.7362]

// Build a small colored circle icon for each zone
function pullerDotIcon(zoneNumber: number): L.DivIcon {
  const hex = ZONE_COLORS[zoneNumber]?.hex ?? '#888888'
  return L.divIcon({
    html: `<div style="
      width:13px;height:13px;
      background:${hex};border-radius:50%;
      border:2px solid rgba(255,255,255,0.85);
      box-shadow:0 0 7px ${hex}99;
    "></div>`,
    className: '',
    iconSize:   [13, 13],
    iconAnchor: [6,  6],
  })
}

const passengerDotIcon = L.divIcon({
  html: `<div style="
    width:10px;height:10px;
    background:#3B82F6;border-radius:50%;
    border:1.5px solid rgba(255,255,255,0.85);
    box-shadow:0 0 6px rgba(59,130,246,0.75);
  "></div>`,
  className: '',
  iconSize:   [10, 10],
  iconAnchor: [5,  5],
})

export interface AdminMapProps {
  pullers:    { id: string; lat: number; lng: number; zoneNumber: number }[]
  passengers: { id: string; lat: number; lng: number }[]
}

export default function AdminMap({ pullers, passengers }: AdminMapProps) {
  return (
    <MapContainer
      center={GUWAHATI}
      zoom={12}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* Online puller dots — colored by zone */}
      {pullers.map((p) => (
        <Marker
          key={`p-${p.id}`}
          position={[p.lat, p.lng]}
          icon={pullerDotIcon(p.zoneNumber)}
          alt={`Puller ${p.id}`}
          keyboard={true}
          ref={(m) => m?.getElement()?.setAttribute('aria-label', `Puller ${p.id}`)}
        />
      ))}

      {/* Active ride passenger dots — blue */}
      {passengers.map((r) => (
        <Marker
          key={`r-${r.id}`}
          position={[r.lat, r.lng]}
          icon={passengerDotIcon}
          alt={`Passenger ${r.id}`}
          keyboard={true}
          ref={(m) => m?.getElement()?.setAttribute('aria-label', `Passenger ${r.id}`)}
        />
      ))}
    </MapContainer>
  )
}
