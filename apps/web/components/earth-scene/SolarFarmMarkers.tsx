// @ts-nocheck - Three.js JSX types incompatible with React 19
'use client'

import { useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface SolarFarm {
  lat: number
  lng: number
  capacity: number
  name: string
}

const EARTH_RADIUS = 1
const MARKER_OFFSET = 0.008 // Slightly above Earth surface

// Convert lat/lng to local 3D position on sphere surface
function latLngToLocal(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

// Create a radial gradient glow texture
function createGlowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!

  // Create radial gradient - bright center fading to transparent
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255, 220, 150, 1)')     // Bright warm center
  gradient.addColorStop(0.1, 'rgba(255, 180, 80, 0.9)')  // Orange
  gradient.addColorStop(0.3, 'rgba(255, 140, 40, 0.5)')  // Darker orange
  gradient.addColorStop(0.6, 'rgba(255, 100, 20, 0.2)')  // Fading
  gradient.addColorStop(1, 'rgba(255, 60, 0, 0)')        // Fully transparent

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

// Normalize capacity to point size
function capacityToSize(capacity: number, maxCapacity: number): number {
  const normalized = Math.sqrt(capacity / maxCapacity)
  return 0.015 + normalized * 0.035 // Range: 0.015 to 0.05
}

export function SolarFarmMarkers() {
  const [farms, setFarms] = useState<SolarFarm[]>([])

  // Load solar farm data
  useEffect(() => {
    fetch('/data/solar-farms.json')
      .then(res => res.json())
      .then((data: SolarFarm[]) => setFarms(data))
      .catch(err => console.error('Failed to load solar farms:', err))
  }, [])

  // Create glow texture
  const glowTexture = useMemo(() => createGlowTexture(), [])

  // Calculate max capacity for normalization
  const maxCapacity = useMemo(() => {
    return farms.reduce((max, f) => Math.max(max, f.capacity), 1)
  }, [farms])

  // Create buffer geometry with positions and sizes
  const { positions, sizes } = useMemo(() => {
    if (farms.length === 0) return { positions: new Float32Array(0), sizes: new Float32Array(0) }

    const positions = new Float32Array(farms.length * 3)
    const sizes = new Float32Array(farms.length)

    farms.forEach((farm, i) => {
      const pos = latLngToLocal(farm.lat, farm.lng, EARTH_RADIUS + MARKER_OFFSET)
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = pos.z
      sizes[i] = capacityToSize(farm.capacity, maxCapacity)
    })

    return { positions, sizes }
  }, [farms, maxCapacity])

  // Material with glow texture
  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      map: glowTexture,
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: false,
    })
  }, [glowTexture])

  // Animate size pulsing
  useFrame((state) => {
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.15
    material.size = 0.03 * pulse
  })

  if (farms.length === 0) return null

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={farms.length}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  )
}
