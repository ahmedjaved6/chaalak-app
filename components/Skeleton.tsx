export const SkeletonBox = ({ w, h, rounded }: { w?: string, h?: string, rounded?: string }) => (
  <div style={{
    width: w || '100%',
    height: h || '20px',
    borderRadius: rounded || '8px',
    background: '#2A2A2E',
    overflow: 'hidden',
    position: 'relative',
  }}>
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
      animation: 'shimmer 1.5s infinite',
      transform: 'translateX(-100%)',
    }} />
    <style>{`
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `}</style>
  </div>
)
