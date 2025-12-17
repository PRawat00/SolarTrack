'use client'

import { useState, useEffect, useCallback } from 'react'
import { settingsAPI, SettingsResponse } from '@/lib/api/client'
import {
  getPendingLocation,
  clearPendingLocation,
  isSameLocation,
  PendingLocation,
} from '@/lib/utils/pending-location'

interface UsePendingLocationReturn {
  pendingLocation: PendingLocation | null
  savedSettings: SettingsResponse | null
  showConfirmDialog: boolean
  isLoading: boolean
  isUpdating: boolean
  error: string | null
  handleConfirm: () => Promise<void>
  handleCancel: () => void
}

/**
 * Hook to check for and handle pending location after login.
 * Checks localStorage for a location selected before login and prompts
 * the user to save it if it differs from their current settings.
 */
export function usePendingLocation(): UsePendingLocationReturn {
  const [pendingLocation, setPendingLocation] = useState<PendingLocation | null>(null)
  const [savedSettings, setSavedSettings] = useState<SettingsResponse | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkPendingLocation() {
      const pending = getPendingLocation()
      if (!pending) {
        setIsLoading(false)
        return
      }

      try {
        const settings = await settingsAPI.get()
        setSavedSettings(settings)

        const savedLocation = { lat: settings.latitude, lng: settings.longitude }

        if (!isSameLocation(pending, savedLocation)) {
          // Location differs - show confirmation
          setPendingLocation(pending)
          setShowConfirmDialog(true)
        } else {
          // Same location - just clear pending
          clearPendingLocation()
        }
      } catch (err) {
        // If settings fetch fails, clear pending to avoid stuck state
        clearPendingLocation()
        console.error('Failed to check pending location:', err)
      } finally {
        setIsLoading(false)
      }
    }

    checkPendingLocation()
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!pendingLocation) return

    setIsUpdating(true)
    setError(null)

    try {
      await settingsAPI.update({
        latitude: pendingLocation.lat,
        longitude: pendingLocation.lng,
        location_name: pendingLocation.name,
      })

      clearPendingLocation()
      setShowConfirmDialog(false)
      setPendingLocation(null)
    } catch (err) {
      setError('Failed to update location')
      console.error('Failed to update location:', err)
    } finally {
      setIsUpdating(false)
    }
  }, [pendingLocation])

  const handleCancel = useCallback(() => {
    clearPendingLocation()
    setShowConfirmDialog(false)
    setPendingLocation(null)
  }, [])

  return {
    pendingLocation,
    savedSettings,
    showConfirmDialog,
    isLoading,
    isUpdating,
    error,
    handleConfirm,
    handleCancel,
  }
}
