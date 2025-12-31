'use client'

import { useEarthSceneStore, EARTH_SPEEDS, SUN_SPEEDS, SpeedPreset } from '@/lib/stores/earth-scene-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SpeedControls() {
  const {
    earthPreset,
    sunPreset,
    setEarthPreset,
    setSunPreset,
    isZooming,
    isFadingOut,
    showSolar,
    showWind,
    showNuclear,
    toggleSolar,
    toggleWind,
    toggleNuclear,
  } = useEarthSceneStore()

  // Hide controls during zoom/fade
  if (isZooming || isFadingOut) {
    return null
  }

  const presets: SpeedPreset[] = ['realistic', 'cinematic', 'fast']

  return (
    <div className="absolute top-4 right-4 z-10">
      <div className="w-80 bg-black/60 backdrop-blur-md rounded-lg p-4 border border-white/10 space-y-4">
        {/* Earth Speed */}
        <div>
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2">
            Earth Rotation
          </div>
          <div className="flex gap-1">
            {presets.map((preset) => (
              <Button
                key={`earth-${preset}`}
                variant="ghost"
                size="sm"
                onClick={() => setEarthPreset(preset)}
                className={cn(
                  'text-xs px-3 py-1 h-7 transition-all',
                  earthPreset === preset
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                {EARTH_SPEEDS[preset].label}
              </Button>
            ))}
          </div>
        </div>

        {/* Sun Speed */}
        <div>
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2">
            Sun Orbit
          </div>
          <div className="flex gap-1">
            {presets.map((preset) => (
              <Button
                key={`sun-${preset}`}
                variant="ghost"
                size="sm"
                onClick={() => setSunPreset(preset)}
                className={cn(
                  'text-xs px-3 py-1 h-7 transition-all',
                  sunPreset === preset
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                {SUN_SPEEDS[preset].label}
              </Button>
            ))}
          </div>
        </div>

        {/* Layers */}
        <div>
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2">
            Layers
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSolar}
              className={cn(
                'text-xs px-3 py-1 h-7 transition-all flex items-center gap-1.5',
                showSolar
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                  : 'text-white/40 hover:text-white hover:bg-white/10'
              )}
            >
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              Solar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleWind}
              className={cn(
                'text-xs px-3 py-1 h-7 transition-all flex items-center gap-1.5',
                showWind
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'text-white/40 hover:text-white hover:bg-white/10'
              )}
            >
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Wind
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleNuclear}
              className={cn(
                'text-xs px-3 py-1 h-7 transition-all flex items-center gap-1.5',
                showNuclear
                  ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/50'
                  : 'text-white/40 hover:text-white hover:bg-white/10'
              )}
            >
              <span className="w-2 h-2 rounded-full bg-fuchsia-400" />
              Nuclear
            </Button>
          </div>
        </div>

        {/* Hint */}
        <div className="pt-2 border-t border-white/10">
          <p className="text-[10px] text-white/40 text-center">
            Click on Earth to enter location
          </p>
        </div>
      </div>
    </div>
  )
}
