'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEarthSceneStore } from '@/lib/stores/earth-scene-store'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function FadeOverlay() {
  const router = useRouter()
  const { isFadingOut } = useEarthSceneStore()

  useEffect(() => {
    if (!isFadingOut) {
      return
    }

    // Wait for fade animation to complete, then check auth and redirect
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Authenticated user goes to dashboard
        router.push('/dashboard')
      } else {
        // Unauthenticated user goes to login
        router.push('/login')
      }
    }, 1000) // Match the CSS transition duration

    return () => clearTimeout(timer)
  }, [isFadingOut, router])

  return (
    <div
      className={cn(
        'absolute inset-0 bg-black pointer-events-none transition-opacity duration-1000 z-40',
        isFadingOut ? 'opacity-100' : 'opacity-0'
      )}
    />
  )
}
