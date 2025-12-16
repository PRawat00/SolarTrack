'use client'

import dynamic from 'next/dynamic'
import { LoadingScreenSimple } from '@/components/earth-scene'

// Dynamic import to avoid SSR issues with Three.js
const EarthScene = dynamic(
  () => import('@/components/earth-scene/EarthScene').then((mod) => mod.EarthScene),
  {
    ssr: false,
    loading: () => <LoadingScreenSimple />,
  }
)

export default function Home() {
  return <EarthScene />
}
