"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { FINISHES, type BodyStyle, type CarConfig, type RimStyle } from "./types"
import { drive } from "./drive-store"

// ---------------------------------------------------------------------------
// Body style definitions (side profiles in the z/y plane, extruded across x)
// ---------------------------------------------------------------------------

type StyleDef = {
  front: number
  rear: number
  track: number
  wheelR: number
  archR: number
  bottomY: number
  width: number
  bevelT: number
  bevelS: number
  bevelSeg: number
  frontX: number
  rearX: number
  body: (s: THREE.Shape) => void
  band: (s: THREE.Shape) => void
  cabin?: (s: THREE.Shape) => void
  cabinWidth?: number
  deck: [number, number]
  head: [number, number, number] // z, y, width
  tail: [number, number, number]
  plate: [number, number]
  sideLineY: number
}

const STYLES: Record<BodyStyle, StyleDef> = {
  aero: {
    front: 1.42,
    rear: -1.38,
    track: 0.86,
    wheelR: 0.36,
    archR: 0.5,
    bottomY: 0.27,
    width: 1.66,
    bevelT: 0.12,
    bevelS: 0.07,
    bevelSeg: 5,
    frontX: 2.12,
    rearX: -2.12,
    body: (s) => {
      s.lineTo(-2.22, 0.42)
      s.quadraticCurveTo(-2.3, 0.74, -2.08, 0.82)
      s.lineTo(-1.3, 0.86)
      s.lineTo(0.95, 0.84)
      s.quadraticCurveTo(1.75, 0.78, 2.18, 0.58)
      s.quadraticCurveTo(2.34, 0.48, 2.28, 0.36)
      s.quadraticCurveTo(2.24, 0.28, 2.12, 0.27)
    },
    band: (s) => {
      s.lineTo(-2.22, 0.42)
      s.lineTo(-2.23, 0.5)
      s.lineTo(2.25, 0.5)
      s.lineTo(2.28, 0.36)
      s.quadraticCurveTo(2.24, 0.28, 2.12, 0.27)
    },
    cabin: (c) => {
      c.moveTo(1.05, 0.84)
      c.quadraticCurveTo(0.45, 1.2, -0.15, 1.22)
      c.quadraticCurveTo(-0.95, 1.2, -1.55, 0.86)
      c.lineTo(1.05, 0.84)
    },
    cabinWidth: 1.18,
    deck: [-1.95, 0.9],
    head: [2.33, 0.5, 1.45],
    tail: [-2.31, 0.66, 1.6],
    plate: [-2.31, 0.44],
    sideLineY: 0.46,
  },
  hyper: {
    front: 1.5,
    rear: -1.42,
    track: 0.9,
    wheelR: 0.37,
    archR: 0.5,
    bottomY: 0.24,
    width: 1.78,
    bevelT: 0.12,
    bevelS: 0.07,
    bevelSeg: 5,
    frontX: 2.3,
    rearX: -2.2,
    body: (s) => {
      s.lineTo(-2.36, 0.3)
      s.lineTo(-2.42, 0.66)
      s.lineTo(-2.25, 0.8)
      s.lineTo(-0.9, 0.84)
      s.lineTo(0.55, 0.78)
      s.quadraticCurveTo(1.7, 0.62, 2.48, 0.34)
      s.lineTo(2.44, 0.26)
      s.lineTo(2.3, 0.24)
    },
    band: (s) => {
      s.lineTo(-2.36, 0.3)
      s.lineTo(-2.39, 0.48)
      s.lineTo(2.03, 0.48)
      s.lineTo(2.48, 0.34)
      s.lineTo(2.44, 0.26)
      s.lineTo(2.3, 0.24)
    },
    cabin: (c) => {
      c.moveTo(1.2, 0.76)
      c.quadraticCurveTo(0.55, 1.12, -0.15, 1.13)
      c.quadraticCurveTo(-0.95, 1.12, -1.75, 0.8)
      c.lineTo(1.2, 0.76)
    },
    cabinWidth: 1.1,
    deck: [-2.1, 0.87],
    head: [2.38, 0.42, 1.6],
    tail: [-2.5, 0.66, 1.75],
    plate: [-2.49, 0.45],
    sideLineY: 0.44,
  },
  roadster: {
    front: 1.38,
    rear: -1.35,
    track: 0.88,
    wheelR: 0.36,
    archR: 0.5,
    bottomY: 0.25,
    width: 1.74,
    bevelT: 0.14,
    bevelS: 0.08,
    bevelSeg: 6,
    frontX: 2.12,
    rearX: -2.12,
    body: (s) => {
      s.lineTo(-2.2, 0.34)
      s.quadraticCurveTo(-2.34, 0.62, -2.18, 0.8)
      s.lineTo(-1.45, 0.86)
      s.lineTo(0.7, 0.8)
      s.quadraticCurveTo(1.8, 0.72, 2.25, 0.48)
      s.quadraticCurveTo(2.36, 0.36, 2.22, 0.27)
      s.lineTo(2.12, 0.25)
    },
    band: (s) => {
      s.lineTo(-2.2, 0.34)
      s.lineTo(-2.25, 0.5)
      s.lineTo(2.2, 0.5)
      s.lineTo(2.28, 0.38)
      s.quadraticCurveTo(2.24, 0.27, 2.12, 0.25)
    },
    cabin: (c) => {
      c.moveTo(1.0, 0.8)
      c.quadraticCurveTo(0.3, 1.18, -0.3, 1.18)
      c.quadraticCurveTo(-1.0, 1.16, -1.6, 0.86)
      c.lineTo(1.0, 0.8)
    },
    cabinWidth: 1.2,
    deck: [-1.95, 0.92],
    head: [2.27, 0.52, 1.25],
    tail: [-2.33, 0.68, 1.72],
    plate: [-2.31, 0.45],
    sideLineY: 0.48,
  },
  titan: {
    front: 1.52,
    rear: -1.52,
    track: 0.92,
    wheelR: 0.42,
    archR: 0.58,
    bottomY: 0.36,
    width: 1.8,
    bevelT: 0.06,
    bevelS: 0.03,
    bevelSeg: 1,
    frontX: 2.3,
    rearX: -2.3,
    body: (s) => {
      s.lineTo(-2.36, 0.4)
      s.lineTo(-2.4, 1.0)
      s.lineTo(-0.05, 1.5)
      s.lineTo(2.4, 0.98)
      s.lineTo(2.42, 0.62)
      s.lineTo(2.3, 0.36)
    },
    band: (s) => {
      s.lineTo(-2.36, 0.4)
      s.lineTo(-2.38, 0.66)
      s.lineTo(2.41, 0.66)
      s.lineTo(2.42, 0.62)
      s.lineTo(2.3, 0.36)
    },
    deck: [-2.2, 1.06],
    head: [2.44, 0.95, 1.85],
    tail: [-2.44, 0.95, 1.85],
    plate: [-2.43, 0.58],
    sideLineY: 0.56,
  },
}

function bottomWithArches(s: THREE.Shape, d: StyleDef) {
  const R = d.archR
  const r = d.wheelR
  const b = d.bottomY
  const a0 = Math.asin((b - r) / R)
  const off = Math.cos(a0) * R
  s.moveTo(d.frontX, b)
  s.lineTo(d.front + off, b)
  s.absarc(d.front, r, R, a0, Math.PI - a0, false)
  s.lineTo(d.rear + off, b)
  s.absarc(d.rear, r, R, a0, Math.PI - a0, false)
  s.lineTo(d.rearX, b)
}

/** Physical dimensions used by the vehicle controller (flips, jets). */
export function getBodyDims(style: BodyStyle) {
  const d = STYLES[style]
  const roof = { aero: 1.29, hyper: 1.2, roadster: 1.26, titan: 1.53 }[style]
  return { roof, halfWidth: d.width / 2 + d.bevelT, front: d.front, rear: d.rear, track: d.track, wheelR: d.wheelR }
}

/** SVG silhouette of a body style, for UI previews. */
export function getProfileSvg(style: BodyStyle) {
  const d = STYLES[style]
  const toPath = (s: THREE.Shape) =>
    s
      .getPoints(10)
      .map((p, i) => `${i ? "L" : "M"}${((p.x + 2.6) * 20).toFixed(1)} ${((1.65 - p.y) * 20).toFixed(1)}`)
      .join(" ") + " Z"
  const body = new THREE.Shape()
  bottomWithArches(body, d)
  d.body(body)
  let cabin = ""
  if (d.cabin) {
    const c = new THREE.Shape()
    d.cabin(c)
    cabin = toPath(c)
  }
  const wheels = [d.front, d.rear].map((z) => ({ cx: (z + 2.6) * 20, cy: (1.65 - d.wheelR) * 20, r: d.wheelR * 20 }))
  return { body: toPath(body), cabin, wheels }
}

function extrudeSide(shape: THREE.Shape, depth: number, bevelT: number, bevelS: number, seg: number) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelT > 0,
    bevelThickness: bevelT,
    bevelSize: bevelS,
    bevelSegments: seg,
    curveSegments: 28,
    steps: 1,
  })
  g.translate(0, 0, -depth / 2)
  g.rotateY(-Math.PI / 2)
  g.computeVertexNormals()
  return g
}

function useBodyGeometries(style: BodyStyle) {
  return useMemo(() => {
    const d = STYLES[style]
    const bodyShape = new THREE.Shape()
    bottomWithArches(bodyShape, d)
    d.body(bodyShape)
    const body = extrudeSide(bodyShape, d.width, d.bevelT, d.bevelS, d.bevelSeg)

    const bandShape = new THREE.Shape()
    bottomWithArches(bandShape, d)
    d.band(bandShape)
    const band = extrudeSide(bandShape, d.width, d.bevelT + 0.006, d.bevelS + 0.006, d.bevelSeg)

    const stripe = extrudeSide(bodyShape, 0.16, 0.02, d.bevelS + 0.006, 1)

    let cabin: THREE.BufferGeometry | null = null
    if (d.cabin) {
      const c = new THREE.Shape()
      d.cabin(c)
      cabin = extrudeSide(c, d.cabinWidth!, 0.14, 0.05, 6)
    }
    let windows: THREE.BufferGeometry | null = null
    if (style === "titan") {
      const w = new THREE.Shape()
      w.moveTo(-1.6, 1.0)
      w.lineTo(-0.1, 1.38)
      w.lineTo(1.4, 1.12)
      w.lineTo(1.4, 1.0)
      w.lineTo(-1.6, 1.0)
      windows = extrudeSide(w, d.width + d.bevelT * 2 + 0.012, 0, 0, 1)
    }
    return { d, body, band, stripe, cabin, windows }
  }, [style])
}

// ---------------------------------------------------------------------------
// Shared textures
// ---------------------------------------------------------------------------

let glowTexture: THREE.Texture | null = null
export function getGlowTexture() {
  if (glowTexture) return glowTexture
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const ctx = c.getContext("2d")!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, "rgba(255,255,255,1)")
  g.addColorStop(0.35, "rgba(255,255,255,0.55)")
  g.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  glowTexture = new THREE.CanvasTexture(c)
  glowTexture.colorSpace = THREE.SRGBColorSpace
  return glowTexture
}

function makePlateTexture(text: string, color: string) {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 64
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#05070c"
  ctx.fillRect(0, 0, 256, 64)
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  ctx.strokeRect(4, 4, 248, 56)
  ctx.font = "bold 38px monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 10
  ctx.fillText(text.toUpperCase().slice(0, 9), 128, 34)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

function useCarMaterials(config: CarConfig) {
  const mats = useMemo(
    () => ({
      paint: new THREE.MeshPhysicalMaterial({ clearcoatRoughness: 0.04, envMapIntensity: 1.3 }),
      accent: new THREE.MeshPhysicalMaterial({ clearcoatRoughness: 0.05, envMapIntensity: 1.2 }),
      glass: new THREE.MeshPhysicalMaterial({ metalness: 0.3, roughness: 0.04, clearcoat: 1, envMapIntensity: 2 }),
      trim: new THREE.MeshStandardMaterial({ color: "#0b0c10", metalness: 0.4, roughness: 0.45 }),
      tire: new THREE.MeshStandardMaterial({ color: "#0f0f11", metalness: 0.05, roughness: 0.9 }),
      rim: new THREE.MeshStandardMaterial({ metalness: 0.92, roughness: 0.22 }),
      caliper: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 }),
      disc: new THREE.MeshStandardMaterial({ color: "#3a3d44", metalness: 0.9, roughness: 0.35 }),
      head: new THREE.MeshBasicMaterial({ toneMapped: false }),
      tail: new THREE.MeshBasicMaterial({ toneMapped: false }),
      neon: new THREE.MeshBasicMaterial({ toneMapped: false }),
      rimNeon: new THREE.MeshBasicMaterial({ toneMapped: false }),
      glow: new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        map: getGlowTexture(),
      }),
      plate: new THREE.MeshBasicMaterial({ toneMapped: false }),
    }),
    [],
  )

  useEffect(() => {
    const f = FINISHES[config.finish]
    for (const [m, color] of [
      [mats.paint, config.bodyColor],
      [mats.accent, config.accentColor],
    ] as const) {
      m.color.set(color)
      m.metalness = f.metalness
      m.roughness = f.roughness
      m.clearcoat = f.clearcoat
      m.iridescence = f.iridescence
      m.iridescenceIOR = 1.6
      m.iridescenceThicknessRange = [200, 800]
      m.needsUpdate = true
    }
    mats.glass.color.set("#5b7d93").lerp(new THREE.Color("#020305"), config.windowTint)
    mats.rim.color.set(config.wheelColor)
    mats.caliper.color.set(config.caliperColor)
    mats.caliper.emissive.set(config.caliperColor).multiplyScalar(0.15)
    mats.head.color.set(config.headlightColor).multiplyScalar(5)
    mats.neon.color.set(config.neonColor).multiplyScalar(3.2)
    mats.rimNeon.color.set(config.neonColor).multiplyScalar(4)
    mats.glow.color.set(config.underglowColor)
  }, [mats, config])

  useEffect(() => {
    const tex = makePlateTexture(config.plate || " ", config.neonColor)
    mats.plate.map = tex
    mats.plate.color.setScalar(1.6)
    mats.plate.needsUpdate = true
    return () => tex.dispose()
  }, [mats, config.plate, config.neonColor])

  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])

  return mats
}

type Mats = ReturnType<typeof useCarMaterials>

// ---------------------------------------------------------------------------
// Wheels
// ---------------------------------------------------------------------------

function Rim({ style, r, side, mats }: { style: RimStyle; r: number; side: number; mats: Mats }) {
  const face = side * 0.13
  const rr = r * 0.7
  const spoke = (count: number, thick: number, width: number, len = rr * 2, offset = 0) =>
    Array.from({ length: count }).map((_, k) => (
      <mesh key={k} rotation={[(k * Math.PI * 2) / count + offset, 0, 0]} position={[face, 0, 0]} material={mats.rim}>
        <boxGeometry args={[thick, len, width]} />
      </mesh>
    ))

  return (
    <group>
      {/* barrel / lip ring */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[face * 0.95, 0, 0]} material={mats.rim}>
        <torusGeometry args={[rr, r * 0.05, 8, 40]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[side * 0.02, 0, 0]} material={mats.trim}>
        <cylinderGeometry args={[rr, rr, 0.2, 32, 1, true]} />
      </mesh>
      {style === "turbine" && (
        <>
          {Array.from({ length: 10 }).map((_, k) => (
            <group key={k} rotation={[(k * Math.PI * 2) / 10, 0, 0]} position={[face, 0, 0]}>
              <mesh position={[0, rr * 0.55, 0]} rotation={[0, 0.6 * side, 0]} material={mats.rim}>
                <boxGeometry args={[0.03, rr * 0.85, 0.11]} />
              </mesh>
            </group>
          ))}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[face + side * 0.01, 0, 0]} material={mats.neon}>
            <cylinderGeometry args={[r * 0.14, r * 0.14, 0.04, 20]} />
          </mesh>
        </>
      )}
      {style === "spoke" && (
        <>
          {spoke(5, 0.05, 0.12)}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[face, 0, 0]} material={mats.rim}>
            <cylinderGeometry args={[r * 0.18, r * 0.18, 0.08, 20]} />
          </mesh>
        </>
      )}
      {style === "mesh" && (
        <>
          {spoke(10, 0.03, 0.04, rr * 2, 0)}
          {spoke(10, 0.03, 0.04, rr * 1.6, Math.PI / 10)}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[face, 0, 0]} material={mats.rim}>
            <cylinderGeometry args={[r * 0.15, r * 0.15, 0.07, 20]} />
          </mesh>
        </>
      )}
      {style === "aero" && (
        <>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[face, 0, 0]} material={mats.rim}>
            <cylinderGeometry args={[rr, rr * 0.92, 0.04, 40]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[face + side * 0.022, 0, 0]} material={mats.accent}>
            <torusGeometry args={[rr * 0.62, 0.02, 6, 40]} />
          </mesh>
          {spoke(3, 0.02, 0.05, rr * 1.2)}
        </>
      )}
      {style === "neon" && (
        <>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[face + side * 0.01, 0, 0]} material={mats.rimNeon}>
            <torusGeometry args={[rr * 0.9, 0.022, 8, 48]} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[face + side * 0.01, 0, 0]} material={mats.rimNeon}>
            <torusGeometry args={[rr * 0.35, 0.018, 8, 32]} />
          </mesh>
          {spoke(3, 0.04, 0.07)}
        </>
      )}
    </group>
  )
}

function Wheel({
  position,
  r,
  style,
  mats,
  isFront,
  steerRef,
  spinRef,
}: {
  position: [number, number, number]
  r: number
  style: RimStyle
  mats: Mats
  isFront: boolean
  steerRef: (g: THREE.Group | null) => void
  spinRef: (g: THREE.Group | null) => void
}) {
  const side = Math.sign(position[0])
  return (
    <group position={position} ref={isFront ? steerRef : undefined}>
      {/* brake disc + caliper (do not spin) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[side * 0.02, 0, 0]} material={mats.disc}>
        <cylinderGeometry args={[r * 0.6, r * 0.6, 0.03, 28]} />
      </mesh>
      <mesh position={[side * 0.07, r * 0.32, -r * 0.3]} rotation={[0.8, 0, 0]} material={mats.caliper}>
        <boxGeometry args={[0.08, r * 0.42, 0.14]} />
      </mesh>
      <group ref={spinRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow material={mats.tire}>
          <cylinderGeometry args={[r, r, 0.3, 36]} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[side * 0.15, 0, 0]} material={mats.tire}>
          <torusGeometry args={[r * 0.86, r * 0.14, 10, 36]} />
        </mesh>
        <Rim style={style} r={r} side={side} mats={mats} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Car
// ---------------------------------------------------------------------------

export function CarModel({ config, live = false }: { config: CarConfig; live?: boolean }) {
  const { d, body, band, stripe, cabin, windows } = useBodyGeometries(config.bodyStyle)
  const mats = useCarMaterials(config)
  const bodyRef = useRef<THREE.Group>(null)
  const steerRefs = useRef<(THREE.Group | null)[]>([])
  const spinRefs = useRef<(THREE.Group | null)[]>([])
  const glowRef = useRef<THREE.Mesh>(null)
  const glowLightRef = useRef<THREE.PointLight>(null)
  const spotRef = useRef<THREE.SpotLight>(null)
  const spotTarget = useMemo(() => new THREE.Object3D(), [])
  const spin = useRef(0)

  const r = d.wheelR * config.wheelSize
  const lift = r - d.wheelR + (config.rideHeight - 0.5) * 0.16
  const hw = d.width / 2 + d.bevelT // half width of body side surface
  const len = d.frontX - d.rearX

  const wheels: { pos: [number, number, number]; front: boolean }[] = [
    { pos: [d.track, r, d.front], front: true },
    { pos: [-d.track, r, d.front], front: true },
    { pos: [d.track, r, d.rear], front: false },
    { pos: [-d.track, r, d.rear], front: false },
  ]

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    if (live) {
      spin.current += (drive.speed * dt) / r
      for (const g of spinRefs.current) if (g) g.rotation.x = spin.current
      for (const g of steerRefs.current) if (g) g.rotation.y = drive.steerVisual
      mats.tail.color.set("#ff1030").multiplyScalar(drive.braking ? 6 : 2)
      if (bodyRef.current) {
        bodyRef.current.rotation.z += (drive.bodyRoll - bodyRef.current.rotation.z) * Math.min(1, dt * 8)
        bodyRef.current.rotation.x += (drive.bodyPitch - bodyRef.current.rotation.x) * Math.min(1, dt * 6)
      }
    } else {
      mats.tail.color.set("#ff1030").multiplyScalar(2)
      for (const g of steerRefs.current) if (g) g.rotation.y *= 0.9
      if (bodyRef.current) {
        bodyRef.current.rotation.z *= 0.9
        bodyRef.current.rotation.x *= 0.9
      }
    }

    if (config.underglow && glowRef.current) {
      const base = new THREE.Color(config.underglowColor)
      let k = 1
      if (config.underglowMode === "pulse") k = 0.55 + 0.45 * Math.sin(t * 3)
      if (config.underglowMode === "rainbow") base.setHSL((t * 0.15) % 1, 1, 0.55)
      mats.glow.color.copy(base).multiplyScalar(1.4 * k)
      if (glowLightRef.current) {
        glowLightRef.current.color.copy(base)
        glowLightRef.current.intensity = 6 * k
      }
    }
    if (spotRef.current) spotRef.current.target = spotTarget
  })

  const sideLineLen = d.front - d.rear - d.archR * 2 - 0.1
  const sideLineZ = (d.front + d.rear) / 2

  return (
    <group>
      {/* everything that rolls / pitches on the suspension */}
      <group ref={bodyRef} position={[0, lift, 0]}>
        <mesh geometry={body} material={mats.paint} castShadow receiveShadow />
        {config.livery === "twotone" && <mesh geometry={band} material={mats.accent} />}
        {config.livery === "stripes" && (
          <>
            <mesh geometry={stripe} material={mats.accent} position={[0.26, 0, 0]} />
            <mesh geometry={stripe} material={mats.accent} position={[-0.26, 0, 0]} />
          </>
        )}
        {config.livery === "circuit" &&
          [1, -1].map((s) => (
            <group key={s} position={[s * (hw + 0.004), 0, 0]}>
              <mesh position={[0, d.sideLineY, sideLineZ]} material={mats.neon}>
                <boxGeometry args={[0.01, 0.025, sideLineLen]} />
              </mesh>
              <mesh position={[0, d.sideLineY + 0.16, d.front - d.archR - 0.25]} rotation={[0.9, 0, 0]} material={mats.neon}>
                <boxGeometry args={[0.01, 0.025, 0.42]} />
              </mesh>
              <mesh position={[0, d.sideLineY + 0.06, d.rear + d.archR + 0.25]} rotation={[-0.5, 0, 0]} material={mats.accent}>
                <boxGeometry args={[0.012, 0.09, 0.5]} />
              </mesh>
            </group>
          ))}

        {cabin && <mesh geometry={cabin} material={mats.glass} castShadow />}
        {windows && <mesh geometry={windows} material={mats.glass} />}
        {config.bodyStyle === "titan" && (
          <>
            <mesh position={[0, 1.37, 0.72]} rotation={[0.208, 0, 0]} material={mats.glass}>
              <boxGeometry args={[1.62, 0.012, 1.25]} />
            </mesh>
            <mesh position={[0, 1.36, -0.85]} rotation={[-0.209, 0, 0]} material={mats.glass}>
              <boxGeometry args={[1.5, 0.012, 1.0]} />
            </mesh>
          </>
        )}

        {/* lights */}
        <mesh position={[0, d.head[1], d.head[0]]} material={mats.head}>
          <boxGeometry args={[d.head[2], 0.035, 0.06]} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[s * d.head[2] * 0.42, d.head[1] - 0.06, d.head[0] - 0.02]} material={mats.head}>
            <boxGeometry args={[0.22, 0.05, 0.05]} />
          </mesh>
        ))}
        <mesh position={[0, d.tail[1], d.tail[0]]} material={mats.tail}>
          <boxGeometry args={[d.tail[2], 0.045, 0.05]} />
        </mesh>
        {[1, -1].map((s) => (
          <mesh key={s} position={[s * d.tail[2] * 0.46, d.tail[1] - 0.07, d.tail[0]]} material={mats.tail}>
            <boxGeometry args={[0.1, 0.12, 0.05]} />
          </mesh>
        ))}
        <mesh position={[0, d.plate[1], d.plate[0] - 0.015]} rotation={[0, Math.PI, 0]} material={mats.plate}>
          <planeGeometry args={[0.52, 0.13]} />
        </mesh>

        {/* rear diffuser */}
        {[-0.5, -0.25, 0, 0.25, 0.5].map((x) => (
          <mesh key={x} position={[x, d.bottomY + 0.02, d.rearX - 0.05]} material={mats.trim}>
            <boxGeometry args={[0.03, 0.14, 0.4]} />
          </mesh>
        ))}

        {/* aero parts */}
        {config.splitter && (
          <group position={[0, d.bottomY - 0.06, d.frontX + 0.14]}>
            <mesh material={mats.trim}>
              <boxGeometry args={[hw * 2 - 0.05, 0.035, 0.42]} />
            </mesh>
            <mesh position={[0, 0, 0.21]} material={mats.neon}>
              <boxGeometry args={[hw * 2 - 0.1, 0.012, 0.012]} />
            </mesh>
          </group>
        )}
        {config.sideSkirts &&
          [1, -1].map((s) => (
            <group key={s} position={[s * (hw + 0.02), d.bottomY - 0.02, sideLineZ]}>
              <mesh material={mats.trim}>
                <boxGeometry args={[0.07, 0.1, sideLineLen + 0.05]} />
              </mesh>
              <mesh position={[s * 0.035, -0.04, 0]} material={mats.neon}>
                <boxGeometry args={[0.01, 0.012, sideLineLen]} />
              </mesh>
            </group>
          ))}
        <Spoiler type={config.spoilerType} deck={d.deck} width={hw * 2} mats={mats} />

        {/* side mirrors */}
        {d.cabin &&
          [1, -1].map((s) => (
            <mesh key={s} position={[s * (hw + 0.08), 0.92, 0.85]} material={mats.paint}>
              <boxGeometry args={[0.16, 0.06, 0.12]} />
            </mesh>
          ))}

        {live && (
          <>
            <spotLight
              ref={spotRef}
              position={[0, d.head[1] + 0.2, d.head[0]]}
              color={config.headlightColor}
              intensity={18}
              distance={60}
              angle={0.55}
              penumbra={0.8}
              decay={1.5}
            />
            <primitive object={spotTarget} position={[0, 0, d.head[0] + 12]} />
          </>
        )}
      </group>

      {wheels.map((w, i) => (
        <Wheel
          key={i}
          position={w.pos}
          r={r}
          style={config.rimStyle}
          mats={mats}
          isFront={w.front}
          steerRef={(g) => (steerRefs.current[i] = g)}
          spinRef={(g) => (spinRefs.current[i] = g)}
        />
      ))}

      {config.underglow && (
        <>
          <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} material={mats.glow}>
            <planeGeometry args={[hw * 2 + 2.2, len + 2.4]} />
          </mesh>
          <pointLight ref={glowLightRef} position={[0, 0.25, 0]} distance={7} decay={2} intensity={6} />
        </>
      )}
    </group>
  )
}

function Spoiler({
  type,
  deck,
  width,
  mats,
}: {
  type: CarConfig["spoilerType"]
  deck: [number, number]
  width: number
  mats: Mats
}) {
  const [z, y] = deck
  if (type === "none") return null
  if (type === "lip")
    return (
      <mesh position={[0, y + 0.03, z - 0.12]} rotation={[0.35, 0, 0]} material={mats.accent}>
        <boxGeometry args={[width * 0.9, 0.04, 0.3]} />
      </mesh>
    )
  const big = type === "gt"
  const h = big ? 0.42 : 0.24
  const w = big ? width * 1.02 : width * 0.85
  return (
    <group position={[0, y, z - (big ? 0.15 : 0.05)]}>
      <mesh position={[0, h, 0]} rotation={[big ? -0.12 : -0.06, 0, 0]} material={mats.accent} castShadow>
        <boxGeometry args={[w, 0.045, big ? 0.48 : 0.34]} />
      </mesh>
      <mesh position={[0, h + 0.03, -0.2]} material={mats.neon}>
        <boxGeometry args={[w * 0.96, 0.012, 0.012]} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * w * 0.32, h / 2, big ? 0.05 : 0]} rotation={[big ? 0.25 : 0, 0, 0]} material={mats.trim}>
          <boxGeometry args={[0.04, h, 0.12]} />
        </mesh>
      ))}
      {big &&
        [1, -1].map((s) => (
          <mesh key={s} position={[s * (w / 2 + 0.01), h, 0]} material={mats.paint}>
            <boxGeometry args={[0.025, 0.22, 0.56]} />
          </mesh>
        ))}
    </group>
  )
}
