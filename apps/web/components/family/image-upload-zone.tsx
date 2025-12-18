'use client'

import { useState, useCallback } from 'react'
import { familyImagesAPI } from '@/lib/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ImageUploadZoneProps {
  onUploadComplete: () => void
}

export function ImageUploadZone({ onUploadComplete }: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    )

    if (files.length === 0) {
      setError('Please drop image files only')
      return
    }

    await uploadFiles(files)
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    await uploadFiles(files)
    e.target.value = '' // Reset input
  }, [])

  const uploadFiles = async (files: File[]) => {
    setError(null)
    setUploading(true)
    setUploadProgress(`Uploading ${files.length} image${files.length > 1 ? 's' : ''}...`)

    try {
      const uploaded = await familyImagesAPI.uploadBulk(files)
      setUploadProgress(`Successfully uploaded ${uploaded.length} image${uploaded.length > 1 ? 's' : ''}`)
      onUploadComplete()

      // Clear success message after 3 seconds
      setTimeout(() => setUploadProgress(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploadProgress(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 transition-colors
            ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            ${uploading ? 'pointer-events-none opacity-50' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center text-center">
            <svg
              className={`w-12 h-12 mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>

            <p className="text-lg font-medium mb-1">
              {uploading ? 'Uploading...' : 'Drop images here'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to select files
            </p>

            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={uploading}
            />

            <Button asChild variant="outline" disabled={uploading}>
              <label htmlFor="file-upload" className="cursor-pointer">
                Select Files
              </label>
            </Button>

            <p className="text-xs text-muted-foreground mt-4">
              Supports JPG, PNG, WebP (max 10MB each)
            </p>
          </div>
        </div>

        {uploadProgress && (
          <div className="p-4 bg-primary/10 text-primary text-sm text-center">
            {uploadProgress}
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive text-sm text-center">
            {error}
            <Button variant="link" className="ml-2 p-0 h-auto text-destructive" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
