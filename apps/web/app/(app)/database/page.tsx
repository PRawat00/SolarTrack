'use client'

import { useState, useEffect } from 'react'
import { readingsAPI, weatherAPI, type ReadingResponse, type ReadingUpdate } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface EditableReading extends ReadingResponse {
  isModified?: boolean
}

export default function DatabasePage() {
  const [readings, setReadings] = useState<EditableReading[]>([])
  const [originalReadings, setOriginalReadings] = useState<ReadingResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const limit = 20

  // Date filter state
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  const loadReadings = async (offset = 0) => {
    try {
      setLoading(true)
      setError(null)
      const response = await readingsAPI.getAll({
        limit,
        offset,
        start_date: filterStartDate || undefined,
        end_date: filterEndDate || undefined,
      })
      setReadings(response.data.map(r => ({ ...r, isModified: false })))
      setOriginalReadings(response.data)
      setTotal(response.total)
      setPage(offset / limit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load readings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReadings()
  }, [filterStartDate, filterEndDate])

  const updateReading = (id: string, field: keyof ReadingUpdate, value: string | number | null) => {
    setReadings(prev => prev.map(r => {
      if (r.id !== id) return r

      const updated = { ...r, [field]: value }

      // Check if modified compared to original
      const original = originalReadings.find(o => o.id === id)
      if (original) {
        const isModified =
          updated.date !== original.date ||
          updated.time !== original.time ||
          updated.m1 !== original.m1 ||
          updated.m2 !== original.m2 ||
          updated.notes !== original.notes

        return { ...updated, isModified }
      }

      return updated
    }))
  }

  const modifiedReadings = readings.filter(r => r.isModified)
  const hasChanges = modifiedReadings.length > 0

  const handleSave = async () => {
    if (!hasChanges) return

    setSaving(true)
    setError(null)

    try {
      // Update each modified reading
      for (const reading of modifiedReadings) {
        await readingsAPI.update(reading.id, {
          date: reading.date,
          time: reading.time,
          m1: reading.m1,
          m2: reading.m2,
          notes: reading.notes,
        })
      }

      // Reload to get fresh data
      await loadReadings(page * limit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    // Reset to original values
    setReadings(originalReadings.map(r => ({ ...r, isModified: false })))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reading?')) {
      return
    }

    try {
      await readingsAPI.delete(id)
      // Reload current page
      loadReadings(page * limit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete reading')
    }
  }

  const handleExport = async () => {
    try {
      // Get auth token
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/export/csv`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename=(.+)/)?.[1] || 'solar_readings.csv'

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export')
    }
  }

  const handleEnrich = async () => {
    setEnriching(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const result = await weatherAPI.enrich()
      setSuccessMessage(result.message)
      // Reload readings to show weather data
      await loadReadings(page * limit)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enrich weather data')
    } finally {
      setEnriching(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Database</h1>
          <p className="text-muted-foreground">
            View and manage all solar readings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date filter */}
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            placeholder="Start date"
            className="bg-muted/50 border-0 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            placeholder="End date"
            className="bg-muted/50 border-0 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          {(filterStartDate || filterEndDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterStartDate('')
                setFilterEndDate('')
              }}
              className="text-muted-foreground"
            >
              Clear
            </Button>
          )}

          <div className="w-px h-6 bg-border mx-2" />

          <Button
            variant="outline"
            onClick={handleEnrich}
            disabled={enriching || hasChanges}
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            {enriching ? 'Enriching...' : 'Enrich Weather'}
          </Button>

          {hasChanges ? (
            <>
              <Button
                variant="outline"
                onClick={handleDiscard}
                disabled={saving}
              >
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : `Save ${modifiedReadings.length} Change${modifiedReadings.length !== 1 ? 's' : ''}`}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={total === 0}
            >
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-500/10 text-green-500 rounded-lg">
          {successMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Solar Readings</CardTitle>
          <CardDescription>
            {total} total reading{total !== 1 ? 's' : ''} - click cells to edit
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : readings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No readings yet. Upload some solar log images to get started.
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-left p-2 font-medium">Time</th>
                      <th className="text-right p-2 font-medium">M1 (kWh)</th>
                      <th className="text-right p-2 font-medium">M2 (kWh)</th>
                      <th className="text-center p-2 font-medium">Weather</th>
                      <th className="text-right p-2 font-medium">Sun (h)</th>
                      <th className="text-right p-2 font-medium">Radiation</th>
                      <th className="text-right p-2 font-medium">Snow (cm)</th>
                      <th className="text-left p-2 font-medium">Notes</th>
                      <th className="text-left p-2 font-medium">Contributed by</th>
                      <th className="text-right p-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((reading) => (
                      <tr
                        key={reading.id}
                        className={`border-b ${reading.isModified ? 'bg-yellow-500/10' : 'hover:bg-muted/50'}`}
                      >
                        <td className="p-1">
                          <input
                            type="date"
                            value={reading.date}
                            onChange={(e) => updateReading(reading.id, 'date', e.target.value)}
                            className="w-full px-2 py-1 bg-transparent border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="time"
                            value={reading.time || ''}
                            onChange={(e) => updateReading(reading.id, 'time', e.target.value || null)}
                            className="w-full px-2 py-1 bg-transparent border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            value={reading.m1}
                            onChange={(e) => updateReading(reading.id, 'm1', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 bg-transparent border rounded text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            step="0.01"
                            value={reading.m2 ?? ''}
                            onChange={(e) => updateReading(reading.id, 'm2', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full px-2 py-1 bg-transparent border rounded text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="p-2 text-center">
                          {reading.weather_code !== null ? (
                            <div className="flex flex-col items-center gap-0.5" title={`${reading.temp_max}C`}>
                              <span className="text-lg">
                                {reading.weather_code === 0 ? '☀️' :
                                 reading.weather_code <= 3 ? '⛅' :
                                 reading.weather_code <= 48 ? '☁️' :
                                 reading.weather_code <= 67 ? '🌧️' :
                                 reading.weather_code <= 77 ? '🌨️' :
                                 reading.weather_code <= 82 ? '🌧️' : '⛈️'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {reading.temp_max !== null ? `${reading.temp_max}` : '-'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono text-sm">
                          {reading.sunshine_hours !== null ? reading.sunshine_hours.toFixed(1) : '-'}
                        </td>
                        <td className="p-2 text-right font-mono text-sm">
                          {reading.radiation_sum !== null ? reading.radiation_sum.toFixed(1) : '-'}
                        </td>
                        <td className="p-2 text-right font-mono text-sm">
                          {reading.snowfall !== null && reading.snowfall > 0 ? reading.snowfall.toFixed(1) : '-'}
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={reading.notes || ''}
                            onChange={(e) => updateReading(reading.id, 'notes', e.target.value || null)}
                            placeholder="-"
                            className="w-full px-2 py-1 bg-transparent border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="p-2 text-left text-xs text-muted-foreground">
                          {reading.created_by ? (
                            <span title={reading.created_by}>
                              {reading.created_by.slice(0, 8)}...
                            </span>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(reading.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadReadings((page - 1) * limit)}
                      disabled={page === 0 || hasChanges}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadReadings((page + 1) * limit)}
                      disabled={page >= totalPages - 1 || hasChanges}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
