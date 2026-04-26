'use client'

// Loaded client-side only via next/dynamic ssr:false
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { ZONE_COLORS } from '@/lib/constants'

const GUWAHATI: [number, number] = [26.1445, 91.7362]

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

  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pMarkers = useRef<Record<string, L.Marker>>({})
  const rMarkers = useRef<Record<string, L.Marker>>({})

  useEffect(() => {
    if (!mapRef.current && containerRef.current) {
      const m = L.map(containerRef.current, {
        center: GUWAHATI,
        zoom: 12,
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: false,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m)
      mapRef.current = m
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const currentP = new Set(pullers.map(p => p.id))
    for (const id in pMarkers.current) {
      if (!currentP.has(id)) {
        pMarkers.current[id].remove()
        delete pMarkers.current[id]
      }
    }
    pullers.forEach(p => {
      if (pMarkers.current[p.id]) {
        pMarkers.current[p.id].setLatLng([p.lat, p.lng])
      } else {
        const m = L.marker([p.lat, p.lng], { icon: pullerDotIcon(p.zoneNumber), keyboard: true, alt: `Puller ${p.id}` }).addTo(mapRef.current!)
        m.getElement()?.setAttribute('aria-label', `Puller ${p.id}`)
        pMarkers.current[p.id] = m
      }
    })
  }, [pullers])

  useEffect(() => {
    if (!mapRef.current) return
    const currentR = new Set(passengers.map(r => r.id))
    for (const id in rMarkers.current) {
      if (!currentR.has(id)) {
        rMarkers.current[id].remove()
        delete rMarkers.current[id]
      }
    }
    passengers.forEach(r => {
      if (rMarkers.current[r.id]) {
        rMarkers.current[r.id].setLatLng([r.lat, r.lng])
      } else {
        const m = L.marker([r.lat, r.lng], { icon: passengerDotIcon, keyboard: true, alt: `Passenger ${r.id}` }).addTo(mapRef.current!)
        m.getElement()?.setAttribute('aria-label', `Passenger ${r.id}`)
        rMarkers.current[r.id] = m
      }
    })
  }, [passengers])

  if (typeof window === 'undefined') return null
  return <div ref={containerRef} id="map" style={{ height: '100%', width: '100%' }} />
}
