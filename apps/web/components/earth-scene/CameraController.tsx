'use client'

import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { useEarthSceneStore } from '@/lib/stores/earth-scene-store'

const EARTH_RADIUS = 1

// Convert lat/lng to local 3D position on sphere surface (before Earth rotation)
function latLngToLocal(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180) // polar angle from north pole
  const theta = (lng + 180) * (Math.PI / 180) // azimuthal angle

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

// Convert local position to world position given Earth's Y rotation
function localToWorld(local: THREE.Vector3, earthRotationY: number): THREE.Vector3 {
  const cosR = Math.cos(earthRotationY)
  const sinR = Math.sin(earthRotationY)

  return new THREE.Vector3(
    local.x * cosR + local.z * sinR,
    local.y,
    -local.x * sinR + local.z * cosR
  )
}

// Normalize angle to [-PI, PI]
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI
  while (angle < -Math.PI) angle += 2 * Math.PI
  return angle
}

export function CameraController() {
  const { camera } = useThree()
  const isAnimatingRef = useRef(false)

  const { isZooming, selectedLocation, startFadeOut, earthGroupRef } = useEarthSceneStore()

  // Set initial camera position
  useEffect(() => {
    camera.position.set(0, 1, 4)
    camera.lookAt(0, 0, 0)
  }, [camera])

  // Handle zoom animation when location is selected
  useEffect(() => {
    if (isZooming && selectedLocation && !isAnimatingRef.current) {
      isAnimatingRef.current = true

      // Get current Earth rotation from store
      const { currentEarthRotation, setTargetSunPosition, setCurrentEarthRotation } = useEarthSceneStore.getState()

      // Calculate location in local Earth coordinates (without rotation)
      const localPos = latLngToLocal(selectedLocation.lat, selectedLocation.lng, EARTH_RADIUS)

      // Calculate current world position
      const worldPos = localToWorld(localPos, currentEarthRotation)

      // Check if location is on the back side of Earth (Z < threshold means facing away from camera)
      const isOnBackSide = worldPos.z < 0.1

      // Calculate target Earth rotation to bring location to front (facing +Z)
      // We want the location to end up at positive Z
      const targetRotation = -Math.atan2(localPos.x, localPos.z)

      // Calculate shortest rotation path
      let deltaRotation = normalizeAngle(targetRotation - currentEarthRotation)

      // Function to perform the camera zoom animation
      const performCameraZoom = (finalEarthRotation: number) => {
        // Calculate final world position after Earth rotation
        const finalWorldPos = localToWorld(localPos, finalEarthRotation)

        // Calculate camera target position
        const cameraDistance = 1.5
        const cameraTarget = finalWorldPos.clone().normalize().multiplyScalar(cameraDistance)

        // Position Sun behind camera to illuminate the location
        const sunPos = cameraTarget.clone().normalize().multiplyScalar(80)
        setTargetSunPosition({ x: sunPos.x, y: sunPos.y, z: sunPos.z })

        // Start lookAt from current position (Earth center) to avoid jump
        const lookAtTarget = { x: 0, y: 0, z: 0 }

        const cameraTl = gsap.timeline({
          onUpdate: () => {
            camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z)
          },
          onComplete: () => {
            setTimeout(() => {
              startFadeOut()
            }, 500)
          },
        })

        // Zoom camera towards the location
        cameraTl.to(camera.position, {
          x: cameraTarget.x,
          y: cameraTarget.y,
          z: cameraTarget.z,
          duration: 2,
          ease: 'power2.inOut',
        })

        // Animate the lookAt point from center towards the location
        cameraTl.to(
          lookAtTarget,
          {
            x: finalWorldPos.x * 0.8,
            y: finalWorldPos.y * 0.8,
            z: finalWorldPos.z * 0.8,
            duration: 2,
            ease: 'power2.inOut',
          },
          '<'
        )
      }

      if (isOnBackSide && earthGroupRef) {
        // Location is on back side - rotate Earth first, then zoom camera
        const finalRotation = currentEarthRotation + deltaRotation

        gsap.to(earthGroupRef.rotation, {
          y: finalRotation,
          duration: 1.2,
          ease: 'power2.inOut',
          onUpdate: () => {
            // Keep store in sync during animation
            setCurrentEarthRotation(earthGroupRef.rotation.y)
          },
          onComplete: () => {
            setCurrentEarthRotation(finalRotation)
            performCameraZoom(finalRotation)
          },
        })
      } else {
        // Location is on front side - just zoom camera directly
        performCameraZoom(currentEarthRotation)
      }
    }
  }, [isZooming, selectedLocation, camera, startFadeOut, earthGroupRef])

  // Subtle idle animation when not zooming
  useFrame((state) => {
    if (!isZooming && !isAnimatingRef.current) {
      // Gentle camera sway for ambient motion
      const time = state.clock.getElapsedTime()
      camera.position.x = Math.sin(time * 0.1) * 0.1
      camera.position.y = 1 + Math.sin(time * 0.15) * 0.05
      camera.lookAt(0, 0, 0)
    }
  })

  return null
}
