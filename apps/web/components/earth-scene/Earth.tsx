// @ts-nocheck - Three.js JSX types incompatible with React 19
'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useEarthSceneStore } from '@/lib/stores/earth-scene-store'
import { SolarFarmMarkers } from './SolarFarmMarkers'

const EARTH_RADIUS = 1
const CLOUD_RADIUS = 1.01

// Texture URLs - using 8k NASA Blue Marble textures from Solar System Scope
// (CC BY 4.0 license - https://www.solarsystemscope.com/textures/)
const TEXTURE_URLS = {
  day: '/textures/earth/earth-day-8k.jpg',
  bump: '/textures/earth/earth-bump-4k.jpg', // Keep 4k bump (8k is normal map format)
  specular: '/textures/earth/earth-specular-8k.jpg',
  clouds: '/textures/earth/earth-clouds-8k.jpg',
}

export function Earth() {
  const groupRef = useRef<THREE.Group>(null)
  const cloudsRef = useRef<THREE.Mesh>(null)
  const { gl } = useThree()

  const {
    earthRotationSpeed,
    openModal,
    isZooming,
    setCurrentEarthRotation,
    setEarthGroupRef,
  } = useEarthSceneStore()

  // Store group ref for cross-component animation (CameraController needs it)
  useEffect(() => {
    if (groupRef.current) {
      setEarthGroupRef(groupRef.current)
    }
    return () => setEarthGroupRef(null)
  }, [setEarthGroupRef])

  // Load textures
  const [dayTexture, bumpTexture, specularTexture, cloudsTexture] = useTexture([
    TEXTURE_URLS.day,
    TEXTURE_URLS.bump,
    TEXTURE_URLS.specular,
    TEXTURE_URLS.clouds,
  ])

  // Configure textures with filtering for sharp close-up viewing
  useMemo(() => {
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy()
    const textures = [dayTexture, bumpTexture, specularTexture, cloudsTexture]

    textures.forEach(texture => {
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.anisotropy = maxAnisotropy
      texture.generateMipmaps = true
      texture.needsUpdate = true
    })

    // Color space for visible textures
    dayTexture.colorSpace = THREE.SRGBColorSpace
    cloudsTexture.colorSpace = THREE.SRGBColorSpace
  }, [gl, dayTexture, bumpTexture, specularTexture, cloudsTexture])

  // Animate rotation and track current rotation (Earth freezes during zoom)
  useFrame((_, delta) => {
    if (groupRef.current && !isZooming) {
      groupRef.current.rotation.y += earthRotationSpeed * delta
      // Update store with current rotation
      setCurrentEarthRotation(groupRef.current.rotation.y)
    }
    if (cloudsRef.current && !isZooming) {
      // Clouds rotate slightly faster (relative to Earth) for visual effect
      cloudsRef.current.rotation.y += earthRotationSpeed * delta * 0.1
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!isZooming) {
      openModal()
    }
  }

  return (
    <group ref={groupRef}>
      {/* Main Earth sphere */}
      <mesh onClick={handleClick}>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshPhongMaterial
          map={dayTexture}
          bumpMap={bumpTexture}
          bumpScale={0.05}
          specularMap={specularTexture}
          specular={new THREE.Color(0x333333)}
          shininess={15}
        />
      </mesh>

      {/* Cloud layer */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[CLOUD_RADIUS, 128, 128]} />
        <meshPhongMaterial
          map={cloudsTexture}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>

      {/* Solar farm location markers */}
      <SolarFarmMarkers />
    </group>
  )
}

// Fallback Earth with simple color (for when textures fail to load)
export function EarthFallback() {
  const earthRef = useRef<THREE.Mesh>(null)
  const { earthRotationSpeed, openModal, isZooming } = useEarthSceneStore()

  useFrame((_, delta) => {
    if (earthRef.current && !isZooming) {
      earthRef.current.rotation.y += earthRotationSpeed * delta
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!isZooming) {
      openModal()
    }
  }

  return (
    <mesh ref={earthRef} onClick={handleClick}>
      <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
      <meshStandardMaterial
        color="#1a4d7c"
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  )
}
