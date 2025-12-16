// @ts-nocheck - Three.js JSX types incompatible with React 19
'use client'

import { Stars } from '@react-three/drei'

export function StarField() {
  return (
    <Stars
      radius={50}
      depth={50}
      count={3000}
      factor={6}
      saturation={0}
      fade
      speed={0.3}
    />
  )
}
