'use client'

import { useState, useEffect } from 'react'
import { familyImagesAPI, readingsAPI, type FamilyImage, type ExtractedReading } from '@/lib/api/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ProcessImageDialogProps {
  image: FamilyImage
  onClose: () => void
  onComplete: () => void
}

export function ProcessImageDialog({ image, onClose, onComplete }: ProcessImageDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readings, setReadings] = useState<ExtractedReading[]>([])
  const [step, setStep] = useState<'preview' | 'processing' | 'review'>('preview')

  // Load image
  useEffect(() => {
    let cancelled = false

    const loadImage = async () => {
      try {
        const blob = await familyImagesAPI.download(image.id)
        if (!cancelled) {
          const url = URL.createObjectURL(blob)
          setImageUrl(url)
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load image')
        }
      }
    }

    loadImage()

    return () => {
      cancelled = true
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [image.id])

  const handleProcess = async () => {
    setError(null)
    setProcessing(true)
    setStep('processing')

    try {
      const result = await familyImagesAPI.process(image.id)
      setReadings(result.readings)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
      setStep('preview')
    } finally {
      setProcessing(false)
    }
  }

  const handleSave = async () => {
    if (readings.length === 0) {
      onComplete()
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Convert readings to the format expected by the API
      const readingsToSave = readings.map(r => ({
        date: r.date,
        time: r.time,
        m1: r.m1,
        m2: r.m2,
        notes: r.notes,
        is_verified: false,
      }))

      await readingsAPI.createBulk(readingsToSave)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save readings')
    } finally {
      setSaving(false)
    }
  }

  const updateReading = (index: number, field: keyof ExtractedReading, value: string | number | null) => {
    const updated = [...readings]
    updated[index] = { ...updated[index], [field]: value }
    setReadings(updated)
  }

  const removeReading = (index: number) => {
    setReadings(readings.filter((_, i) => i !== index))
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'preview' && 'Process Image'}
            {step === 'processing' && 'Processing...'}
            {step === 'review' && 'Review Readings'}
          </DialogTitle>
          <DialogDescription>
            {step === 'preview' && 'Send this image to AI for data extraction'}
            {step === 'processing' && 'Extracting readings from the image...'}
            {step === 'review' && `Found ${readings.length} reading${readings.length !== 1 ? 's' : ''}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Image Preview */}
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={image.filename}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
          </div>

          {/* Processing Spinner */}
          {step === 'processing' && (
            <div className="flex flex-col items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Analyzing image with AI...</p>
            </div>
          )}

          {/* Review Readings */}
          {step === 'review' && readings.length > 0 && (
            <div className="space-y-4">
              {readings.map((reading, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Reading {index + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeReading(index)}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={reading.date}
                        onChange={(e) => updateReading(index, 'date', e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={reading.time || ''}
                        onChange={(e) => updateReading(index, 'time', e.target.value || null)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>M1 (kWh)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={reading.m1}
                        onChange={(e) => updateReading(index, 'm1', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>M2 (kWh)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={reading.m2 || ''}
                        onChange={(e) => updateReading(index, 'm2', e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Input
                      value={reading.notes || ''}
                      onChange={(e) => updateReading(index, 'notes', e.target.value || null)}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'review' && readings.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No readings were extracted from this image.</p>
            </div>
          )}

          {/* Error Display with Retry */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg space-y-3">
              <p>{error}</p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setError(null)
                    handleProcess()
                  }}
                >
                  Retry Processing
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing || saving}>
            Cancel
          </Button>

          {step === 'preview' && (
            <Button onClick={handleProcess} disabled={processing || !imageUrl}>
              Process with AI
            </Button>
          )}

          {step === 'review' && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : readings.length > 0 ? `Save ${readings.length} Reading${readings.length !== 1 ? 's' : ''}` : 'Done'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
