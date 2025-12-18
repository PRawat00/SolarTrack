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
        className={cn(
          'absolute inset-y-0 left-0 w-1/2 origin-left',
          'transition-transform duration-700 ease-in-out',
          isUnwrapping && '-rotate-y-90 -translate-x-4'
        )}
        style={{
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 gift-wrap-pattern rounded-l-xl" />
        {/* Vertical ribbon - left half */}
        <div className="absolute top-0 bottom-0 right-0 w-4 bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 shadow-md" />
      </div>

      {/* Right half of wrapping paper */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 w-1/2 origin-right',
          'transition-transform duration-700 ease-in-out',
          isUnwrapping && 'rotate-y-90 translate-x-4'
        )}
        style={{
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
        }}
      >
        <div className="absolute inset-0 gift-wrap-pattern rounded-r-xl" />
        {/* Vertical ribbon - right half */}
        <div className="absolute top-0 bottom-0 left-0 w-4 bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 shadow-md" />
      </div>

      {/* Horizontal ribbon */}
      <div
        className={cn(
          'absolute left-0 right-0 top-1/2 -translate-y-1/2 h-4',
          'bg-gradient-to-b from-yellow-400 via-yellow-300 to-yellow-400 shadow-md',
          'transition-all duration-500',
          isUnwrapping && 'opacity-0 scale-y-0'
        )}
      />

      {/* Bow */}
      <div
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10',
          'transition-all duration-300',
          isUnwrapping && 'scale-150 opacity-0'
        )}
      >
        {/* Bow loops */}
        <div className="relative w-16 h-12">
          {/* Left loop */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-7 h-10 rounded-full border-4 border-red-600 bg-red-500"
            style={{ transform: 'translateY(-50%) rotate(-30deg)' }}
          />
          {/* Right loop */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-7 h-10 rounded-full border-4 border-red-600 bg-red-500"
            style={{ transform: 'translateY(-50%) rotate(30deg)' }}
          />
          {/* Center knot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-red-600 shadow-lg" />
          {/* Ribbon tails */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-6 bg-gradient-to-b from-red-500 to-red-600"
            style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 20% 100%)' }}
          />
          <div
            className="absolute top-full left-1/2 ml-1 w-3 h-5 bg-gradient-to-b from-red-500 to-red-600"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 80%)', transform: 'rotate(15deg)' }}
          />
        </div>
      </div>

      {/* Click hint */}
      {!isUnwrapping && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-sm">
          Click to unwrap
        </div>
      )}

      <style jsx>{`
        .gift-wrap-pattern {
          background:
            repeating-linear-gradient(
              45deg,
              #dc2626 0px,
              #dc2626 12px,
              #15803d 12px,
              #15803d 24px,
              #dc2626 24px,
              #dc2626 36px,
              #166534 36px,
              #166534 48px
            );
          box-shadow: inset 0 0 30px rgba(0,0,0,0.2);
        }

        .-rotate-y-90 {
          transform: rotateY(-90deg) translateX(-1rem);
        }

        .rotate-y-90 {
          transform: rotateY(90deg) translateX(1rem);
        }
      `}</style>
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
