'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadImage, readingsAPI, type ExtractedReading } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type UploadStatus = 'idle' | 'uploading' | 'reviewing' | 'saving' | 'complete' | 'error'

interface EditableReading extends ExtractedReading {
  selected: boolean
}

interface UploadState {
  status: UploadStatus
  readings: EditableReading[]
  error: string | null
  provider: string | null
}

interface UploadPanelProps {
  onComplete: () => void
  onCancel: () => void
}

export function UploadPanel({ onComplete, onCancel }: UploadPanelProps) {
  const [state, setState] = useState<UploadState>({
    status: 'idle',
    readings: [],
    error: null,
    provider: null,
  })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    setState(s => ({
      ...s,
      status: 'uploading',
      error: null,
      readings: [],
    }))

    try {
      const result = await uploadImage(file)
      const editableReadings: EditableReading[] = result.readings.map(r => ({
        ...r,
        selected: true,
      }))

      setState(s => ({
        ...s,
        status: 'reviewing',
        readings: editableReadings,
        provider: result.provider,
      }))
    } catch (err) {
      setState(s => ({
        ...s,
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      }))
    }
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
    disabled: state.status === 'uploading' || state.status === 'saving',
    // Required for React 19 types compatibility
    onDragEnter: undefined,
    onDragLeave: undefined,
    onDragOver: undefined,
    multiple: false,
  })

  const toggleReading = (index: number) => {
    setState(s => ({
      ...s,
      readings: s.readings.map((r, i) =>
        i === index ? { ...r, selected: !r.selected } : r
      ),
    }))
  }

  const updateReading = (index: number, field: keyof ExtractedReading, value: string | number | null) => {
    setState(s => ({
      ...s,
      readings: s.readings.map((r, i) =>
        i === index ? { ...r, [field]: value } : r
      ),
    }))
  }

  const selectAll = () => {
    setState(s => ({
      ...s,
      readings: s.readings.map(r => ({ ...r, selected: true })),
    }))
  }

  const selectNone = () => {
    setState(s => ({
      ...s,
      readings: s.readings.map(r => ({ ...r, selected: false })),
    }))
  }

  const selectedCount = state.readings.filter(r => r.selected).length

  const handleConfirm = async () => {
    const selectedReadings = state.readings
      .filter(r => r.selected)
      .map(r => ({
        date: r.date,
        time: r.time,
        m1: r.m1,
        m2: r.m2,
        notes: r.notes,
        is_verified: true,
      }))

    if (selectedReadings.length === 0) {
      setState(s => ({ ...s, error: 'No readings selected' }))
      return
    }

    setState(s => ({ ...s, status: 'saving', error: null }))

    try {
      await readingsAPI.createBulk(selectedReadings)
      setState(s => ({ ...s, status: 'complete' }))
      // Notify parent after short delay for user feedback
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

  const resetUpload = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setState({
      status: 'idle',
      readings: [],
      error: null,
      provider: null,
    })
  }

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
        )}

        {/* Uploading State */}
        {state.status === 'uploading' && (
          <div className="text-center py-8 space-y-4">
            <div className="h-8 w-8 mx-auto rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
            <p className="font-medium">Processing image with AI...</p>
            <p className="text-sm text-muted-foreground">This may take a few seconds</p>
          </div>
        )}

        {/* Error State */}
        {state.status === 'error' && (
          <div className="text-center py-8 space-y-4">
            <p className="font-medium text-destructive">Processing failed</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={resetUpload} size="sm">Try Again</Button>
              <Button onClick={onCancel} variant="outline" size="sm">Cancel</Button>
            </div>
          </div>
        )}

        {/* Review State */}
        {(state.status === 'reviewing' || state.status === 'saving') && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Image Preview */}
              {previewUrl && (
                <div>
                  <p className="text-sm font-medium mb-2">Uploaded Image</p>
                  <img
                    src={previewUrl}
                    alt="Uploaded solar log"
                    className="w-full rounded-lg border max-h-[60vh] object-contain bg-muted"
                  />
                </div>
              )}

              {/* Readings Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">
                    Extracted Readings ({selectedCount}/{state.readings.length})
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

                {state.readings.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No readings could be extracted.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="p-2 w-6"></th>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Time</th>
                          <th className="p-2 text-right">M1</th>
                          <th className="p-2 text-right">M2</th>
                          <th className="p-2 text-left">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.readings.map((reading, index) => (
                          <tr
                            key={index}
                            className={`border-t ${reading.selected ? '' : 'opacity-50'}`}
                          >
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={reading.selected}
                                onChange={() => toggleReading(index)}
                                className="h-4 w-4"
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
                            <td className="p-2">
                              <input
                                type="text"
                                value={reading.notes || ''}
                                onChange={(e) => updateReading(index, 'notes', e.target.value || null)}
                                placeholder="Notes..."
                                className="w-full bg-transparent text-sm focus:outline-none"
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

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                onClick={handleConfirm}
                disabled={selectedCount === 0 || state.status === 'saving'}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {state.status === 'saving' ? 'Saving...' : `Save ${selectedCount} Reading${selectedCount !== 1 ? 's' : ''}`}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  resetUpload()
                  onCancel()
                }}
                disabled={state.status === 'saving'}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Complete State */}
        {state.status === 'complete' && (
          <div className="text-center py-8 space-y-3">
            <div className="text-green-500 text-4xl">&#10003;</div>
            <p className="font-medium text-green-500">
              Saved {selectedCount} reading{selectedCount !== 1 ? 's' : ''}!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
