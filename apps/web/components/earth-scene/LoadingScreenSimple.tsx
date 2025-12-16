'use client'

export function LoadingScreenSimple() {
  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-8 text-white">
        Solar<span className="text-orange-500">Track</span>
      </h1>

      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>

      <p className="mt-4 text-sm text-white/50">Loading...</p>
    </div>
  )
}
