'use client'

import { useState, useEffect } from 'react'
import { familyImagesAPI, type FamilyImage } from '@/lib/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ImageCardProps {
  image: FamilyImage
  onClaim: () => void
  onRelease: () => void
  onDelete: () => void
  onProcess: () => void
}

export function ImageCard({ image, onClaim, onRelease, onDelete, onProcess }: ImageCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loadingImage, setLoadingImage] = useState(false)

  // Load image preview
  useEffect(() => {
    let cancelled = false

    const loadImage = async () => {
      setLoadingImage(true)
      try {
        const blob = await familyImagesAPI.download(image.id)
        if (!cancelled) {
          const url = URL.createObjectURL(blob)
          setImageUrl(url)
        }
      } catch {
        // Silently fail - image preview is optional
      } finally {
        if (!cancelled) {
          setLoadingImage(false)
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

  const statusColors = {
    pending: 'bg-yellow-500',
    claimed: 'bg-blue-500',
    processing: 'bg-blue-500',
    processed: 'bg-green-500',
    error: 'bg-red-500',
  }

  const statusLabels = {
    pending: 'Pending',
    claimed: 'Claimed',
    processing: 'Processing',
    processed: 'Processed',
    error: 'Error',
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card className="overflow-hidden">
      {/* Image Preview */}
      <div className="relative aspect-video bg-muted">
        {loadingImage ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={image.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Status Badge */}
        <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium text-white ${statusColors[image.status]}`}>
          {statusLabels[image.status]}
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Filename and Info */}
        <div>
          <p className="font-medium truncate" title={image.filename}>
            {image.filename}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(image.file_size)} - {formatDate(image.created_at)}
          </p>
        </div>

        {/* Uploader / Processor Info */}
        <div className="text-sm text-muted-foreground">
          {image.status === 'processed' ? (
            <p>
              Processed by <span className="font-medium text-foreground">{image.processed_by_name || 'Member'}</span>
              {' - '}{image.readings_count} reading{image.readings_count !== 1 ? 's' : ''}
            </p>
          ) : image.status === 'claimed' || image.status === 'processing' ? (
            <p>
              Claimed by <span className="font-medium text-foreground">{image.claimed_by_name || 'Member'}</span>
            </p>
          ) : (
            <p>
              Uploaded by <span className="font-medium text-foreground">{image.uploader_name || 'Member'}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {image.status === 'pending' && (
            <>
              <Button size="sm" className="flex-1" onClick={onClaim}>
                Claim & Process
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </>
          )}

          {(image.status === 'claimed' || image.status === 'processing') && (
            <>
              <Button size="sm" className="flex-1" onClick={onProcess}>
                Process Now
              </Button>
              <Button size="sm" variant="outline" onClick={onRelease}>
                Release
              </Button>
            </>
          )}

          {image.status === 'processed' && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Completed
            </p>
          )}

          {image.status === 'error' && (
            <Button size="sm" variant="outline" className="flex-1" onClick={onClaim}>
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
