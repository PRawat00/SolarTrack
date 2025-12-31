'use client'

import { useEarthSceneStore } from '@/lib/stores/earth-scene-store'
import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'

export function AttributionPanel() {
  const { isZooming, isFadingOut, texturesLoaded } = useEarthSceneStore()

  // Hide during animations or when textures are loading
  if (isZooming || isFadingOut || !texturesLoaded) {
    return null
  }

  return (
    <div className="absolute bottom-4 right-4 z-10 px-4 pointer-events-auto">
      <div
        className={cn(
          'w-80',
          'bg-black/60 backdrop-blur-md rounded-lg p-3 sm:p-4',
          'border border-white/10',
          'shadow-lg shadow-black/20',
          'animate-in fade-in slide-in-from-right-4 duration-700',
          'flex gap-2 items-start'
        )}
      >
        <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400 flex-shrink-0 mt-0.5" strokeWidth={2} />
        <div className="text-[10px] sm:text-xs leading-relaxed text-white/70 space-y-1">
          <p>
            Visualizing 16,200+ global power plants (solar, wind, nuclear) from the{' '}
            <a
              href="https://datasets.wri.org/datasets/global-power-plant-database"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 hover:text-orange-400 underline underline-offset-2 transition-colors"
            >
              Global Power Plant Database
            </a>
            {' '}by{' '}
            <a
              href="https://www.wri.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 hover:text-orange-400 underline underline-offset-2 transition-colors"
            >
              WRI
            </a>
            .
          </p>
          <p>
            Earth textures by{' '}
            <a
              href="https://www.solarsystemscope.com/textures/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 hover:text-orange-400 underline underline-offset-2 transition-colors"
            >
              Solar System Scope
            </a>
            {' '}(CC BY 4.0).
          </p>
        </div>
      </div>
    </div>
  )
}
