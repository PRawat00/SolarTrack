import { create } from 'zustand'
import * as THREE from 'three'

export type SpeedPreset = 'realistic' | 'cinematic' | 'fast'

export interface SelectedLocation {
  lat: number
  lng: number
  name: string
}

interface EarthSceneState {
  // Rotation speeds (radians per second)
  earthRotationSpeed: number
  sunOrbitSpeed: number

  // Active presets (separate for earth and sun)
  earthPreset: SpeedPreset
  sunPreset: SpeedPreset

  // Earth rotation tracking for zoom animation
  currentEarthRotation: number
  targetEarthRotation: number | null
  targetEarthXRotation: number | null

  // Sun position tracking for zoom animation
  targetSunPosition: { x: number; y: number; z: number } | null

  // Interaction state
  isModalOpen: boolean
  selectedLocation: SelectedLocation | null

  // Animation state
  isZooming: boolean
  isFadingOut: boolean

  // Loading state
  texturesLoaded: boolean

  // Earth group ref for cross-component animation
  earthGroupRef: THREE.Group | null

  // Actions
  setEarthPreset: (preset: SpeedPreset) => void
  setSunPreset: (preset: SpeedPreset) => void
  setCurrentEarthRotation: (rotation: number) => void
  setTargetEarthRotation: (rotation: number | null) => void
  setTargetEarthXRotation: (rotation: number | null) => void
  setTargetSunPosition: (position: { x: number; y: number; z: number } | null) => void
  openModal: () => void
  closeModal: () => void
  setLocation: (location: SelectedLocation) => void
  startZoomAnimation: () => void
  startFadeOut: () => void
  setTexturesLoaded: (loaded: boolean) => void
  setEarthGroupRef: (group: THREE.Group | null) => void
  reset: () => void
}

// Speed presets (radians per second)
export const EARTH_SPEEDS: Record<SpeedPreset, { speed: number; label: string }> = {
  realistic: {
    // Earth: 1 rotation per 2 minutes (sped up for visibility but still slow)
    speed: (2 * Math.PI) / 120,
    label: 'Realistic',
  },
  cinematic: {
    // Earth: 1 rotation per 30 seconds
    speed: (2 * Math.PI) / 30,
    label: 'Cinematic',
  },
  fast: {
    // Earth: 1 rotation per 5 seconds
    speed: (2 * Math.PI) / 5,
    label: 'Fast',
  },
}

export const SUN_SPEEDS: Record<SpeedPreset, { speed: number; label: string }> = {
  realistic: {
    // Sun: 1 orbit per 5 minutes
    speed: (2 * Math.PI) / 300,
    label: 'Realistic',
  },
  cinematic: {
    // Sun: 1 orbit per 2 minutes
    speed: (2 * Math.PI) / 120,
    label: 'Cinematic',
  },
  fast: {
    // Sun: 1 orbit per 20 seconds
    speed: (2 * Math.PI) / 20,
    label: 'Fast',
  },
}

const initialState = {
  earthRotationSpeed: EARTH_SPEEDS.cinematic.speed,
  sunOrbitSpeed: SUN_SPEEDS.cinematic.speed,
  earthPreset: 'cinematic' as SpeedPreset,
  sunPreset: 'cinematic' as SpeedPreset,
  currentEarthRotation: 0,
  targetEarthRotation: null as number | null,
  targetEarthXRotation: null as number | null,
  targetSunPosition: null as { x: number; y: number; z: number } | null,
  isModalOpen: false,
  selectedLocation: null as SelectedLocation | null,
  isZooming: false,
  isFadingOut: false,
  texturesLoaded: false,
  earthGroupRef: null as THREE.Group | null,
}

export const useEarthSceneStore = create<EarthSceneState>((set) => ({
  ...initialState,

  setEarthPreset: (preset: SpeedPreset) =>
    set({
      earthPreset: preset,
      earthRotationSpeed: EARTH_SPEEDS[preset].speed,
    }),

  setSunPreset: (preset: SpeedPreset) =>
    set({
      sunPreset: preset,
      sunOrbitSpeed: SUN_SPEEDS[preset].speed,
    }),

  setCurrentEarthRotation: (rotation: number) =>
    set({ currentEarthRotation: rotation }),

  setTargetEarthRotation: (rotation: number | null) =>
    set({ targetEarthRotation: rotation }),

  setTargetEarthXRotation: (rotation: number | null) =>
    set({ targetEarthXRotation: rotation }),

  setTargetSunPosition: (position: { x: number; y: number; z: number } | null) =>
    set({ targetSunPosition: position }),

  openModal: () => set({ isModalOpen: true }),

  closeModal: () => set({ isModalOpen: false }),

  setLocation: (location: SelectedLocation) =>
    set({ selectedLocation: location }),

  startZoomAnimation: () => set({ isZooming: true }),

  startFadeOut: () => set({ isFadingOut: true }),

  setTexturesLoaded: (loaded: boolean) => set({ texturesLoaded: loaded }),

  setEarthGroupRef: (group: THREE.Group | null) => set({ earthGroupRef: group }),

  reset: () => set(initialState),
}))
