/**
 * Image cropping utility using Canvas API
 */

export interface Region {
  id: string
  x: number      // % from left (0-100)
  y: number      // % from top (0-100)
  width: number  // % of image width
  height: number // % of image height
}

/**
 * Load an image from URL into an HTMLImageElement
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/**
 * Crop a region from an image and return as Blob
 *
 * @param imageUrl - URL of the source image (can be blob URL)
 * @param region - Region to crop (coordinates as percentages 0-100)
 * @param outputFormat - Output format (default: image/jpeg)
 * @param quality - JPEG quality 0-1 (default: 0.9)
 * @returns Blob of the cropped image
 */
export async function cropImage(
  imageUrl: string,
  region: Region,
  outputFormat: string = 'image/jpeg',
  quality: number = 0.9
): Promise<Blob> {
  const img = await loadImage(imageUrl)

  // Calculate pixel coordinates from percentages
  const pixelX = Math.round((region.x / 100) * img.naturalWidth)
  const pixelY = Math.round((region.y / 100) * img.naturalHeight)
  const pixelWidth = Math.round((region.width / 100) * img.naturalWidth)
  const pixelHeight = Math.round((region.height / 100) * img.naturalHeight)

  // Create canvas for cropped region
  const canvas = document.createElement('canvas')
  canvas.width = pixelWidth
  canvas.height = pixelHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  // Draw the cropped region
  ctx.drawImage(
    img,
    pixelX, pixelY, pixelWidth, pixelHeight, // Source rectangle
    0, 0, pixelWidth, pixelHeight              // Destination rectangle
  )

  // Export as blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      },
      outputFormat,
      quality
    )
  })
}

/**
 * Crop multiple regions from an image
 *
 * @param imageUrl - URL of the source image
 * @param regions - Array of regions to crop
 * @returns Array of Blobs in same order as regions
 */
export async function cropMultipleRegions(
  imageUrl: string,
  regions: Region[]
): Promise<Blob[]> {
  // Load image once, crop all regions
  const img = await loadImage(imageUrl)

  return Promise.all(
    regions.map(async (region) => {
      const pixelX = Math.round((region.x / 100) * img.naturalWidth)
      const pixelY = Math.round((region.y / 100) * img.naturalHeight)
      const pixelWidth = Math.round((region.width / 100) * img.naturalWidth)
      const pixelHeight = Math.round((region.height / 100) * img.naturalHeight)

      const canvas = document.createElement('canvas')
      canvas.width = pixelWidth
      canvas.height = pixelHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Failed to get canvas context')
      }

      ctx.drawImage(
        img,
        pixelX, pixelY, pixelWidth, pixelHeight,
        0, 0, pixelWidth, pixelHeight
      )

      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to create blob'))
          },
          'image/jpeg',
          0.9
        )
      })
    })
  )
}

/**
 * Generate a unique region ID
 */
export function generateRegionId(): string {
  return `region-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Validate region has minimum size (at least 5% in each dimension)
 */
export function isValidRegion(region: Region): boolean {
  return region.width >= 5 && region.height >= 5
}
