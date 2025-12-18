'use client'

import { useState, useEffect, useCallback } from 'react'
import { familyImagesAPI, type FamilyImage, type TableRegion } from '@/lib/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RegionSelector } from '@/components/dashboard/region-selector'
import { Region, generateRegionId } from '@/lib/image-crop'

interface ImageTaggingDialogProps {
  image: FamilyImage
  onClose: () => void
  onComplete: () => void
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

// Convert display Region (0-100 percentages) to API TableRegion (0-1 normalized)
function displayToApiRegion(region: Region): TableRegion {
  return {
    x: region.x / 100,
    y: region.y / 100,
    width: region.width / 100,
    height: region.height / 100,
    label: 'Table',
  }
}

export function ImageTaggingDialog({ image, onClose, onComplete }: ImageTaggingDialogProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regions, setRegions] = useState<Region[]>([])

  // Load image
  useEffect(() => {
    let cancelled = false

    const loadImage = async () => {
      setLoading(true)
      setError(null)
      try {
        const blob = await familyImagesAPI.download(image.id)
        if (!cancelled) {
          const url = URL.createObjectURL(blob)
          setImageUrl(url)

          // Load existing regions if any
          if (image.table_regions && image.table_regions.length > 0) {
            const displayRegions = image.table_regions.map(apiToDisplayRegion)
            setRegions(displayRegions)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load image')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
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
  }, [image.id, image.table_regions])

  // Clean up URL on unmount
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [imageUrl])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      // Convert regions to API format
      const apiRegions = regions.map(displayToApiRegion)
      await familyImagesAPI.tag(image.id, apiRegions)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tags')
    } finally {
      setSaving(false)
    }
  }, [regions, image.id, onComplete])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Tag Tables - {image.filename}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            {error}
            <Button variant="link" className="ml-2 p-0 h-auto" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        ) : imageUrl ? (
          <RegionSelector
            imageUrl={imageUrl}
            regions={regions}
            onRegionsChange={setRegions}
          />
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              `Save ${regions.length} Table${regions.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
