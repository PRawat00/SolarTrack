'use client'

import { usePendingLocation } from '@/lib/hooks/use-pending-location'
import { LocationConfirmDialog } from '@/components/earth-scene/LocationConfirmDialog'

/**
 * Dashboard overlay component that shows a confirmation dialog
 * when a user has a pending location from before login.
 */
export function PendingLocationDialog() {
  const {
    pendingLocation,
    savedSettings,
    showConfirmDialog,
    isLoading,
    isUpdating,
    handleConfirm,
    handleCancel,
  } = usePendingLocation()

  // Don't render anything while loading or if no dialog to show
  if (isLoading || !showConfirmDialog || !pendingLocation || !savedSettings) {
    return null
  }

  return (
    <LocationConfirmDialog
      isOpen={showConfirmDialog}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      currentLocationName={savedSettings.location_name}
      newLocationName={pendingLocation.name}
      variant="update"
      isLoading={isUpdating}
    />
  )
}
