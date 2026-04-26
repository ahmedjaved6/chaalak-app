'use client'

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F1117]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="text-sm font-bold text-emerald-500 tracking-widest uppercase">Loading...</p>
      </div>
    </div>
  )
}
