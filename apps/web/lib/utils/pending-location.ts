/**
 * Utilities for managing pending location in localStorage.
 * Used when a user selects a location on the Earth globe before logging in.
 */

const PENDING_LOCATION_KEY = 'solartrack_pending_location'
const EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface PendingLocation {
  lat: number
  lng: number
  name: string
  timestamp: number
}

/**
 * Store a pending location in localStorage with a timestamp.
 */
export function setPendingLocation(location: { lat: number; lng: number; name: string }): void {
  const pending: PendingLocation = {
    ...location,
    timestamp: Date.now(),
  }
  try {
    localStorage.setItem(PENDING_LOCATION_KEY, JSON.stringify(pending))
  } catch {
    // localStorage not available (SSR or privacy mode)
  }
}

/**
 * Get the pending location from localStorage.
 * Returns null if not found, expired (>24h), or invalid.
 */
export function getPendingLocation(): PendingLocation | null {
  try {
    const stored = localStorage.getItem(PENDING_LOCATION_KEY)
    if (!stored) return null

    const pending: PendingLocation = JSON.parse(stored)

    // Check expiration
    if (Date.now() - pending.timestamp > EXPIRATION_MS) {
      clearPendingLocation()
      return null
    }

    // Validate required fields
    if (
      typeof pending.lat !== 'number' ||
      typeof pending.lng !== 'number' ||
      typeof pending.name !== 'string'
    ) {
      clearPendingLocation()
      return null
    }

    return pending
  } catch {
    // localStorage not available or invalid JSON
    return null
  }
}

/**
 * Clear the pending location from localStorage.
 */
export function clearPendingLocation(): void {
  try {
    localStorage.removeItem(PENDING_LOCATION_KEY)
  } catch {
    // localStorage not available
  }
}

/**
 * Check if two locations are the same within a tolerance.
 * Default tolerance is 0.0001 degrees (~11 meters), suitable for city-level matching.
 */
export function isSameLocation(
  loc1: { lat: number; lng: number },
  loc2: { lat: number; lng: number },
  tolerance: number = 0.0001
): boolean {
  return (
    Math.abs(loc1.lat - loc2.lat) < tolerance &&
    Math.abs(loc1.lng - loc2.lng) < tolerance
  )
}
