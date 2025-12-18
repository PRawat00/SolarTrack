'use client'

import { ChristmasLights } from './christmas-lights'
import { Snowfall } from './snowfall'

export function ChristmasTheme() {
  return (
    <>
      <ChristmasLights />
      <Snowfall />
    </>
  )
}

export { ChristmasLights } from './christmas-lights'
export { Snowfall } from './snowfall'
