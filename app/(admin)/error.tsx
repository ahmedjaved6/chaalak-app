'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F1117] px-6 text-center">
      <h2 className="mb-4 text-2xl font-black text-white">Admin Error</h2>
      <p className="mb-8 text-sm text-gray-400 font-mono">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-xl bg-emerald-600 px-8 py-3 text-sm font-black text-white"
      >
        Retry
      </button>
    </div>
  )
}
