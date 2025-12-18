'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Region, generateRegionId, isValidRegion } from '@/lib/image-crop'

interface RegionSelectorProps {
  imageUrl: string
  regions: Region[]
  onRegionsChange: (regions: Region[]) => void
}

interface DrawingState {
  isDrawing: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface ImageBounds {
  displayWidth: number
  displayHeight: number
  offsetX: number
  offsetY: number
}

export function RegionSelector({
  imageUrl,
  regions,
  onRegionsChange,
}: RegionSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [drawing, setDrawing] = useState<DrawingState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  })
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageBounds, setImageBounds] = useState<ImageBounds | null>(null)

  // Calculate actual image bounds within container (accounting for object-contain)
  const calculateImageBounds = useCallback((): ImageBounds | null => {
    const img = imageRef.current
    const container = containerRef.current
    if (!img || !container || !img.naturalWidth || !img.naturalHeight) return null

    const containerRect = container.getBoundingClientRect()
    const imgAspect = img.naturalWidth / img.naturalHeight
    const containerAspect = containerRect.width / containerRect.height

    let displayWidth: number
    let displayHeight: number
    let offsetX: number
    let offsetY: number

    if (imgAspect > containerAspect) {
      // Image is wider than container - fits to width
      displayWidth = containerRect.width
      displayHeight = containerRect.width / imgAspect
      offsetX = 0
      offsetY = (containerRect.height - displayHeight) / 2
    } else {
      // Image is taller than container - fits to height
      displayHeight = containerRect.height
      displayWidth = containerRect.height * imgAspect
      offsetX = (containerRect.width - displayWidth) / 2
      offsetY = 0
    }

    return { displayWidth, displayHeight, offsetX, offsetY }
  }, [])

  // Get mouse position as percentage of ACTUAL IMAGE (not container)
  const getPercentPosition = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      const container = containerRef.current
      const bounds = calculateImageBounds()
      if (!container || !bounds) return { x: 0, y: 0 }

      const containerRect = container.getBoundingClientRect()

      // Mouse position relative to container
      const mouseX = e.clientX - containerRect.left
      const mouseY = e.clientY - containerRect.top

      // Convert to position relative to actual image bounds
      const relativeX = mouseX - bounds.offsetX
      const relativeY = mouseY - bounds.offsetY

      // Convert to percentage of image
      const x = (relativeX / bounds.displayWidth) * 100
      const y = (relativeY / bounds.displayHeight) * 100

      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      }
    },
    [calculateImageBounds]
  )

  // Handle image load
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
    const bounds = calculateImageBounds()
    setImageBounds(bounds)
  }, [calculateImageBounds])

  // Handle mouse down - start drawing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start drawing with left click
      if (e.button !== 0) return

      const pos = getPercentPosition(e)
      setDrawing({
        isDrawing: true,
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
      })
    },
    [getPercentPosition]
  )

  // Handle mouse move - update drawing
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing.isDrawing) return

      const pos = getPercentPosition(e)
      setDrawing((prev) => ({
        ...prev,
        currentX: pos.x,
        currentY: pos.y,
      }))
    },
    [drawing.isDrawing, getPercentPosition]
  )

  // Handle mouse up - finish drawing
  const handleMouseUp = useCallback(() => {
    if (!drawing.isDrawing) return

    // Calculate region from drawing state
    const x = Math.min(drawing.startX, drawing.currentX)
    const y = Math.min(drawing.startY, drawing.currentY)
    const width = Math.abs(drawing.currentX - drawing.startX)
    const height = Math.abs(drawing.currentY - drawing.startY)

    const newRegion: Region = {
      id: generateRegionId(),
      x,
      y,
      width,
      height,
    }

    // Only add if valid size
    if (isValidRegion(newRegion)) {
      onRegionsChange([...regions, newRegion])
    }

    setDrawing({
      isDrawing: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    })
  }, [drawing, regions, onRegionsChange])

  // Handle click on existing region - delete it
  const handleRegionClick = useCallback(
    (e: React.MouseEvent, regionId: string) => {
      e.stopPropagation()
      onRegionsChange(regions.filter((r) => r.id !== regionId))
    },
    [regions, onRegionsChange]
  )

  // Clear all regions
  const handleClearAll = useCallback(() => {
    onRegionsChange([])
  }, [onRegionsChange])

  // Handle mouse leave - cancel drawing
  const handleMouseLeave = useCallback(() => {
    if (drawing.isDrawing) {
      setDrawing({
        isDrawing: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      })
    }
  }, [drawing.isDrawing])

  // Calculate current drawing rectangle
  const currentRect = drawing.isDrawing
    ? {
        x: Math.min(drawing.startX, drawing.currentX),
        y: Math.min(drawing.startY, drawing.currentY),
        width: Math.abs(drawing.currentX - drawing.startX),
        height: Math.abs(drawing.currentY - drawing.startY),
      }
    : null

  // Convert image-relative percentage to container-relative percentage for display
  const toContainerPercent = useCallback(
    (imgPercent: number, dimension: 'x' | 'y' | 'width' | 'height'): number => {
      const container = containerRef.current
      const bounds = imageBounds
      if (!container || !bounds) return imgPercent

      const containerRect = container.getBoundingClientRect()

      if (dimension === 'x') {
        const imgPixel = (imgPercent / 100) * bounds.displayWidth
        return ((bounds.offsetX + imgPixel) / containerRect.width) * 100
      } else if (dimension === 'y') {
        const imgPixel = (imgPercent / 100) * bounds.displayHeight
        return ((bounds.offsetY + imgPixel) / containerRect.height) * 100
      } else if (dimension === 'width') {
        const imgPixel = (imgPercent / 100) * bounds.displayWidth
        return (imgPixel / containerRect.width) * 100
      } else {
        const imgPixel = (imgPercent / 100) * bounds.displayHeight
        return (imgPixel / containerRect.height) * 100
      }
    },
    [imageBounds]
  )

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">
          Draw boxes around each table
        </p>
        <p>Click and drag to draw. Click a box to remove it.</p>
      </div>

      {/* Image container with drawing overlay */}
      <div
        ref={containerRef}
        className="relative cursor-crosshair select-none border rounded-lg overflow-hidden bg-muted"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Source image */}
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Solar log to segment"
          className="w-full rounded-lg border max-h-[80vh] object-contain bg-muted"
          onLoad={handleImageLoad}
          draggable={false}
        />

        {/* Existing regions */}
        {imageLoaded &&
          imageBounds &&
          regions.map((region, index) => (
            <div
              key={region.id}
              className="absolute border-2 border-orange-500 bg-orange-500/20 cursor-pointer hover:bg-orange-500/30 transition-colors"
              style={{
                left: `${toContainerPercent(region.x, 'x')}%`,
                top: `${toContainerPercent(region.y, 'y')}%`,
                width: `${toContainerPercent(region.width, 'width')}%`,
                height: `${toContainerPercent(region.height, 'height')}%`,
              }}
              onClick={(e) => handleRegionClick(e, region.id)}
            >
              {/* Region number label */}
              <div className="absolute -top-6 left-0 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                Table {index + 1}
              </div>
            </div>
          ))}

        {/* Current drawing rectangle */}
        {currentRect && currentRect.width > 0 && currentRect.height > 0 && imageBounds && (
          <div
            className="absolute border-2 border-dashed border-orange-400 bg-orange-400/10 pointer-events-none"
            style={{
              left: `${toContainerPercent(currentRect.x, 'x')}%`,
              top: `${toContainerPercent(currentRect.y, 'y')}%`,
              width: `${toContainerPercent(currentRect.width, 'width')}%`,
              height: `${toContainerPercent(currentRect.height, 'height')}%`,
            }}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {regions.length === 0
            ? 'No tables selected'
            : `${regions.length} table${regions.length > 1 ? 's' : ''} selected`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          disabled={regions.length === 0}
        >
          Clear All
        </Button>
      </div>
    </div>
  )
}
