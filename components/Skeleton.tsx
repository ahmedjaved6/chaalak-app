export const SkeletonBox = ({ w, h, rounded }: { w?: string, h?: string, rounded?: string }) => (
  <div style={{
    width: w || '100%',
    height: h || '20px',
    borderRadius: rounded || '8px',
    background: 'linear-gradient(90deg, #2A2A2E 25%, #3A3A3E 50%, #2A2A2E 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  }} />
)
