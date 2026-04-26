'use client'

// Only loaded client-side via next/dynamic ssr:false
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { useEffect } from 'react'

const GUWAHATI: [number, number] = [26.1445, 91.7362]

const passengerIcon = L.divIcon({
  html: `<div style="
    width:18px;height:18px;
    background:#3B82F6;border-radius:50%;
    border:2.5px solid #fff;
    box-shadow:0 0 0 4px rgba(59,130,246,0.28),0 2px 8px rgba(59,130,246,0.5);
  "></div>`,
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

const pullerIcon = L.divIcon({
  html: `<div style="
    width:36px;height:36px;
    background:#F59E0B;border-radius:50%;
    border:2.5px solid #fff;
    display:flex;align-items:center;justify-content:center;
    font-size:19px;line-height:1;
    box-shadow:0 3px 14px rgba(245,158,11,0.6);
  ">🛺</div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

function FitBounds({
  passengerPos,
  pullerPos,
}: {
  passengerPos: [number, number]
  pullerPos: [number, number]
}) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(L.latLngBounds([passengerPos, pullerPos]), {
      padding: [48, 48],
      animate: true,
      maxZoom: 15,
    })
  }, [map, passengerPos, pullerPos])
  return null
}

export interface RideMapProps {
  passengerPos: [number, number] | null
  pullerPos: [number, number] | null
}

export default function RideMap({ passengerPos, pullerPos }: RideMapProps) {
  const center = passengerPos ?? pullerPos ?? GUWAHATI

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      scrollWheelZoom={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {/* Auto-fit bounds when both positions known */}
      {passengerPos && pullerPos && (
        <FitBounds passengerPos={passengerPos} pullerPos={pullerPos} />
      )}

      {/* Dashed amber line between passenger and puller */}
      {passengerPos && pullerPos && (
        <Polyline
          positions={[passengerPos, pullerPos]}
          pathOptions={{ color: '#F59E0B', weight: 2.5, dashArray: '6 6', opacity: 0.7 }}
        />
      )}

      {passengerPos && (
        <Marker 
          position={passengerPos} 
          icon={passengerIcon}
          alt="Your location"
          keyboard={true}
          ref={(m) => m?.getElement()?.setAttribute('aria-label', 'Your location')}
        />
      )}
      {pullerPos && (
        <Marker 
          position={pullerPos} 
          icon={pullerIcon}
          alt="Puller location"
          keyboard={true}
          ref={(m) => m?.getElement()?.setAttribute('aria-label', 'Puller location')}
        />
      )}
    </MapContainer>
  )
}
