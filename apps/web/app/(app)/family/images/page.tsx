'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { familyAPI, familyImagesAPI, type Family, type FamilyImage, type ImageListResponse } from '@/lib/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ImageUploadZone } from '@/components/family/image-upload-zone'
import { ImageCard } from '@/components/family/image-card'
import { ImageTaggingDialog } from '@/components/family/image-tagging-dialog'
import { FamilyGate } from '@/components/family/family-gate'

type StatusFilter = 'all' | 'uploaded' | 'tagged' | 'claimed' | 'processed' | 'error'

function FamilyImagesPageContent() {
  const [family, setFamily] = useState<Family | null>(null)
  const [imageList, setImageList] = useState<ImageListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [taggingImage, setTaggingImage] = useState<FamilyImage | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const familyData = await familyAPI.get()
      if (!familyData) {
        setError('You are not a member of any family')
        return
      }
      setFamily(familyData)

      const status = statusFilter === 'all' ? undefined : statusFilter
      const images = await familyImagesAPI.list(status)
      setImageList(images)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleUploadComplete = () => {
    loadData()
  }

  const handleDelete = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return

    try {
      await familyImagesAPI.delete(imageId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image')
    }
  }

  const handleTagComplete = () => {
    setTaggingImage(null)
    loadData()
  }

  const handleTag = (image: FamilyImage) => {
    setTaggingImage(image)
  }

  const handleRetry = async (imageId: string) => {
    try {
      await familyImagesAPI.retry(imageId)
      loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry image')
    }
  }

  if (loading && !imageList) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!family) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">{error || 'You are not a member of any family'}</p>
        <Link href="/family">
          <Button>Go to Family</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/family" className="hover:text-foreground">Family</Link>
            <span>/</span>
            <span>Images</span>
          </div>
          <h1 className="text-3xl font-bold">Image Pool</h1>
          <p className="text-muted-foreground">
            Upload images and tag tables. Process from dashboard.
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {imageList && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card className={statusFilter === 'all' ? 'border-primary' : 'cursor-pointer hover:border-primary/50'} onClick={() => setStatusFilter('all')}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{imageList.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className={statusFilter === 'uploaded' ? 'border-primary' : 'cursor-pointer hover:border-primary/50'} onClick={() => setStatusFilter('uploaded')}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-yellow-500">{imageList.uploaded_count}</p>
              <p className="text-sm text-muted-foreground">Need Tagging</p>
            </CardContent>
          </Card>
          <Card className={statusFilter === 'tagged' ? 'border-primary' : 'cursor-pointer hover:border-primary/50'} onClick={() => setStatusFilter('tagged')}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-orange-500">{imageList.tagged_count}</p>
              <p className="text-sm text-muted-foreground">Ready to Process</p>
            </CardContent>
          </Card>
          <Card className={statusFilter === 'claimed' ? 'border-primary' : 'cursor-pointer hover:border-primary/50'} onClick={() => setStatusFilter('claimed')}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-blue-500">{imageList.claimed_count}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card className={statusFilter === 'processed' ? 'border-primary' : 'cursor-pointer hover:border-primary/50'} onClick={() => setStatusFilter('processed')}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold text-green-500">{imageList.processed_count}</p>
              <p className="text-sm text-muted-foreground">Processed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Zone */}
      <ImageUploadZone onUploadComplete={handleUploadComplete} />

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {error}
          <Button variant="link" className="ml-2 p-0 h-auto" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Image Grid */}
      {imageList && imageList.images.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {imageList.images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              onDelete={() => handleDelete(image.id)}
              onTag={() => handleTag(image)}
              onRetry={image.status === 'error' ? () => handleRetry(image.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-muted-foreground">No images found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload images to get started
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tagging Dialog */}
      {taggingImage && (
        <ImageTaggingDialog
          image={taggingImage}
          onClose={() => setTaggingImage(null)}
          onComplete={handleTagComplete}
        />
      )}
    </div>
  )
}

export default function FamilyImagesPage() {
  return (
    <FamilyGate>
      <FamilyImagesPageContent />
    </FamilyGate>
  )
}
