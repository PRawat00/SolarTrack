'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadImage, readingsAPI, familyAPI, familyImagesAPI, type ExtractedReading, type ImageCountsResponse, type TableRegion } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RegionSelector } from './region-selector'
import { Region, cropImage, generateRegionId } from '@/lib/image-crop'

type UploadStatus =
  | 'idle'
  | 'selecting-regions'
  | 'processing'
  | 'reviewing'
  | 'saving'
  | 'complete'
  | 'error'

interface EditableReading extends ExtractedReading {
  selected: boolean
}

interface TableResult {
  tableIndex: number
  croppedImageUrl: string | null
  readings: EditableReading[]
  status: 'pending' | 'processing' | 'done' | 'error'
  error: string | null
}

interface UploadState {
  status: UploadStatus
  regions: Region[]
  currentTableIndex: number
  tableResults: TableResult[]
  error: string | null
  provider: string | null
}

interface UploadPanelProps {
  onComplete: () => void
  onCancel: () => void
  visible?: boolean
}

// Convert API TableRegion (0-1 normalized) to display Region (0-100 percentages)
function apiToDisplayRegion(apiRegion: TableRegion): Region {
  return {
    id: generateRegionId(),
    x: apiRegion.x * 100,
    y: apiRegion.y * 100,
    width: apiRegion.width * 100,
    height: apiRegion.height * 100,
  }
}

export function UploadPanel({ onComplete, onCancel, visible = true }: UploadPanelProps) {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    regions: [],
    currentTableIndex: 0,
    tableResults: [],
    error: null,
    provider: null,
  })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const processingRef = useRef<Set<number>>(new Set())

  // Family integration state
  const [isInFamily, setIsInFamily] = useState<boolean>(false)
  const [familyCounts, setFamilyCounts] = useState<ImageCountsResponse | null>(null)
  const [fetchingFamily, setFetchingFamily] = useState<boolean>(false)
  const [familyImageId, setFamilyImageId] = useState<string | null>(null)

  // Load family status on mount AND when panel becomes visible
  useEffect(() => {
    if (visible === false) return  // Don't fetch when hidden

    const checkFamily = async () => {
      try {
        const family = await familyAPI.get()
        setIsInFamily(!!family)
        if (family) {
          const counts = await familyImagesAPI.getCounts()
          setFamilyCounts(counts)
        }
      } catch {
        // Not in family or error - that's fine
        setIsInFamily(false)
      }
    }
    checkFamily()
  }, [visible])

  // Fetch image from family pool
  const handleFetchFromFamily = useCallback(async (status: 'uploaded' | 'tagged') => {
    setFetchingFamily(true)
    try {
      // Get a random image with the specified status
      const image = await familyImagesAPI.getRandom(status)

      // Claim the image to prevent others from processing it
      const claimedImage = await familyImagesAPI.claim(image.id)

      // Download the image
      const blob = await familyImagesAPI.download(claimedImage.id)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setFamilyImageId(claimedImage.id)

      // If image is already tagged, load the regions
      if (status === 'tagged' && claimedImage.table_regions && claimedImage.table_regions.length > 0) {
        const displayRegions = claimedImage.table_regions.map(apiToDisplayRegion)
        setState(s => ({
          ...s,
          status: 'selecting-regions',
          regions: displayRegions,
          error: null,
          currentTableIndex: 0,
          tableResults: [],
        }))
      } else {
        // Untagged image - user needs to draw regions
        setState(s => ({
          ...s,
          status: 'selecting-regions',
          regions: [],
          error: null,
          currentTableIndex: 0,
          tableResults: [],
        }))
      }

      // Refresh counts after claiming
      const counts = await familyImagesAPI.getCounts()
      setFamilyCounts(counts)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch image'
      setState(s => ({ ...s, error: errorMsg }))
    } finally {
      setFetchingFamily(false)
    }
  }, [])

  // Handle file drop - move to region selection
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    setState(s => ({
      ...s,
      status: 'selecting-regions',
      error: null,
      regions: [],
      currentTableIndex: 0,
      tableResults: [],
    }))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: state.status !== 'idle',
    onDragEnter: undefined,
    onDragLeave: undefined,
    onDragOver: undefined,
    multiple: false,
  })

  // Update regions from selector
  const handleRegionsChange = useCallback((regions: Region[]) => {
    setState(s => ({ ...s, regions }))
  }, [])

  // Process a single table
  const processTable = useCallback(async (tableIndex: number) => {
    if (!previewUrl || processingRef.current.has(tableIndex)) return

    const region = state.regions[tableIndex]
    if (!region) return

    processingRef.current.add(tableIndex)

    // Mark as processing
    setState(s => ({
      ...s,
      tableResults: s.tableResults.map((r, i) =>
        i === tableIndex ? { ...r, status: 'processing' } : r
      ),
    }))

    try {
      // Crop the image
      const croppedBlob = await cropImage(previewUrl, region)
      const croppedUrl = URL.createObjectURL(croppedBlob)
      const croppedFile = new File([croppedBlob], `table-${tableIndex + 1}.jpg`, {
        type: 'image/jpeg',
      })

      // Upload to API
      const result = await uploadImage(croppedFile)

      const editableReadings: EditableReading[] = result.readings.map(r => ({
        ...r,
        selected: true,
      }))

      // Mark as done
      setState(s => ({
        ...s,
        provider: result.provider,
        tableResults: s.tableResults.map((r, i) =>
          i === tableIndex
            ? { ...r, status: 'done', croppedImageUrl: croppedUrl, readings: editableReadings }
            : r
        ),
      }))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Processing failed'
      setState(s => ({
        ...s,
        tableResults: s.tableResults.map((r, i) =>
          i === tableIndex ? { ...r, status: 'error', error: errorMsg } : r
        ),
      }))
    } finally {
      processingRef.current.delete(tableIndex)
    }
  }, [previewUrl, state.regions])

  // Start processing all regions - begins with Table 1
  const handleProcessRegions = useCallback(async () => {
    if (!previewUrl || state.regions.length === 0) return

    // Initialize table results
    const initialResults: TableResult[] = state.regions.map((_, i) => ({
      tableIndex: i,
      croppedImageUrl: null,
      readings: [],
      status: 'pending',
      error: null,
    }))

    setState(s => ({
      ...s,
      status: 'processing',
      currentTableIndex: 0,
      tableResults: initialResults,
      error: null,
    }))

    // Start processing first table
    processingRef.current.clear()
  }, [previewUrl, state.regions])

  // Effect to process tables - chain processing (when one finishes, start next)
  useEffect(() => {
    if (state.status !== 'processing' && state.status !== 'reviewing') return
    if (state.tableResults.length === 0) return

    // Find first pending table where previous is done/error (or it's the first table)
    for (let i = 0; i < state.tableResults.length; i++) {
      const result = state.tableResults[i]
      if (result.status === 'pending') {
        const prevDone = i === 0 ||
          state.tableResults[i - 1].status === 'done' ||
          state.tableResults[i - 1].status === 'error'
        if (prevDone) {
          processTable(i)
          break // Only start one at a time
        }
      }
    }

    // Move to reviewing when first table is done
    if (state.status === 'processing') {
      const firstResult = state.tableResults[0]
      if (firstResult?.status === 'done') {
        setState(s => ({ ...s, status: 'reviewing' }))
      } else if (firstResult?.status === 'error') {
        // If first failed, find next done table to show
        const nextDone = state.tableResults.findIndex(r => r.status === 'done')
        if (nextDone >= 0) {
          setState(s => ({ ...s, status: 'reviewing', currentTableIndex: nextDone }))
        } else if (state.tableResults.every(r => r.status === 'error')) {
          setState(s => ({ ...s, status: 'error', error: 'All tables failed to process' }))
        }
      }
    }
  }, [state.status, state.tableResults, processTable])

  // Navigation
  const goToNextTable = useCallback(() => {
    setState(s => {
      const nextIndex = s.currentTableIndex + 1
      if (nextIndex >= s.tableResults.length) return s
      return { ...s, currentTableIndex: nextIndex }
    })
  }, [])

  const goToPrevTable = useCallback(() => {
    setState(s => {
      const prevIndex = s.currentTableIndex - 1
      if (prevIndex < 0) return s
      return { ...s, currentTableIndex: prevIndex }
    })
  }, [])

  // Toggle reading selection for current table
  const toggleReading = (readingIndex: number) => {
    setState(s => ({
      ...s,
      tableResults: s.tableResults.map((table, ti) =>
        ti === s.currentTableIndex
          ? {
              ...table,
              readings: table.readings.map((r, ri) =>
                ri === readingIndex ? { ...r, selected: !r.selected } : r
              ),
            }
          : table
      ),
    }))
  }

  // Update reading for current table
  const updateReading = (readingIndex: number, field: keyof ExtractedReading, value: string | number | null) => {
    setState(s => ({
      ...s,
      tableResults: s.tableResults.map((table, ti) =>
        ti === s.currentTableIndex
          ? {
              ...table,
              readings: table.readings.map((r, ri) =>
                ri === readingIndex ? { ...r, [field]: value } : r
              ),
            }
          : table
      ),
    }))
  }

  const selectAll = () => {
    setState(s => ({
      ...s,
      tableResults: s.tableResults.map((table, ti) =>
        ti === s.currentTableIndex
          ? { ...table, readings: table.readings.map(r => ({ ...r, selected: true })) }
          : table
      ),
    }))
  }

  const selectNone = () => {
    setState(s => ({
      ...s,
      tableResults: s.tableResults.map((table, ti) =>
        ti === s.currentTableIndex
          ? { ...table, readings: table.readings.map(r => ({ ...r, selected: false })) }
          : table
      ),
    }))
  }

  // Get total selected readings across all tables
  const getTotalSelectedCount = () => {
    return state.tableResults.reduce(
      (sum, table) => sum + table.readings.filter(r => r.selected).length,
      0
    )
  }

  // Save all readings from all tables
  const handleSaveAll = async () => {
    const allSelectedReadings = state.tableResults.flatMap(table =>
      table.readings
        .filter(r => r.selected)
        .map(r => ({
          date: r.date,
          time: r.time,
          m1: r.m1,
          m2: r.m2,
          notes: r.notes,
          is_verified: true,
        }))
    )

    if (allSelectedReadings.length === 0) {
      setState(s => ({ ...s, error: 'No readings selected' }))
      return
    }

    setState(s => ({ ...s, status: 'saving', error: null }))

    try {
      await readingsAPI.createBulk(allSelectedReadings)

      // If this was a family image, mark it as complete
      if (familyImageId) {
        try {
          await familyImagesAPI.complete(familyImageId, allSelectedReadings.length)
        } catch {
          // Don't fail the whole save if marking complete fails
          console.error('Failed to mark family image as complete')
        }
      }

      setState(s => ({ ...s, status: 'complete' }))
      setTimeout(() => {
        onComplete()
      }, 1500)
    } catch (err) {
      setState(s => ({
        ...s,
        status: 'reviewing',
        error: err instanceof Error ? err.message : 'Failed to save readings',
      }))
    }
  }

  const resetUpload = useCallback(async (releaseImage: boolean = true) => {
    // Release family image if we're cancelling
    if (releaseImage && familyImageId) {
      try {
        await familyImagesAPI.release(familyImageId)
      } catch {
        // Ignore errors - image might already be released
      }
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    // Clean up cropped image URLs
    state.tableResults.forEach(table => {
      if (table.croppedImageUrl) {
        URL.revokeObjectURL(table.croppedImageUrl)
      }
    })
    setPreviewUrl(null)
    setFamilyImageId(null)
    processingRef.current.clear()
    setState({
      status: 'idle',
      regions: [],
      currentTableIndex: 0,
      tableResults: [],
      error: null,
      provider: null,
    })

    // Refresh family counts
    if (isInFamily) {
      try {
        const counts = await familyImagesAPI.getCounts()
        setFamilyCounts(counts)
      } catch {
        // Ignore errors
      }
    }
  }, [previewUrl, state.tableResults, isInFamily, familyImageId])

  const handleBackToRegions = () => {
    // Clean up cropped image URLs
    state.tableResults.forEach(table => {
      if (table.croppedImageUrl) {
        URL.revokeObjectURL(table.croppedImageUrl)
      }
    })
    processingRef.current.clear()
    setState(s => ({
      ...s,
      status: 'selecting-regions',
      currentTableIndex: 0,
      tableResults: [],
      error: null,
    }))
  }

  // Current table data
  const currentTable = state.tableResults[state.currentTableIndex]
  const currentReadings = currentTable?.readings || []
  const currentSelectedCount = currentReadings.filter(r => r.selected).length
  const isLastTable = state.currentTableIndex === state.tableResults.length - 1
  const isFirstTable = state.currentTableIndex === 0

  return (
    <Card className="mt-4">
      <CardHeader className="pb-4">
        <CardTitle>Import Data</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload images to extract data automatically.
        </p>
      </CardHeader>
      <CardContent>
        {state.error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
            {state.error}
          </div>
        )}

        {/* Idle State - Drop Zone */}
        {state.status === 'idle' && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors duration-200
                ${isDragActive
                  ? 'border-orange-500 bg-orange-500/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'}
              `}
            >
              <input {...(getInputProps() as React.InputHTMLAttributes<HTMLInputElement>)} />
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-muted p-3">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Upload Images</p>
                  <p className="text-sm text-muted-foreground">
                    Drag and drop your handwritten logs or click to browse.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supported formats: JPG, PNG.
                  </p>
                </div>
              </div>
            </div>

            {/* Fetch from Family Section */}
            {isInFamily && familyCounts && familyCounts.total_available > 0 && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex-1 border-t" />
                  <span>or fetch from family pool</span>
                  <div className="flex-1 border-t" />
                </div>

                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFetchFromFamily('tagged')}
                    disabled={fetchingFamily || familyCounts.tagged_count === 0}
                    className="flex-1 max-w-[200px]"
                  >
                    {fetchingFamily ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Fetching...
                      </span>
                    ) : (
                      <>Fetch Tagged ({familyCounts.tagged_count})</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFetchFromFamily('uploaded')}
                    disabled={fetchingFamily || familyCounts.uploaded_count === 0}
                    className="flex-1 max-w-[200px]"
                  >
                    {fetchingFamily ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        Fetching...
                      </span>
                    ) : (
                      <>Fetch Untagged ({familyCounts.uploaded_count})</>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  {familyCounts.tagged_count > 0
                    ? `${familyCounts.tagged_count} images ready with pre-tagged tables`
                    : familyCounts.uploaded_count > 0
                      ? `${familyCounts.uploaded_count} images need table tagging`
                      : 'No images available in family pool'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Region Selection State */}
        {state.status === 'selecting-regions' && previewUrl && (
          <div className="space-y-4">
            <RegionSelector
              imageUrl={previewUrl}
              regions={state.regions}
              onRegionsChange={handleRegionsChange}
            />

            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={handleProcessRegions}
                disabled={state.regions.length === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                Process {state.regions.length} Table{state.regions.length !== 1 ? 's' : ''}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetUpload()
                  onCancel()
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Processing State (waiting for first table) */}
        {state.status === 'processing' && (
          <div className="text-center py-8 space-y-4">
            <div className="h-8 w-8 mx-auto rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
            <p className="font-medium">Processing Table 1...</p>
            <p className="text-sm text-muted-foreground">
              Extracting readings from your handwritten log
            </p>
          </div>
        )}

        {/* Error State */}
        {state.status === 'error' && (
          <div className="text-center py-8 space-y-4">
            <p className="font-medium text-destructive">Processing failed</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleBackToRegions} size="sm">
                Try Different Regions
              </Button>
              <Button onClick={() => resetUpload()} variant="outline" size="sm">
                Start Over
              </Button>
              <Button onClick={onCancel} variant="ghost" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Review State - One table at a time */}
        {(state.status === 'reviewing' || state.status === 'saving') && currentTable && (
          <div className="space-y-4">
            {/* Table indicator */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Table {state.currentTableIndex + 1} of {state.tableResults.length}
              </p>
              {currentTable.status === 'processing' && (
                <span className="text-sm text-orange-500 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                  Processing...
                </span>
              )}
              {currentTable.status === 'error' && (
                <span className="text-sm text-destructive">
                  Error: {currentTable.error}
                </span>
              )}
            </div>

            {/* Current table: cropped image + readings */}
            {currentTable.status === 'done' && (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Cropped Image */}
                <div>
                  <p className="text-sm font-medium mb-2">Table {state.currentTableIndex + 1}</p>
                  {currentTable.croppedImageUrl && (
                    <div className="overflow-auto rounded-lg border bg-muted max-h-[70vh]">
                      <img
                        src={currentTable.croppedImageUrl}
                        alt={`Table ${state.currentTableIndex + 1}`}
                        className="w-full object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Readings Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">
                      Readings ({currentSelectedCount}/{currentReadings.length})
                    </p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={selectAll} className="h-6 text-xs">
                        All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={selectNone} className="h-6 text-xs">
                        None
                      </Button>
                    </div>
                  </div>

                  {currentReadings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No readings extracted from this table.
                    </p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden max-h-[70vh] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="p-2 w-6"></th>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-left">Time</th>
                            <th className="p-2 text-right">M1</th>
                            <th className="p-2 text-right">M2</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentReadings.map((reading, index) => (
                            <tr
                              key={index}
                              className={`border-t ${reading.selected ? '' : 'opacity-50'}`}
                            >
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={reading.selected}
                                  onChange={() => toggleReading(index)}
                                  className="h-4 w-4 accent-orange-500"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="date"
                                  value={reading.date}
                                  onChange={(e) => updateReading(index, 'date', e.target.value)}
                                  className="w-full bg-transparent text-sm focus:outline-none"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="time"
                                  value={reading.time || ''}
                                  onChange={(e) => updateReading(index, 'time', e.target.value || null)}
                                  className="w-full bg-transparent text-sm focus:outline-none"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={reading.m1}
                                  onChange={(e) => updateReading(index, 'm1', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-transparent text-sm text-right font-mono focus:outline-none"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={reading.m2 ?? ''}
                                  onChange={(e) => updateReading(index, 'm2', e.target.value ? parseFloat(e.target.value) : null)}
                                  className="w-full bg-transparent text-sm text-right font-mono focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Waiting for current table */}
            {currentTable.status === 'processing' && (
              <div className="text-center py-8 space-y-4">
                <div className="h-8 w-8 mx-auto rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Processing Table {state.currentTableIndex + 1}...
                </p>
              </div>
            )}

            {/* Error for current table */}
            {currentTable.status === 'error' && (
              <div className="text-center py-8 space-y-4 bg-destructive/5 rounded-lg">
                <p className="text-destructive">Failed to process this table</p>
                <p className="text-sm text-muted-foreground">{currentTable.error}</p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                onClick={goToPrevTable}
                disabled={isFirstTable || state.status === 'saving'}
              >
                Back
              </Button>

              <div className="flex-1 text-center text-sm text-muted-foreground self-center">
                {getTotalSelectedCount()} readings selected total
              </div>

              {isLastTable ? (
                <Button
                  onClick={handleSaveAll}
                  disabled={getTotalSelectedCount() === 0 || state.status === 'saving'}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {state.status === 'saving' ? 'Saving...' : `Save All (${getTotalSelectedCount()})`}
                </Button>
              ) : (
                <Button
                  onClick={goToNextTable}
                  disabled={state.status === 'saving'}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  Next Table
                </Button>
              )}
            </div>

            {/* Cancel option */}
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetUpload()
                  onCancel()
                }}
                disabled={state.status === 'saving'}
              >
                Cancel Import
              </Button>
            </div>
          </div>
        )}

        {/* Complete State */}
        {state.status === 'complete' && (
          <div className="text-center py-8 space-y-3">
            <div className="text-green-500 text-4xl">&#10003;</div>
            <p className="font-medium text-green-500">
              Saved {getTotalSelectedCount()} readings!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
