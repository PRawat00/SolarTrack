// @ts-nocheck - Three.js JSX types incompatible with React 19
'use client'

import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { useEarthSceneStore } from '@/lib/stores/earth-scene-store'

const SUN_DISTANCE = 80
const SUN_RADIUS = 5

// Vertex shader for sun surface
const sunVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment shader with fBm noise for animated sun surface
const sunFragmentShader = `
  uniform float u_time;
  uniform vec3 u_color1;  // Bright center/spots
  uniform vec3 u_color2;  // Mid orange
  uniform vec3 u_color3;  // Dark regions

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Random function
  float random(vec3 st) {
    return fract(sin(dot(st, vec3(12.9898, 78.233, 23.112))) * 43758.5453);
  }

  // 3D Perlin-like noise
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = random(i);
    float n100 = random(i + vec3(1.0, 0.0, 0.0));
    float n010 = random(i + vec3(0.0, 1.0, 0.0));
    float n110 = random(i + vec3(1.0, 1.0, 0.0));
    float n001 = random(i + vec3(0.0, 0.0, 1.0));
    float n101 = random(i + vec3(1.0, 0.0, 1.0));
    float n011 = random(i + vec3(0.0, 1.0, 1.0));
    float n111 = random(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);

    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);

    return mix(nxy0, nxy1, f.z);
  }

  // Fractal Brownian Motion - 6 octaves
  float fBm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 6; i++) {
      value += amplitude * noise(p * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    // Animate noise by rotating position over time
    float t = u_time * 0.05;
    vec3 pos = vPosition * 2.0;

    // Rotate position for animation
    float c = cos(t);
    float s = sin(t);
    pos = vec3(
      pos.x * c - pos.z * s,
      pos.y,
      pos.x * s + pos.z * c
    );

    // Get noise value
    float n = fBm(pos);

    // Add second layer of slower, larger noise
    float n2 = fBm(pos * 0.5 + vec3(0.0, t * 0.3, 0.0));
    n = n * 0.7 + n2 * 0.3;

    // Mix colors based on noise
    vec3 color = mix(u_color1, u_color2, smoothstep(0.3, 0.5, n));
    color = mix(color, u_color3, smoothstep(0.5, 0.7, n));

    // Add bright spots (inverse of dark regions)
    float spots = 1.0 - smoothstep(0.2, 0.35, n);
    color = mix(color, u_color1, spots * 0.5);

    // Fresnel effect for edge glow (use world position)
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = 1.0 - max(dot(normalize(vNormal), viewDir), 0.0);
    fresnel = pow(fresnel, 2.0);
    color += vec3(1.0, 0.6, 0.2) * fresnel * 0.4;

    gl_FragColor = vec4(color, 1.0);
  }
`

// Corona with animated rays shader
const coronaVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const coronaFragmentShader = `
  uniform float u_time;
  uniform vec3 glowColor;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  // Simple noise for rays
  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), f);
  }

  // Fractal noise for ray variation
  float fbm(float x) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(x);
      x *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Get angle around the sphere for ray pattern
    float angle = atan(vPosition.y, vPosition.x);
    float angle2 = atan(vPosition.z, length(vPosition.xy));

    // Create ray pattern using noise
    float rayCount = 40.0;
    float rayNoise = fbm(angle * rayCount + u_time * 0.5);
    float rayNoise2 = fbm(angle2 * rayCount * 0.7 - u_time * 0.3);

    // Combine ray patterns
    float rays = rayNoise * 0.6 + rayNoise2 * 0.4;
    rays = pow(rays, 1.5);

    // Fresnel for edge intensity
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = 1.0 - abs(dot(normalize(vNormal), viewDir));
    fresnel = pow(fresnel, 2.0);

    // Combine fresnel with rays
    float intensity = fresnel * (0.5 + rays * 1.5);

    // Color gradient from yellow to orange-red
    vec3 color = mix(vec3(1.0, 0.9, 0.5), glowColor, rays);

    gl_FragColor = vec4(color, intensity * 0.8);
  }
`

// Outer rays shader for extended flares
const raysVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldNormal;

  void main() {
    vNormal = normal;
    vPosition = position;
    vWorldNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const raysFragmentShader = `
  uniform float u_time;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldNormal;

  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), f);
  }

  float fbm(float x) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(x);
      x *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Spherical coordinates for ray direction
    float angle = atan(vPosition.y, vPosition.x);
    float angle2 = atan(vPosition.z, length(vPosition.xy));

    // Animated ray pattern - more spiky
    float t = u_time * 0.2;
    float rays = fbm(angle * 30.0 + t) * fbm(angle * 15.0 - t * 0.7);
    float rays2 = fbm(angle2 * 25.0 + t * 0.5) * fbm(angle2 * 12.0 - t * 0.3);

    // Combine and sharpen
    float ray = max(rays, rays2);
    ray = pow(ray, 2.0) * 3.0;

    // Fresnel falloff
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = 1.0 - abs(dot(vWorldNormal, viewDir));
    fresnel = pow(fresnel, 1.5);

    // Final intensity
    float intensity = fresnel * ray;

    // Hot color
    vec3 color = mix(vec3(1.0, 0.6, 0.1), vec3(1.0, 0.3, 0.0), ray);

    gl_FragColor = vec4(color, intensity * 0.6);
  }
`

// Create glow sprite texture
function createGlowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  // Soft radial gradient for glow
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255, 240, 200, 0.8)')
  gradient.addColorStop(0.2, 'rgba(255, 200, 100, 0.5)')
  gradient.addColorStop(0.4, 'rgba(255, 150, 50, 0.3)')
  gradient.addColorStop(0.7, 'rgba(255, 100, 20, 0.1)')
  gradient.addColorStop(1, 'rgba(255, 50, 0, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

export function Sun() {
  const groupRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Sprite>(null)
  const angleRef = useRef(0)
  const isAnimatingToTargetRef = useRef(false)

  const { sunOrbitSpeed, isZooming, targetSunPosition } = useEarthSceneStore()

  // Create textures and materials
  const glowTexture = useMemo(() => createGlowTexture(), [])

  // Sun surface shader material with fBm noise
  const sunMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0 },
      u_color1: { value: new THREE.Color('#fff8e0') },  // Bright white-yellow
      u_color2: { value: new THREE.Color('#ffaa33') },  // Mid orange
      u_color3: { value: new THREE.Color('#cc4400') },  // Dark red-orange spots
    },
    vertexShader: sunVertexShader,
    fragmentShader: sunFragmentShader,
  }), [])

  // Corona shader material with animated rays
  const coronaMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0 },
      glowColor: { value: new THREE.Color(0xff6622) },
    },
    vertexShader: coronaVertexShader,
    fragmentShader: coronaFragmentShader,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  // Outer rays material for extended flares
  const raysMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0 },
    },
    vertexShader: raysVertexShader,
    fragmentShader: raysFragmentShader,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  // Sprite material for outer glow
  const glowMaterial = useMemo(() => new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [glowTexture])

  // Animate Sun to target position when zooming
  useEffect(() => {
    if (isZooming && targetSunPosition && groupRef.current && !isAnimatingToTargetRef.current) {
      isAnimatingToTargetRef.current = true

      gsap.to(groupRef.current.position, {
        x: targetSunPosition.x,
        y: targetSunPosition.y,
        z: targetSunPosition.z,
        duration: 2,
        ease: 'power2.inOut',
      })
    }
  }, [isZooming, targetSunPosition])

  useFrame((state, delta) => {
    // Update time uniforms for animated shaders
    const time = state.clock.elapsedTime
    sunMaterial.uniforms.u_time.value = time
    coronaMaterial.uniforms.u_time.value = time
    raysMaterial.uniforms.u_time.value = time

    if (groupRef.current && !isZooming) {
      // Update orbit angle
      angleRef.current += sunOrbitSpeed * delta

      // Calculate position on orbit
      const x = Math.cos(angleRef.current) * SUN_DISTANCE
      const z = Math.sin(angleRef.current) * SUN_DISTANCE

      groupRef.current.position.set(x, 0, z)
    }

    // Subtle pulse animation for glow
    if (glowRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1
      const scale = SUN_RADIUS * 4 * pulse
      glowRef.current.scale.set(scale, scale, 1)
    }
  })

  return (
    <group ref={groupRef} position={[SUN_DISTANCE, 0, 0]}>
      {/* Sun core with animated fBm noise shader */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
        <primitive object={sunMaterial} attach="material" />
      </mesh>

      {/* Corona glow with animated rays */}
      <mesh scale={[1.2, 1.2, 1.2]}>
        <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
        <primitive object={coronaMaterial} attach="material" />
      </mesh>

      {/* Outer rays layer for extended flares */}
      <mesh scale={[1.5, 1.5, 1.5]}>
        <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
        <primitive object={raysMaterial} attach="material" />
      </mesh>

      {/* Even larger outer glow */}
      <mesh scale={[1.8, 1.8, 1.8]}>
        <sphereGeometry args={[SUN_RADIUS, 32, 32]} />
        <primitive object={raysMaterial} attach="material" />
      </mesh>

      {/* Outer glow sprite (always faces camera) */}
      <sprite ref={glowRef} scale={[SUN_RADIUS * 4, SUN_RADIUS * 4, 1]}>
        <primitive object={glowMaterial} attach="material" />
      </sprite>

      {/* Point light for illumination */}
      <pointLight
        color="#fffaf0"
        intensity={3}
        distance={200}
        decay={1}
      />

      {/* Directional light for sharper shadows */}
      <directionalLight
        color="#fffaf0"
        intensity={2}
      />
    </group>
  )
}
