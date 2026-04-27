'use client'

// ── This file is ONLY loaded client-side (imported via next/dynamic ssr:false)
// ── It is safe to call L.* at module level here.
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef } from 'react'

export const GUWAHATI: [number, number] = [26.1445, 91.7362]

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

export interface OnlinePuller {
  id: string
  badge_code: string
  badge_number: number
  lat: number | null
  lng: number | null
  zone_id: string
  zones?: {
    zone_number: number
    color_hex: string
  }[]
}

export interface PassengerMapProps {
  passengerPos: [number, number] | null
  pullers: OnlinePuller[]
}

export default function PassengerMap({ passengerPos, pullers }: PassengerMapProps) {

  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const paxMarkerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!mapRef.current && containerRef.current) {
      const m = L.map(containerRef.current, {
        center: passengerPos ?? GUWAHATI,
        zoom: 13,
        zoomControl: false,
        scrollWheelZoom: false,
        attributionControl: false,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m)
      L.control.zoom({ position: 'bottomright' }).addTo(m)
      mapRef.current = m
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Sync passenger marker
  useEffect(() => {
    if (!mapRef.current) return
    if (passengerPos) {
      if (!paxMarkerRef.current) {
        paxMarkerRef.current = L.marker(passengerPos, { icon: passengerIcon, keyboard: true, alt: 'Your location' }).addTo(mapRef.current)
        paxMarkerRef.current.getElement()?.setAttribute('aria-label', 'Your location')
      } else {
        paxMarkerRef.current.setLatLng(passengerPos)
      }
      mapRef.current.setView(passengerPos, mapRef.current.getZoom(), { animate: true })
    } else if (paxMarkerRef.current) {
      paxMarkerRef.current.remove()
      paxMarkerRef.current = null
    }
  }, [passengerPos])

  // Sync puller markers
  useEffect(() => {
    if (!mapRef.current) return
    const currentIds = new Set(pullers.map(p => p.id))

    // Remove stale
    for (const id in markersRef.current) {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove()
        delete markersRef.current[id]
      }
    }

    // Add/update active
    pullers.forEach(p => {
      if (p.lat == null || p.lng == null) return
      if (markersRef.current[p.id]) {
        markersRef.current[p.id].setLatLng([p.lat, p.lng])
      } else {
        const m = L.marker([p.lat, p.lng], { icon: pullerIcon, keyboard: true, alt: `Puller ${p.id}` }).addTo(mapRef.current!)
        m.getElement()?.setAttribute('aria-label', `Puller ${p.id}`)
        markersRef.current[p.id] = m
      }
    })
  }, [pullers])

  if (typeof window === 'undefined') return null
  return <div ref={containerRef} id="map" style={{ height: '100%', width: '100%' }} />
}
