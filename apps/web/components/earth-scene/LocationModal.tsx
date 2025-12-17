'use client'

import { useState, useCallback, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useEarthSceneStore, SelectedLocation } from '@/lib/stores/earth-scene-store'
import { geocodingAPI, settingsAPI, GeoLocation } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LocationConfirmDialog, ConfirmDialogVariant } from './LocationConfirmDialog'
import { setPendingLocation, isSameLocation } from '@/lib/utils/pending-location'

interface ConfirmDialogState {
  isOpen: boolean
  variant: ConfirmDialogVariant
  savedLocationName: string | null
}

export function LocationModal() {
  const { isModalOpen, closeModal, setLocation, startZoomAnimation } = useEarthSceneStore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoLocation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<GeoLocation | null>(null)

  // Auth check state
  const [isCheckingAuth, setIsCheckingAuth] = useState(false)
  const [confirmDialogState, setConfirmDialogState] = useState<ConfirmDialogState | null>(null)
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false)

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      setError(null)

      try {
        const response = await geocodingAPI.search(query)
        setResults(response.results || [])
      } catch (err) {
        setError('Failed to search locations')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelectLocation = useCallback((location: GeoLocation) => {
    setSelectedResult(location)
    setQuery(location.display_name || location.name)
    setResults([])
  }, [])

  // Helper to proceed with animation after location is confirmed
  const proceedWithAnimation = useCallback((location: SelectedLocation) => {
    setLocation(location)
    closeModal()
    setConfirmDialogState(null)
    setTimeout(() => {
      startZoomAnimation()
    }, 1000)
  }, [setLocation, closeModal, startZoomAnimation])

  const handleSubmit = useCallback(async () => {
    if (!selectedResult) return

    setIsCheckingAuth(true)
    setError(null)

    try {
      // 1. Check auth status
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const newLocation = {
        lat: selectedResult.latitude,
        lng: selectedResult.longitude,
        name: selectedResult.name,
      }

      if (!user) {
        // NOT LOGGED IN: Store in localStorage and show login prompt
        setPendingLocation(newLocation)
        setConfirmDialogState({
          isOpen: true,
          variant: 'login-required',
          savedLocationName: null,
        })
        return
      }

      // 2. Logged in: Fetch current settings
      const settings = await settingsAPI.get()

      // 3. Compare locations
      const savedLocation = { lat: settings.latitude, lng: settings.longitude }

      if (isSameLocation(newLocation, savedLocation)) {
        // SAME LOCATION: Proceed with animation directly
        proceedWithAnimation(newLocation)
      } else {
        // DIFFERENT LOCATION: Show confirmation dialog
        setConfirmDialogState({
          isOpen: true,
          variant: 'update',
          savedLocationName: settings.location_name,
        })
      }
    } catch (err) {
      setError('Failed to check location settings')
    } finally {
      setIsCheckingAuth(false)
    }
  }, [selectedResult, proceedWithAnimation])

  // Handle confirming location update (logged in, different location)
  const handleConfirmUpdate = useCallback(async () => {
    if (!selectedResult) return

    setIsUpdatingLocation(true)
    setError(null)

    try {
      // Update settings with new location
      await settingsAPI.update({
        latitude: selectedResult.latitude,
        longitude: selectedResult.longitude,
        location_name: selectedResult.name,
      })

      // Proceed with animation
      proceedWithAnimation({
        lat: selectedResult.latitude,
        lng: selectedResult.longitude,
        name: selectedResult.name,
      })
    } catch (err) {
      setError('Failed to update location')
      setConfirmDialogState(null)
    } finally {
      setIsUpdatingLocation(false)
    }
  }, [selectedResult, proceedWithAnimation])

  // Handle continuing to login (not logged in)
  const handleLoginRedirect = useCallback(() => {
    if (!selectedResult) return

    // Location already stored in localStorage by handleSubmit
    // Proceed with animation -> will redirect to /login
    proceedWithAnimation({
      lat: selectedResult.latitude,
      lng: selectedResult.longitude,
      name: selectedResult.name,
    })
  }, [selectedResult, proceedWithAnimation])

  // Handle canceling the confirmation dialog
  const handleCancelConfirm = useCallback(() => {
    setConfirmDialogState(null)
    // Don't close main modal - user can select a different location
  }, [])

  const handleClose = useCallback(() => {
    setQuery('')
    setResults([])
    setSelectedResult(null)
    setError(null)
    setConfirmDialogState(null)
    setIsCheckingAuth(false)
    setIsUpdatingLocation(false)
    closeModal()
  }, [closeModal])

  return (
    <Dialog.Root open={isModalOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
          <div className="bg-zinc-900/95 backdrop-blur-md rounded-xl border border-white/10 p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <Dialog.Title className="text-xl font-semibold text-white mb-2">
              Enter Your Location
            </Dialog.Title>
            <Dialog.Description className="text-sm text-white/60 mb-6">
              Search for a city or location to zoom into on Earth
            </Dialog.Description>

            <div className="space-y-4">
              {/* Search input */}
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search for a location..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedResult(null)
                  }}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-orange-500/50"
                  autoFocus
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Search results */}
              {results.length > 0 && (
                <div className="bg-black/40 rounded-lg border border-white/10 max-h-48 overflow-y-auto">
                  {results.map((result, index) => (
                    <button
                      key={`${result.latitude}-${result.longitude}-${index}`}
                      onClick={() => handleSelectLocation(result)}
                      className={cn(
                        'w-full text-left px-4 py-3 text-sm transition-colors',
                        'hover:bg-white/10 border-b border-white/5 last:border-b-0',
                        selectedResult?.latitude === result.latitude &&
                          selectedResult?.longitude === result.longitude
                          ? 'bg-orange-500/20 text-orange-300'
                          : 'text-white/80'
                      )}
                    >
                      <div className="font-medium">{result.name}</div>
                      {result.admin1 && (
                        <div className="text-xs text-white/50">
                          {result.admin1}, {result.country}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Error message */}
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  disabled={isCheckingAuth}
                  className="flex-1 text-white/70 hover:text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedResult || isCheckingAuth}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                >
                  {isCheckingAuth ? 'Checking...' : 'Go to Location'}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      {/* Confirmation Dialog */}
      {confirmDialogState && (
        <LocationConfirmDialog
          isOpen={confirmDialogState.isOpen}
          onClose={handleCancelConfirm}
          onConfirm={confirmDialogState.variant === 'update' ? handleConfirmUpdate : handleLoginRedirect}
          onCancel={handleCancelConfirm}
          currentLocationName={confirmDialogState.savedLocationName || undefined}
          newLocationName={selectedResult?.name || ''}
          variant={confirmDialogState.variant}
          isLoading={isUpdatingLocation}
        />
      )}
    </Dialog.Root>
  )
}
