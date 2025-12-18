'use client'

import { useState, useEffect, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GiftWrapProps {
  id: string
  children: ReactNode
  className?: string
  disabled?: boolean
}

const STORAGE_KEY = 'solartrack-unwrapped-gifts'

function getUnwrappedGifts(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return new Set(stored ? JSON.parse(stored) : [])
  } catch {
    return new Set()
  }
}

function saveUnwrappedGift(id: string) {
  try {
    const unwrapped = getUnwrappedGifts()
    unwrapped.add(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...unwrapped]))
  } catch {
    // Ignore storage errors
  }
}

export function GiftWrap({ id, children, className, disabled }: GiftWrapProps) {
  const [isWrapped, setIsWrapped] = useState(true)
  const [isUnwrapping, setIsUnwrapping] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const unwrapped = getUnwrappedGifts()
    if (unwrapped.has(id)) {
      setIsWrapped(false)
    }
  }, [id])

  const handleUnwrap = () => {
    if (!isWrapped || isUnwrapping || disabled) return

    setIsUnwrapping(true)

    // After animation completes, reveal content
    setTimeout(() => {
      setIsWrapped(false)
      setIsUnwrapping(false)
      saveUnwrappedGift(id)
    }, 800)
  }

  // Already unwrapped - just show content without wrapper
  if (mounted && !isWrapped && !isUnwrapping) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className={cn('relative', className)}>
      {/* Content always visible underneath */}
      <div>{children}</div>

      {/* Gift wrap overlay on top */}
      {(isWrapped || isUnwrapping || !mounted) && (
        <WrapOverlay isUnwrapping={isUnwrapping} onClick={handleUnwrap} />
      )}
    </div>
  )
}

interface WrapOverlayProps {
  isUnwrapping: boolean
  onClick?: () => void
}

function WrapOverlay({ isUnwrapping, onClick }: WrapOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 cursor-pointer overflow-hidden rounded-xl',
        'transition-transform duration-200',
        !isUnwrapping && 'hover:scale-[1.02]'
      )}
      onClick={onClick}
    >
      {/* Left half of wrapping paper */}
      <div
        className="absolute inset-y-0 left-0 w-1/2 origin-left transition-transform duration-700 ease-in-out overflow-hidden"
        style={{
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
          transform: isUnwrapping ? 'rotateY(-90deg) translateX(-1rem)' : 'none',
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-l-xl"
          style={{
            width: '200%',
            background: 'repeating-linear-gradient(45deg, #dc2626 0px, #dc2626 12px, #15803d 12px, #15803d 24px, #dc2626 24px, #dc2626 36px, #166534 36px, #166534 48px)',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.2)',
          }}
        />
      </div>

      {/* Right half of wrapping paper */}
      <div
        className="absolute inset-y-0 right-0 w-1/2 origin-right transition-transform duration-700 ease-in-out overflow-hidden"
        style={{
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
          transform: isUnwrapping ? 'rotateY(90deg) translateX(1rem)' : 'none',
        }}
      >
        <div
          className="absolute inset-y-0 rounded-r-xl"
          style={{
            width: '200%',
            right: 0,
            background: 'repeating-linear-gradient(45deg, #dc2626 0px, #dc2626 12px, #15803d 12px, #15803d 24px, #dc2626 24px, #dc2626 36px, #166534 36px, #166534 48px)',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.2)',
          }}
        />
      </div>

      {/* Vertical ribbon - off-center left */}
      <div
        className={cn(
          'absolute top-0 bottom-0 w-4',
          'bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 shadow-md',
          'transition-all duration-500',
          isUnwrapping && 'opacity-0 scale-x-0'
        )}
        style={{ left: '25%' }}
      />

      {/* Horizontal ribbon - off-center top */}
      <div
        className={cn(
          'absolute left-0 right-0 h-4',
          'bg-gradient-to-b from-yellow-400 via-yellow-300 to-yellow-400 shadow-md',
          'transition-all duration-500',
          isUnwrapping && 'opacity-0 scale-y-0'
        )}
        style={{ top: '35%' }}
      />

      {/* Bow at ribbon intersection */}
      <div
        className={cn(
          'absolute z-10',
          'transition-all duration-300',
          isUnwrapping && 'scale-150 opacity-0'
        )}
        style={{ left: 'calc(25% + 8px)', top: 'calc(35% + 8px)', transform: 'translate(-50%, -35%)' }}
      >
        <img
          src="/bow.png"
          alt="Gift bow"
          className="w-16 h-16 object-contain"
          draggable={false}
        />
      </div>

    </div>
  )
}

// Utility to reset all gifts (for testing)
export function resetAllGifts() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }
}
