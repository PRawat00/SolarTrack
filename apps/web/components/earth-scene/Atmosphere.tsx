// @ts-nocheck - Three.js JSX types incompatible with React 19
'use client'

import { useRef, useMemo } from 'react'
import * as THREE from 'three'

const ATMOSPHERE_RADIUS = 1.15

// Custom atmosphere shader material
function createAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x4da6ff) },
      coefficient: { value: 0.8 },
      power: { value: 6.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPositionNormal;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float coefficient;
      uniform float power;

      varying vec3 vNormal;
      varying vec3 vPositionNormal;

      void main() {
        float intensity = pow(coefficient - dot(vNormal, vPositionNormal), power);
        gl_FragColor = vec4(glowColor, intensity * 0.8);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

export function Atmosphere() {
  const meshRef = useRef<THREE.Mesh>(null)

  const material = useMemo(() => createAtmosphereMaterial(), [])

  return (
    <mesh ref={meshRef} scale={[ATMOSPHERE_RADIUS, ATMOSPHERE_RADIUS, ATMOSPHERE_RADIUS]}>
      <sphereGeometry args={[1, 64, 64]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

// Alternative simpler atmosphere using built-in materials
export function AtmosphereSimple() {
  return (
    <mesh scale={[1.1, 1.1, 1.1]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color="#4da6ff"
        transparent
        opacity={0.15}
        side={THREE.BackSide}
      />
    </mesh>
  )
}
