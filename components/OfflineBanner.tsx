'use client'
import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    setOffline(!navigator.onLine)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      position:'fixed', bottom:0, left:0, right:0, zIndex:9999,
      background:'#1A1A1E', borderTop:'1.5px solid #EF4444',
      padding:'12px 16px', display:'flex', alignItems:'center',
      gap:'10px', justifyContent:'center'
    }}>
      <div style={{width:8,height:8,borderRadius:'50%',background:'#EF4444',flexShrink:0}}/>
      <span style={{fontFamily:'Nunito',fontWeight:700,fontSize:13,color:'white'}}>
        Internet নাই — Reconnecting...
      </span>
    </div>
  )
}
