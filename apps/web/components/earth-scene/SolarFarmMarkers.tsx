// @ts-nocheck - Three.js JSX types incompatible with React 19
'use client'

import { useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEarthSceneStore } from '@/lib/stores/earth-scene-store'

interface PowerPlant {
  lat: number
  lng: number
  capacity: number
  name: string
  type: 'solar' | 'wind' | 'nuclear'
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

// Create a radial gradient glow texture with custom color
function createGlowTexture(color: { r: number; g: number; b: number }): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  // Create radial gradient - bright center fading to transparent (preserve full color)
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  gradient.addColorStop(0, `rgba(255, 255, 255, 1)`)           // White hot center
  gradient.addColorStop(0.1, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`)
  gradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`)
  gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`)
  gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 256)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

// Color definitions
const SOLAR_COLOR = { r: 255, g: 160, b: 50 }    // Orange
const WIND_COLOR = { r: 50, g: 255, b: 100 }     // Bright green
const NUCLEAR_COLOR = { r: 255, g: 50, b: 255 }  // Magenta/purple

export function SolarFarmMarkers() {
  const [plants, setPlants] = useState<PowerPlant[]>([])
  const { showSolar, showWind, showNuclear } = useEarthSceneStore()

  // Load power plant data
  useEffect(() => {
    fetch('/data/power-plants.json')
      .then(res => res.json())
      .then((data: PowerPlant[]) => setPlants(data))
      .catch(err => console.error('Failed to load power plants:', err))
  }, [])

  // Create glow textures
  const solarTexture = useMemo(() => createGlowTexture(SOLAR_COLOR), [])
  const windTexture = useMemo(() => createGlowTexture(WIND_COLOR), [])
  const nuclearTexture = useMemo(() => createGlowTexture(NUCLEAR_COLOR), [])

  // Separate plants by type
  const { solarPlants, windPlants, nuclearPlants } = useMemo(() => {
    return {
      solarPlants: plants.filter(p => p.type === 'solar'),
      windPlants: plants.filter(p => p.type === 'wind'),
      nuclearPlants: plants.filter(p => p.type === 'nuclear'),
    }
  }, [plants])

  // Create buffer geometry for solar plants
  const solarPositions = useMemo(() => {
    if (solarPlants.length === 0) return new Float32Array(0)

    const positions = new Float32Array(solarPlants.length * 3)
    solarPlants.forEach((plant, i) => {
      const pos = latLngToLocal(plant.lat, plant.lng, EARTH_RADIUS + MARKER_OFFSET)
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = pos.z
    })
    return positions
  }, [solarPlants])

  // Create buffer geometry for wind plants
  const windPositions = useMemo(() => {
    if (windPlants.length === 0) return new Float32Array(0)

    const positions = new Float32Array(windPlants.length * 3)
    windPlants.forEach((plant, i) => {
      const pos = latLngToLocal(plant.lat, plant.lng, EARTH_RADIUS + MARKER_OFFSET)
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = pos.z
    })
    return positions
  }, [windPlants])

  // Create buffer geometry for nuclear plants
  const nuclearPositions = useMemo(() => {
    if (nuclearPlants.length === 0) return new Float32Array(0)

    const positions = new Float32Array(nuclearPlants.length * 3)
    nuclearPlants.forEach((plant, i) => {
      const pos = latLngToLocal(plant.lat, plant.lng, EARTH_RADIUS + MARKER_OFFSET)
      positions[i * 3] = pos.x
      positions[i * 3 + 1] = pos.y
      positions[i * 3 + 2] = pos.z
    })
    return positions
  }, [nuclearPlants])

  // Materials
  const solarMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      map: solarTexture,
      size: 0.03,  // Solar is prominent
      sizeAttenuation: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: false,
    })
  }, [solarTexture])

  const windMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      map: windTexture,
      size: 0.02,  // Wind is smaller
      sizeAttenuation: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: false,
    })
  }, [windTexture])

  const nuclearMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      map: nuclearTexture,
      size: 0.04,  // Largest - nuclear plants are significant
      sizeAttenuation: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: false,
    })
  }, [nuclearTexture])

  // Animate size pulsing - different frequencies for each type
  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Solar: slow dramatic pulse (prominent)
    const solarPulse = 1 + Math.sin(t * 1.0) * 0.4
    // Wind: fast subtle flicker
    const windPulse = 1 + Math.sin(t * 3.5) * 0.25
    // Nuclear: very slow, dramatic
    const nuclearPulse = 1 + Math.sin(t * 0.6) * 0.5

    solarMaterial.size = 0.03 * solarPulse
    windMaterial.size = 0.02 * windPulse
    nuclearMaterial.size = 0.05 * nuclearPulse
  })

  if (plants.length === 0) return null

  return (
    <group>
      {/* Solar farms - orange */}
      {showSolar && solarPlants.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={solarPlants.length}
              array={solarPositions}
              itemSize={3}
            />
          </bufferGeometry>
          <primitive object={solarMaterial} attach="material" />
        </points>
      )}

      {/* Wind farms - green */}
      {showWind && windPlants.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={windPlants.length}
              array={windPositions}
              itemSize={3}
            />
          </bufferGeometry>
          <primitive object={windMaterial} attach="material" />
        </points>
      )}

      {/* Nuclear plants - magenta */}
      {showNuclear && nuclearPlants.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={nuclearPlants.length}
              array={nuclearPositions}
              itemSize={3}
            />
          </bufferGeometry>
          <primitive object={nuclearMaterial} attach="material" />
        </points>
      )}
    </group>
  )
}
