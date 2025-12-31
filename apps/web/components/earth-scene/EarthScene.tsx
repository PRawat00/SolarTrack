// @ts-nocheck - Three.js JSX types incompatible with React 19
'use client'

import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Preload } from '@react-three/drei'

import { Earth, EarthFallback } from './Earth'
import { Sun } from './Sun'
import { StarField } from './StarField'
import { CameraController } from './CameraController'
import { SpeedControls } from './SpeedControls'
import { LocationInstruction } from './LocationInstruction'
import { AttributionPanel } from './AttributionPanel'
import { LocationModal } from './LocationModal'
import { LoadingScreen } from './LoadingScreen'
import { FadeOverlay } from './FadeOverlay'
import { useEarthSceneStore } from '@/lib/stores/earth-scene-store'

// WebGL fallback component for browsers without support
function WebGLFallback() {
  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">
        Solar<span className="text-orange-500">Track</span>
      </h1>
      <p className="text-white/60 text-center mb-8 max-w-md">
        Your browser does not support WebGL, which is required for the 3D experience.
        Please use a modern browser or continue to the app.
      </p>
      <div className="flex gap-4">
        <a
          href="/login"
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
        >
          Sign In
        </a>
        <a
          href="/signup"
          className="px-6 py-3 border border-white/20 hover:bg-white/10 text-white rounded-lg transition-colors"
        >
          Sign Up
        </a>
      </div>
    </div>
  )
}

// Error boundary for 3D scene
function Scene3DError() {
  return (
    <div className="w-full h-screen bg-black flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">
        Solar<span className="text-orange-500">Track</span>
      </h1>
      <p className="text-white/60 text-center mb-8 max-w-md">
        Something went wrong loading the 3D scene.
        You can still access the app below.
      </p>
      <div className="flex gap-4">
        <a
          href="/login"
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
        >
          Sign In
        </a>
        <a
          href="/signup"
          className="px-6 py-3 border border-white/20 hover:bg-white/10 text-white rounded-lg transition-colors"
        >
          Sign Up
        </a>
      </div>
    </div>
  )
}

// 3D Scene content
function SceneContent({ isMobile: _isMobile }: { isMobile: boolean }) {
  return (
    <>
      <StarField />

      {/* Ambient light for base illumination */}
      <ambientLight intensity={0.08} />

      {/* Earth with textures - fallback to simple version if textures fail */}
      <Suspense fallback={<EarthFallback />}>
        <Earth />
      </Suspense>

      {/* Orbiting Sun */}
      <Sun />

      {/* Camera controls and zoom animation */}
      <CameraController />

      {/* Post-processing effects disabled for now to prevent flickering */}

      <Preload all />
    </>
  )
}

export function EarthScene() {
  const [hasWebGL, setHasWebGL] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { reset } = useEarthSceneStore()

  // Check WebGL support and detect mobile
  useEffect(() => {
    // Reset store on mount
    reset()

    // Check WebGL
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      setHasWebGL(!!gl)
    } catch {
      setHasWebGL(false)
    }

    // Detect mobile
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 ||
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      )
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [reset])

  // WebGL not supported
  if (!hasWebGL) {
    return <WebGLFallback />
  }

  // Error state
  if (hasError) {
    return <Scene3DError />
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Loading screen */}
      <LoadingScreen />

      {/* 3D Canvas */}
      <Canvas
        camera={{
          position: [0, 1, 4],
          fov: 45,
          near: 0.1,
          far: 200,
        }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{
          antialias: !isMobile,
          alpha: false,
          powerPreference: isMobile ? 'low-power' : 'high-performance',
        }}
      >
        <color attach="background" args={['#000000']} />
        <Suspense fallback={null}>
          <SceneContent isMobile={isMobile} />
        </Suspense>
      </Canvas>

      {/* UI Overlays */}
      <SpeedControls />
      <LocationInstruction />
      <AttributionPanel />
      <LocationModal />
      <FadeOverlay />
    </div>
  )
}
