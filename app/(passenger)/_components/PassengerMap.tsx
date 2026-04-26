'use client'

// ── This file is ONLY loaded client-side (imported via next/dynamic ssr:false)
// ── It is safe to call L.* at module level here.
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, ZoomControl, useMap } from 'react-leaflet'
import { useEffect } from 'react'

// ─── Guwahati city center ─────────────────────────────────────────────────────
export const GUWAHATI: [number, number] = [26.1445, 91.7362]

// ─── Custom icons ────────────────────────────────────────────────────────────

const passengerIcon = L.divIcon({
  html: `
    <div style="
      position:relative;width:22px;height:22px;
      background:#3B82F6;border-radius:50%;
      border:3px solid #fff;
      box-shadow:0 0 0 4px rgba(59,130,246,0.30),0 2px 10px rgba(59,130,246,0.55);
    "></div>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const pullerIcon = L.divIcon({
  html: `
    <div style="
      width:38px;height:38px;
      background:#F59E0B;border-radius:50%;
      border:2.5px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:20px;line-height:1;
      box-shadow:0 3px 16px rgba(245,158,11,0.60);
    ">🛺</div>`,
  className: '',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
})

// ─── Map re-center on position change ────────────────────────────────────────

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true })
  }, [map, lat, lng])
  return null
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnlinePuller {
  id: string
  lat: number | null
  lng: number | null
}

export interface PassengerMapProps {
  passengerPos: [number, number] | null
  pullers: OnlinePuller[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PassengerMap({ passengerPos, pullers }: PassengerMapProps) {
  return (
    <MapContainer
      center={passengerPos ?? GUWAHATI}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
      />
      <ZoomControl position="bottomright" />

      {/* Passenger blue dot */}
      {passengerPos && (
        <>
          <Recenter lat={passengerPos[0]} lng={passengerPos[1]} />
          <Marker position={passengerPos} icon={passengerIcon} />
        </>
      )}

      {/* Online puller markers */}
      {pullers.map((p) =>
        p.lat != null && p.lng != null ? (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pullerIcon} />
        ) : null
      )}
    </MapContainer>
  )
}
