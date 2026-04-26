'use client'

// Only loaded client-side via next/dynamic ssr:false
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useRef } from 'react'

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

export interface RideMapProps {
  passengerPos: [number, number] | null
  pullerPos: [number, number] | null
}

export default function RideMap({ passengerPos, pullerPos }: RideMapProps) {

  const mapRef = useRef<L.Map | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const paxRef = useRef<L.Marker | null>(null)
  const pulRef = useRef<L.Marker | null>(null)
  const lineRef = useRef<L.Polyline | null>(null)

  useEffect(() => {
    if (!mapRef.current && containerRef.current) {
      const m = L.map(containerRef.current, {
        center: passengerPos ?? pullerPos ?? GUWAHATI,
        zoom: 14,
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
    const m = mapRef.current

    if (passengerPos) {
      if (paxRef.current) paxRef.current.setLatLng(passengerPos)
      else {
        paxRef.current = L.marker(passengerPos, { icon: passengerIcon, keyboard: true, alt: 'Your location' }).addTo(m)
        paxRef.current.getElement()?.setAttribute('aria-label', 'Your location')
      }
    } else if (paxRef.current) {
      paxRef.current.remove()
      paxRef.current = null
    }

    if (pullerPos) {
      if (pulRef.current) pulRef.current.setLatLng(pullerPos)
      else {
        pulRef.current = L.marker(pullerPos, { icon: pullerIcon, keyboard: true, alt: 'Puller location' }).addTo(m)
        pulRef.current.getElement()?.setAttribute('aria-label', 'Puller location')
      }
    } else if (pulRef.current) {
      pulRef.current.remove()
      pulRef.current = null
    }

    if (passengerPos && pullerPos) {
      if (lineRef.current) lineRef.current.setLatLngs([passengerPos, pullerPos])
      else {
        lineRef.current = L.polyline([passengerPos, pullerPos], { color: '#F59E0B', weight: 2.5, dashArray: '6 6', opacity: 0.7 }).addTo(m)
      }
      m.fitBounds(L.latLngBounds([passengerPos, pullerPos]), { padding: [48, 48], animate: true, maxZoom: 15 })
    } else if (lineRef.current) {
      lineRef.current.remove()
      lineRef.current = null
    }
  }, [passengerPos, pullerPos])

  if (typeof window === 'undefined') return null
  return <div ref={containerRef} id="map" style={{ height: '100%', width: '100%' }} />
}
