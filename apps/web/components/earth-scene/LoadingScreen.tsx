'use client'

import { useProgress } from '@react-three/drei'
import { useEarthSceneStore } from '@/lib/stores/earth-scene-store'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export function LoadingScreen() {
  const { progress, active } = useProgress()
  const { texturesLoaded, setTexturesLoaded } = useEarthSceneStore()

  // Update store when loading completes
  useEffect(() => {
    if (!(progress === 100 && !active && !texturesLoaded)) {
      return
    }

    // Small delay for smooth transition
    const timer = setTimeout(() => {
      setTexturesLoaded(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [progress, active, texturesLoaded, setTexturesLoaded])

  // Don't render if already loaded
  if (texturesLoaded) {
    return null
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-50 bg-black flex flex-col items-center justify-center transition-opacity duration-500',
        progress === 100 && !active ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )}
    >
      {/* Logo */}
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-8">
        Solar<span className="text-orange-500">Track</span>
      </h1>

      {/* Loading indicator */}
      <div className="w-64 space-y-3">
        {/* Progress bar background */}
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          {/* Progress bar fill */}
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Loading text */}
        <p className="text-sm text-white/50 text-center">
          Loading Earth... {Math.round(progress)}%
        </p>
      </div>

      {/* Animated dots */}
      <div className="mt-8 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

// Simple loading screen without progress tracking (for Suspense fallback)
export function LoadingScreenSimple() {
  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-8">
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
