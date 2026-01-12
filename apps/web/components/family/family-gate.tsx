'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { settingsAPI } from '@/lib/api/client'

interface FamilyGateProps {
  children: React.ReactNode
}

export function FamilyGate({ children }: FamilyGateProps) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const settings = await settingsAPI.get()
        if (!settings.family_feature_enabled) {
          router.replace('/settings')
          return
        }
        setAllowed(true)
      } catch {
        router.replace('/dashboard')
      } finally {
        setChecking(false)
      }
    }
    checkAccess()
  }, [router])

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!allowed) {
    return null
  }

  return <>{children}</>
}
