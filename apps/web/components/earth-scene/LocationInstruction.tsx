'use client'

import { useEarthSceneStore } from '@/lib/stores/earth-scene-store'
import { MousePointerClick } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LocationInstruction() {
  const { isZooming, isFadingOut, texturesLoaded } = useEarthSceneStore()

  // Hide during animations or when textures are loading
  if (isZooming || isFadingOut || !texturesLoaded) {
    return null
  }

  return (
    <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-4">
      <div
        className={cn(
          'bg-black/60 backdrop-blur-md rounded-full px-4 py-2 sm:px-6 sm:py-3',
          'border border-white/10',
          'flex items-center gap-2',
          'animate-in fade-in slide-in-from-bottom-4 duration-700',
          'shadow-lg shadow-black/20',
          'max-w-[calc(100vw-2rem)]'
        )}
      >
        <MousePointerClick
          className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400 animate-pulse flex-shrink-0"
          strokeWidth={2}
        />
        <p className="text-xs sm:text-sm font-medium text-white/90 whitespace-nowrap">
          Click on Earth to set your location
        </p>
      </div>
    </div>
  )
}
