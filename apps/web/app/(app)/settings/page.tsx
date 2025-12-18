'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { settingsAPI, geocodingAPI, usageAPI, readingsAPI, GeoLocation, UsageResponse } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { resetAllGifts } from '@/components/christmas/gift-wrap'

const settingsSchema = z.object({
  currency_symbol: z
    .string()
    .min(1, 'Currency symbol is required')
    .max(3, 'Currency symbol must be 3 characters or less'),
  cost_per_kwh: z
    .number({ invalid_type_error: 'Must be a number' })
    .min(0, 'Cost cannot be negative')
    .max(10, 'Cost seems too high'),
  co2_factor: z
    .number({ invalid_type_error: 'Must be a number' })
    .min(0, 'Factor cannot be negative')
    .max(5, 'Factor seems too high'),
  yearly_goal: z
    .number({ invalid_type_error: 'Must be a number' })
    .min(0, 'Goal cannot be negative')
    .max(1000000, 'Goal seems too high'),
  location_name: z.string().optional(),
  latitude: z
    .number({ invalid_type_error: 'Must be a number' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number({ invalid_type_error: 'Must be a number' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
})

type SettingsFormData = z.infer<typeof settingsSchema>

const defaultSettings: SettingsFormData = {
  currency_symbol: '$',
  cost_per_kwh: 0.15,
  co2_factor: 0.85,
  yearly_goal: 12000,
  location_name: 'Bangkok, Thailand',
  latitude: 13.7563,
  longitude: 100.5018,
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [locationSearch, setLocationSearch] = useState('')
  const [searchResults, setSearchResults] = useState<GeoLocation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [usage, setUsage] = useState<UsageResponse | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: defaultSettings,
  })

  const currentLocationName = watch('location_name')

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await settingsAPI.get()
        reset({
          currency_symbol: data.currency_symbol,
          cost_per_kwh: data.cost_per_kwh,
          co2_factor: data.co2_factor,
          yearly_goal: data.yearly_goal,
          location_name: data.location_name,
          latitude: data.latitude,
          longitude: data.longitude,
        })
        setLocationSearch(data.location_name || '')
      } catch (err) {
        setMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to load settings',
        })
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [reset])

  // Load usage stats
  useEffect(() => {
    const loadUsage = async () => {
      try {
        const data = await usageAPI.get()
        setUsage(data)
      } catch (err) {
        console.error('Failed to load usage:', err)
      }
    }
    loadUsage()
  }, [])

  // Debounced search
  const searchLocation = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await geocodingAPI.search(query)
      setSearchResults(response.results)
      setShowResults(true)
    } catch (err) {
      console.error('Search failed:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (locationSearch && locationSearch !== currentLocationName) {
        searchLocation(locationSearch)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [locationSearch, currentLocationName, searchLocation])

  const selectLocation = (location: GeoLocation) => {
    setValue('location_name', location.display_name)
    setValue('latitude', location.latitude)
    setValue('longitude', location.longitude)
    setLocationSearch(location.display_name)
    setShowResults(false)
    setSearchResults([])
  }

  const onSubmit = async (formData: SettingsFormData) => {
    setMessage(null)

    try {
      await settingsAPI.update(formData)
      setMessage({ type: 'success', text: 'Settings saved successfully. Weather data cleared for new location.' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save settings',
      })
    }
  }

  const handleDeleteAllData = async () => {
    if (deleteConfirmation !== 'DELETE ALL DATA') return

    setIsDeleting(true)
    setDeleteMessage(null)

    try {
      const result = await readingsAPI.deleteAll()
      setDeleteMessage({ type: 'success', text: result.message })
      setDeleteConfirmation('')
    } catch (err) {
      setDeleteMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete data',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your solar tracking preferences
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Calculation Settings</CardTitle>
            <CardDescription>
              These values are used to calculate your savings and environmental impact
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {message && (
              <div
                className={`p-3 text-sm rounded-md ${
                  message.type === 'success'
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-destructive/10 text-destructive'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency_symbol">Currency Symbol</Label>
                <Input
                  id="currency_symbol"
                  {...register('currency_symbol')}
                  placeholder="$"
                  maxLength={3}
                />
                {errors.currency_symbol && (
                  <p className="text-sm text-destructive">{errors.currency_symbol.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_per_kwh">Cost per kWh</Label>
                <Input
                  id="cost_per_kwh"
                  type="number"
                  step="0.01"
                  {...register('cost_per_kwh', { valueAsNumber: true })}
                  placeholder="0.15"
                />
                {errors.cost_per_kwh && (
                  <p className="text-sm text-destructive">{errors.cost_per_kwh.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="co2_factor">CO2 Factor (kg/kWh)</Label>
                <Input
                  id="co2_factor"
                  type="number"
                  step="0.01"
                  {...register('co2_factor', { valueAsNumber: true })}
                  placeholder="0.85"
                />
                {errors.co2_factor && (
                  <p className="text-sm text-destructive">{errors.co2_factor.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Average kg of CO2 per kWh in your region
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="yearly_goal">Yearly Goal (kWh)</Label>
                <Input
                  id="yearly_goal"
                  type="number"
                  step="100"
                  {...register('yearly_goal', { valueAsNumber: true })}
                  placeholder="12000"
                />
                {errors.yearly_goal && (
                  <p className="text-sm text-destructive">{errors.yearly_goal.message}</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-4">Location (for Weather Data)</h3>

              {/* Location Search */}
              <div className="space-y-2 mb-4 relative">
                <Label htmlFor="location_search">Search Location</Label>
                <div className="relative">
                  <Input
                    id="location_search"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                    placeholder="Type a city name..."
                    className="pr-8"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                    {searchResults.map((location, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => selectLocation(location)}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                          'flex flex-col'
                        )}
                      >
                        <span className="font-medium">{location.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {location.display_name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Search for a city to auto-fill coordinates. Changing location will clear weather data.
                </p>
              </div>

              {/* Hidden location_name field for form */}
              <input type="hidden" {...register('location_name')} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    {...register('latitude', { valueAsNumber: true })}
                    placeholder="13.7563"
                  />
                  {errors.latitude && (
                    <p className="text-sm text-destructive">{errors.latitude.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    {...register('longitude', { valueAsNumber: true })}
                    placeholder="100.5018"
                  />
                  {errors.longitude && (
                    <p className="text-sm text-destructive">{errors.longitude.message}</p>
                  )}
                </div>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* API Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>API Usage</CardTitle>
          <CardDescription>
            Your daily Gemini API usage for image processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usage ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Today&apos;s Requests</span>
                <span className="font-mono">
                  {usage.daily_count} / {usage.daily_limit}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className={cn(
                    'h-2.5 rounded-full transition-all',
                    usage.daily_count / usage.daily_limit < 0.5
                      ? 'bg-green-500'
                      : usage.daily_count / usage.daily_limit < 0.8
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  )}
                  style={{
                    width: `${Math.min((usage.daily_count / usage.daily_limit) * 100, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Resets at midnight. Free tier allows up to {usage.daily_limit} requests per day.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading usage data...</p>
          )}
        </CardContent>
      </Card>

      {/* Christmas Settings */}
      <Card className="border-green-500">
        <CardHeader>
          <CardTitle className="text-green-500 flex items-center gap-2">
            <span>Holiday Season</span>
          </CardTitle>
          <CardDescription>
            Special Christmas features for the holiday season
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Re-wrap all the gift boxes on your dashboard to experience the surprise again!
            </p>
            <Button
              variant="outline"
              onClick={resetAllGifts}
              className="border-green-500 text-green-500 hover:bg-green-500/10"
            >
              Re-wrap All Gifts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that permanently delete your data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deleteMessage && (
            <div
              className={`p-3 text-sm rounded-md ${
                deleteMessage.type === 'success'
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {deleteMessage.text}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This will permanently delete all your solar readings. This action cannot be undone.
            </p>
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type <span className="font-mono font-bold">DELETE ALL DATA</span> to confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE ALL DATA"
                className="font-mono"
              />
            </div>
            <Button
              variant="destructive"
              onClick={handleDeleteAllData}
              disabled={deleteConfirmation !== 'DELETE ALL DATA' || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete All Readings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
