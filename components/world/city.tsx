"use client"

import { useLayoutEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Stars } from "@react-three/drei"
import * as THREE from "three"
import {
  BLOCK,
  CITY,
  GRID,
  HALF,
  NEON_COLORS,
  ROAD,
  ROAD_LINES,
  WORLD_LIMIT,
  LOOPS,
  TRACK_AREA,
  TRACK_START,
  inTrackArea,
  loopPoint,
  surfaceHeightLocal,
  type Billboard,
  type Loop,
  type Surface,
  type SurfaceType,
} from "./city-layout"
import { SPAWN, drive } from "../drive-store"
import { getGlowTexture } from "../car-model"

const tmp = new THREE.Object3D()
const tmpColor = new THREE.Color()
const timeUniform = { value: 0 }

const PLAZA = BLOCK + (BLOCK - ROAD) / 2 // 88

// ---------------------------------------------------------------------------
// Building material: procedural lit windows from world position
// ---------------------------------------------------------------------------

function makeBuildingMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4, metalness: 0.6, envMapIntensity: 0.5 })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBW;\nvarying vec3 vBN;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 bw = vec4(transformed, 1.0);
        vec3 bn = objectNormal;
        #ifdef USE_INSTANCING
          bw = instanceMatrix * bw;
          bn = mat3(instanceMatrix) * bn;
        #endif
        bw = modelMatrix * bw;
        vBW = bw.xyz;
        vBN = normalize(mat3(modelMatrix) * bn);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vBW;
        varying vec3 vBN;
        uniform float uTime;
        float bhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        if (abs(vBN.y) < 0.5) {
          float hc = abs(vBN.x) > 0.5 ? vBW.z : vBW.x;
          vec2 cell = vec2(hc / 1.8, vBW.y / 3.2);
          vec2 id = floor(cell);
          vec2 f = fract(cell);
          float win = step(0.12, f.x) * step(f.x, 0.88) * step(0.28, f.y) * step(f.y, 0.8);
          float side = abs(vBN.x) > 0.5 ? sign(vBN.x) * 3.0 + floor(vBW.x) : sign(vBN.z) * 7.0 + floor(vBW.z);
          float h = bhash(id + vec2(side * 1.37, side * 0.71));
          // whole floors tend to be lit together, like real offices
          float floorBias = bhash(vec2(id.y * 0.37, side));
          float lit = step(0.8 - floorBias * 0.3, h);
          vec3 wc = h > 0.97 ? vec3(1.0, 0.2, 0.85) : (h > 0.9 ? vec3(0.2, 0.85, 1.0) : vec3(1.0, 0.7, 0.4));
          float bright = 0.5 + bhash(id * 1.7 + 3.1) * 1.3;
          float flicker = 0.85 + 0.15 * sin(uTime * 1.7 + h * 60.0);
          float above = step(4.6, vBW.y);
          float glass = win * above;
          totalEmissiveRadiance += wc * glass * lit * bright * flicker;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.008, 0.012, 0.025), glass);
          roughnessFactor = mix(roughnessFactor, 0.06, glass);
          metalnessFactor = mix(metalnessFactor, 0.95, glass);
          // storefront neon band at street level
          float band = step(3.7, vBW.y) * step(vBW.y, 4.0);
          float bh = bhash(vec2(floor(hc / 30.0), side));
          vec3 bc = bh > 0.66 ? vec3(1.0, 0.15, 0.8) : (bh > 0.33 ? vec3(0.0, 0.9, 1.0) : vec3(1.0, 0.6, 0.0));
          totalEmissiveRadiance += bc * band * 2.4;
          // shop windows
          float shop = step(0.5, vBW.y) * step(vBW.y, 3.3) * step(0.15, fract(hc / 7.0)) * step(fract(hc / 7.0), 0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.01, 0.02, 0.03), shop);
          totalEmissiveRadiance += mix(vec3(0.05, 0.2, 0.3), vec3(0.35, 0.08, 0.25), bh) * shop * 0.6;
        }`,
      )
  }
  return mat
}

// ---------------------------------------------------------------------------
// Static helpers
// ---------------------------------------------------------------------------

function useInstances(
  ref: React.RefObject<THREE.InstancedMesh | null>,
  count: number,
  fill: (i: number, o: THREE.Object3D, c: THREE.Color) => boolean | void,
) {
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    let hasColor = false
    for (let i = 0; i < count; i++) {
      tmp.position.set(0, 0, 0)
      tmp.rotation.set(0, 0, 0)
      tmp.scale.set(1, 1, 1)
      tmpColor.setRGB(1, 1, 1)
      if (fill(i, tmp, tmpColor)) hasColor = true
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
      if (hasColor) mesh.setColorAt(i, tmpColor)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  draw(c.getContext("2d")!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// ---------------------------------------------------------------------------
// Ground, roads, plaza
// ---------------------------------------------------------------------------

function Ground() {
  const roadsRef = useRef<THREE.InstancedMesh>(null)
  const dashRef = useRef<THREE.InstancedMesh>(null)
  const edgeRef = useRef<THREE.InstancedMesh>(null)
  const blockRef = useRef<THREE.InstancedMesh>(null)
  const roadLen = HALF * 2 + ROAD
  const segLen = BLOCK - ROAD

  const segments = useMemo(() => {
    const segs: { x: number; z: number; alongX: boolean }[] = []
    for (const line of ROAD_LINES) {
      for (let k = 0; k < ROAD_LINES.length - 1; k++) {
        const mid = (ROAD_LINES[k] + ROAD_LINES[k + 1]) / 2
        segs.push({ x: line, z: mid, alongX: false })
        segs.push({ x: mid, z: line, alongX: true })
      }
    }
    return segs
  }, [])

  const blocks = CITY.blocks.filter((b) => b.kind !== "plaza" && b.kind !== "track")

  useInstances(roadsRef, ROAD_LINES.length * 2, (i, o) => {
    const line = ROAD_LINES[i % ROAD_LINES.length]
    o.rotation.x = -Math.PI / 2
    if (i < ROAD_LINES.length) {
      o.position.set(line, 0, 0)
      o.scale.set(ROAD, roadLen, 1)
    } else {
      o.position.set(0, 0.001, line)
      o.rotation.z = Math.PI / 2
      o.scale.set(ROAD, roadLen, 1)
    }
  })

  const DASHES = 5
  useInstances(dashRef, segments.length * DASHES, (i, o) => {
    const s = segments[Math.floor(i / DASHES)]
    const k = i % DASHES
    const off = -segLen / 2 + (k + 0.5) * (segLen / DASHES)
    o.rotation.x = -Math.PI / 2
    if (s.alongX) {
      o.position.set(s.x + off, 0.015, s.z)
      o.rotation.z = Math.PI / 2
    } else o.position.set(s.x, 0.015, s.z + off)
    o.scale.set(0.22, 3.2, 1)
  })

  useInstances(edgeRef, segments.length * 2, (i, o, c) => {
    const s = segments[Math.floor(i / 2)]
    const side = i % 2 === 0 ? 1 : -1
    o.rotation.x = -Math.PI / 2
    const e = ROAD / 2 - 0.6
    if (s.alongX) {
      o.position.set(s.x, 0.016, s.z + side * e)
      o.rotation.z = Math.PI / 2
    } else o.position.set(s.x + side * e, 0.016, s.z)
    o.scale.set(0.14, segLen, 1)
    c.set(i % 4 < 2 ? "#00e5ff" : "#7a5cff").multiplyScalar(1.6)
    return true
  })

  useInstances(blockRef, blocks.length, (i, o, c) => {
    const b = blocks[i]
    o.position.set(b.x, 0.025, b.z)
    o.scale.set(segLen, 0.05, segLen)
    c.set(b.kind === "park" ? "#08201c" : "#14161d")
    return true
  })

  const plazaTex = useMemo(
    () =>
      canvasTexture(1024, 1024, (ctx) => {
        ctx.fillStyle = "#07080e"
        ctx.fillRect(0, 0, 1024, 1024)
        ctx.strokeStyle = "rgba(0,229,255,0.16)"
        ctx.lineWidth = 1
        for (let i = 0; i <= 1024; i += 32) {
          ctx.beginPath()
          ctx.moveTo(i, 0)
          ctx.lineTo(i, 1024)
          ctx.moveTo(0, i)
          ctx.lineTo(1024, i)
          ctx.stroke()
        }
        ctx.lineWidth = 6
        ctx.strokeStyle = "rgba(255,43,214,0.8)"
        ctx.beginPath()
        ctx.arc(512, 512, 60, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = "rgba(0,229,255,0.7)"
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(512, 512, 300, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([24, 18])
        ctx.beginPath()
        ctx.arc(512, 512, 420, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
        // donut circle marker
        ctx.strokeStyle = "rgba(255,176,0,0.8)"
        ctx.beginPath()
        ctx.arc(512 + (40 / 176) * 1024, 512 + (-20 / 176) * 1024, (11 / 176) * 1024, 0, Math.PI * 2)
        ctx.stroke()
        ctx.font = "bold 54px monospace"
        ctx.textAlign = "center"
        ctx.fillStyle = "rgba(0,229,255,0.85)"
        ctx.fillText("NEXUS DRIFT ARENA", 512, 140)
        ctx.save()
        ctx.translate(512, 900)
        ctx.rotate(Math.PI)
        ctx.fillText("NEO KYRA", 0, 0)
        ctx.restore()
      }),
    [],
  )

  return (
    <group>
      {/* outer terrain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[5000, 5000]} />
        <meshStandardMaterial color="#05060a" roughness={0.9} metalness={0.1} />
      </mesh>
      <gridHelper args={[3000, 120, "#1b1440", "#120d2a"]} position={[0, -0.04, 0]} />

      <instancedMesh ref={roadsRef} args={[undefined, undefined, ROAD_LINES.length * 2]} receiveShadow>
        <planeGeometry />
        <meshStandardMaterial color="#0c0d12" roughness={0.42} metalness={0.35} />
      </instancedMesh>
      <instancedMesh ref={dashRef} args={[undefined, undefined, segments.length * DASHES]}>
        <planeGeometry />
        <meshBasicMaterial color="#9aa3b5" />
      </instancedMesh>
      <instancedMesh ref={edgeRef} args={[undefined, undefined, segments.length * 2]}>
        <planeGeometry />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={blockRef} args={[undefined, undefined, blocks.length]} receiveShadow>
        <boxGeometry />
        <meshStandardMaterial roughness={0.6} metalness={0.3} />
      </instancedMesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <planeGeometry args={[PLAZA * 2, PLAZA * 2]} />
        <meshStandardMaterial map={plazaTex} roughness={0.35} metalness={0.5} emissiveMap={plazaTex} emissive="#ffffff" emissiveIntensity={0.9} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Towers, skyline
// ---------------------------------------------------------------------------

const FAR_TOWERS = (() => {
  const list: { x: number; z: number; w: number; d: number; h: number }[] = []
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2
    const r = WORLD_LIMIT + 90 + rnd() * 380
    list.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, w: 16 + rnd() * 30, d: 16 + rnd() * 30, h: 90 + rnd() * rnd() * 320 })
  }
  return list
})()

function Towers() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const material = useMemo(makeBuildingMaterial, [])
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), [])
  const tiers = CITY.towers.filter((t) => t.tierH > 0)
  const total = CITY.towers.length + tiers.length + FAR_TOWERS.length

  useInstances(ref, total, (i, o, c) => {
    if (i < CITY.towers.length) {
      const t = CITY.towers[i]
      o.position.set(t.x, 0, t.z)
      o.scale.set(t.w, t.h, t.d)
      c.setRGB(...t.tint)
    } else if (i < CITY.towers.length + tiers.length) {
      const t = tiers[i - CITY.towers.length]
      o.position.set(t.x, t.h, t.z)
      o.scale.set(t.w * 0.62, t.tierH, t.d * 0.62)
      c.setRGB(t.tint[0] * 1.3, t.tint[1] * 1.3, t.tint[2] * 1.4)
    } else {
      const t = FAR_TOWERS[i - CITY.towers.length - tiers.length]
      o.position.set(t.x, 0, t.z)
      o.scale.set(t.w, t.h, t.d)
      c.setRGB(0.05, 0.05, 0.09)
    }
    return true
  })

  useFrame((state) => {
    timeUniform.value = state.clock.elapsedTime
  })

  return <instancedMesh ref={ref} args={[geometry, material, total]} castShadow receiveShadow />
}

function NeonEdges() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const neon = CITY.towers.filter((t) => t.neon >= 0)
  const count = neon.length * 8
  useInstances(ref, count, (i, o, c) => {
    const t = neon[Math.floor(i / 8)]
    const k = i % 8
    const sx = k % 2 === 0 ? 1 : -1
    const sz = k % 4 < 2 ? 1 : -1
    if (k < 4) {
      o.position.set(t.x + (sx * t.w) / 2, t.h / 2, t.z + (sz * t.d) / 2)
      o.scale.set(0.3, t.h, 0.3)
    } else {
      const alongX = k < 6
      o.position.set(
        t.x + (alongX ? 0 : (sx * t.w) / 2),
        t.h,
        t.z + (alongX ? (sz * t.d) / 2 : 0),
      )
      o.scale.set(alongX ? t.w : 0.3, 0.3, alongX ? 0.3 : t.d)
    }
    c.set(NEON_COLORS[t.neon]).multiplyScalar(2.2)
    return true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

function Antennas() {
  const poleRef = useRef<THREE.InstancedMesh>(null)
  const lightRef = useRef<THREE.InstancedMesh>(null)
  const lightMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff2040", toneMapped: false }), [])
  const crowns = CITY.towers.filter((t) => t.crown)
  const top = (t: (typeof crowns)[number]) => t.h + t.tierH
  useInstances(poleRef, crowns.length, (i, o) => {
    const t = crowns[i]
    o.position.set(t.x, top(t) + 7, t.z)
    o.scale.set(0.35, 14, 0.35)
  })
  useInstances(lightRef, crowns.length, (i, o) => {
    const t = crowns[i]
    o.position.set(t.x, top(t) + 14.5, t.z)
    o.scale.setScalar(1.1)
  })
  useFrame((state) => {
    const on = Math.sin(state.clock.elapsedTime * 3) > 0.2
    lightMat.color.set("#ff2040").multiplyScalar(on ? 5 : 0.4)
  })
  return (
    <>
      <instancedMesh ref={poleRef} args={[undefined, undefined, crowns.length]}>
        <cylinderGeometry args={[0.5, 1, 1, 6]} />
        <meshStandardMaterial color="#20222a" metalness={0.8} roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, lightMat, crowns.length]}>
        <sphereGeometry args={[0.6, 10, 10]} />
      </instancedMesh>
    </>
  )
}

const billboardTextures = new Map<string, THREE.Texture>()
function getBillboardTexture(b: Billboard) {
  const key = b.text + b.color
  let t = billboardTextures.get(key)
  if (t) return t
  t = canvasTexture(512, 230, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 512, 230)
    g.addColorStop(0, "#0a0418")
    g.addColorStop(1, "#14002a")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 230)
    ctx.strokeStyle = b.color
    ctx.lineWidth = 8
    ctx.strokeRect(10, 10, 492, 210)
    for (let y = 0; y < 230; y += 6) {
      ctx.fillStyle = "rgba(255,255,255,0.03)"
      ctx.fillRect(0, y, 512, 2)
    }
    ctx.font = `bold ${b.text.length > 8 ? 62 : 86}px monospace`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.shadowColor = b.color
    ctx.shadowBlur = 24
    ctx.fillStyle = "#ffffff"
    ctx.fillText(b.text, 256, 118)
    ctx.shadowBlur = 0
    ctx.fillStyle = b.color
    ctx.font = "bold 22px monospace"
    ctx.fillText("◆ NEO KYRA ◆ 2099 ◆", 256, 196)
  })
  billboardTextures.set(key, t)
  return t
}

function Billboards() {
  const mats = useMemo(
    () =>
      CITY.billboards.map(
        (b) => new THREE.MeshBasicMaterial({ map: getBillboardTexture(b), toneMapped: false, side: THREE.DoubleSide }),
      ),
    [],
  )
  useFrame((state) => {
    const t = state.clock.elapsedTime
    mats.forEach((m, i) => {
      const flick = Math.sin(t * 13 + i * 7) > 0.97 ? 0.4 : 1
      m.color.setScalar((1.5 + Math.sin(t * 1.5 + i) * 0.2) * flick)
    })
  })
  return (
    <group>
      {CITY.billboards.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} rotation={[0, b.rot, 0]} material={mats[i]}>
          <planeGeometry args={[b.w, b.h]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Street furniture
// ---------------------------------------------------------------------------

const LAMPS = (() => {
  // dx/dz: direction the lamp arm reaches (towards the road center)
  const list: { x: number; z: number; dx: number; dz: number }[] = []
  const off = ROAD / 2 + 1.2
  for (const line of ROAD_LINES) {
    for (let k = -GRID; k <= GRID; k++) {
      for (const d of [-14, 14]) {
        const s = k * BLOCK + d
        for (const side of [-1, 1]) {
          // road along z at x=line
          const a = { x: line + side * off, z: s, dx: -side, dz: 0 }
          // road along x at z=line
          const b = { x: s, z: line + side * off, dx: 0, dz: -side }
          for (const p of [a, b]) {
            if (Math.abs(p.x) < PLAZA && Math.abs(p.z) < PLAZA) continue
            if (inTrackArea(p.x, p.z)) continue
            list.push(p)
          }
        }
      }
    }
  }
  return list
})()

function StreetLights() {
  const poleRef = useRef<THREE.InstancedMesh>(null)
  const headRef = useRef<THREE.InstancedMesh>(null)
  useInstances(poleRef, LAMPS.length, (i, o) => {
    const l = LAMPS[i]
    o.position.set(l.x, 3.5, l.z)
    o.scale.set(0.12, 7, 0.12)
  })
  useInstances(headRef, LAMPS.length, (i, o, c) => {
    const l = LAMPS[i]
    o.position.set(l.x + l.dx * 1.4, 7, l.z + l.dz * 1.4)
    if (l.dx !== 0) o.scale.set(3, 0.12, 0.35)
    else o.scale.set(0.35, 0.12, 3)
    c.set(i % 7 === 0 ? "#ff2bd6" : "#bdf6ff").multiplyScalar(3)
    return true
  })
  return (
    <>
      <instancedMesh ref={poleRef} args={[undefined, undefined, LAMPS.length]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#2a2d36" metalness={0.8} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, LAMPS.length]}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  )
}

function Trees() {
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const crownRef = useRef<THREE.InstancedMesh>(null)
  const n = CITY.trees.length
  useInstances(trunkRef, n, (i, o) => {
    const t = CITY.trees[i]
    o.position.set(t.x, 1.5 * t.s, t.z)
    o.scale.set(0.25 * t.s, 3 * t.s, 0.25 * t.s)
  })
  useInstances(crownRef, n, (i, o, c) => {
    const t = CITY.trees[i]
    o.position.set(t.x, 4.2 * t.s, t.z)
    o.scale.setScalar(1.8 * t.s)
    o.rotation.set(t.hue * 3, t.hue * 5, 0)
    c.setHSL(0.45 + t.hue * 0.45, 1, 0.5).multiplyScalar(1.3)
    return true
  })
  return (
    <>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, n]} castShadow>
        <cylinderGeometry args={[0.6, 1, 1, 6]} />
        <meshStandardMaterial color="#1b1d24" />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, n]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial toneMapped={false} wireframe />
      </instancedMesh>
    </>
  )
}

const ARCHES = (() => {
  const list: { x: number; z: number; rot: number }[] = []
  const avenues = [ROAD_LINES[1], ROAD_LINES[ROAD_LINES.length - 2]]
  for (const line of avenues) {
    for (let k = -GRID; k <= GRID; k += 2) {
      list.push({ x: line, z: k * BLOCK, rot: 0 })
      list.push({ x: k * BLOCK, z: line, rot: Math.PI / 2 })
    }
  }
  return list.filter((a) => !inTrackArea(a.x, a.z))
})()

function HoloArches() {
  const ref = useRef<THREE.InstancedMesh>(null)
  useInstances(ref, ARCHES.length, (i, o, c) => {
    const a = ARCHES[i]
    o.position.set(a.x, 0, a.z)
    o.rotation.y = a.rot
    c.set("#00e5ff")
    return true
  })
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    for (let i = 0; i < ARCHES.length; i++) {
      tmpColor.setHSL((t * 0.05 + i * 0.07) % 1, 1, 0.55).multiplyScalar(2.4)
      mesh.setColorAt(i, tmpColor)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, ARCHES.length]}>
      <torusGeometry args={[ROAD / 2 + 1.5, 0.22, 8, 48, Math.PI]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

const FLYERS = (() => {
  let seed = 99
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: 140 }).map(() => ({
    line: ROAD_LINES[Math.floor(rnd() * ROAD_LINES.length)] + (rnd() - 0.5) * 6,
    alongX: rnd() < 0.5,
    y: 22 + rnd() * 55,
    speed: (18 + rnd() * 30) * (rnd() < 0.5 ? 1 : -1),
    phase: rnd() * HALF * 2,
    color: NEON_COLORS[Math.floor(rnd() * NEON_COLORS.length)],
  }))
})()

function FlyingTraffic() {
  const ref = useRef<THREE.InstancedMesh>(null)
  useInstances(ref, FLYERS.length, (i, o, c) => {
    c.set(FLYERS[i].color).multiplyScalar(2.5)
    return true
  })
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    const span = HALF * 2 + 300
    FLYERS.forEach((f, i) => {
      let p = (f.phase + t * f.speed) % span
      if (p < 0) p += span
      p -= span / 2
      if (f.alongX) {
        tmp.position.set(p, f.y + Math.sin(t + i) * 0.6, f.line)
        tmp.rotation.set(0, f.speed > 0 ? Math.PI / 2 : -Math.PI / 2, 0)
      } else {
        tmp.position.set(f.line, f.y + Math.sin(t + i) * 0.6, p)
        tmp.rotation.set(0, f.speed > 0 ? 0 : Math.PI, 0)
      }
      tmp.scale.set(1.3, 0.45, 3.4)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, FLYERS.length]} frustumCulled={false}>
      <capsuleGeometry args={[0.5, 1, 4, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

// ---------------------------------------------------------------------------
// Drift arena: ramps, showroom pad, cones, energy orbs
// ---------------------------------------------------------------------------

const SURFACE_COLORS: Record<SurfaceType, string> = {
  ramp: "#ffb000",
  plateau: "#ffb000",
  bank: "#7a5cff",
  kicker: "#ff2244",
}

/** Height-field mesh (top grid + side walls down to the ground) for any surface. */
function surfaceGeometry(s: Surface) {
  const nx = s.type === "bank" || s.type === "kicker" ? 10 : 1
  const nz = s.type === "bank" ? 48 : s.type === "kicker" ? 10 : 1
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const lxAt = (i: number) => -s.w / 2 + (s.w * i) / nx
  const lzAt = (j: number) => -s.len / 2 + (s.len * j) / nz
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const lx = lxAt(i)
      const lz = lzAt(j)
      pos.push(lx, surfaceHeightLocal(s, lx, lz), lz)
      uv.push(i / nx, ((lz + s.len / 2) / 8) % 1e6)
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i
      const b = a + 1
      const c = a + nx + 1
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  }
  // perimeter walls
  const ring: [number, number][] = []
  for (let i = 0; i <= nx; i++) ring.push([lxAt(i), lzAt(0)])
  for (let j = 1; j <= nz; j++) ring.push([lxAt(nx), lzAt(j)])
  for (let i = nx - 1; i >= 0; i--) ring.push([lxAt(i), lzAt(nz)])
  for (let j = nz - 1; j >= 0; j--) ring.push([lxAt(0), lzAt(j)])
  for (let k = 0; k < ring.length - 1; k++) {
    const [x0, z0] = ring[k]
    const [x1, z1] = ring[k + 1]
    const h0 = surfaceHeightLocal(s, x0, z0)
    const h1 = surfaceHeightLocal(s, x1, z1)
    if (h0 < 0.01 && h1 < 0.01) continue
    const base = pos.length / 3
    pos.push(x0, h0, z0, x1, h1, z1, x1, 0, z1, x0, 0, z0)
    uv.push(0, 0, 0, 0, 0, 0, 0, 0)
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Neon rails following both long edges of a surface. */
function edgeRail(s: Surface, side: number) {
  const steps = s.type === "bank" ? 40 : 12
  const pts: THREE.Vector3[] = []
  const lx = (side * s.w) / 2
  for (let j = 0; j <= steps; j++) {
    const lz = -s.len / 2 + (s.len * j) / steps
    pts.push(new THREE.Vector3(lx, surfaceHeightLocal(s, lx, lz) + 0.08, lz))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 2, 0.08, 5)
}

function Surfaces() {
  const tex = useMemo(() => {
    const t = canvasTexture(128, 256, (ctx) => {
      ctx.fillStyle = "#14151d"
      ctx.fillRect(0, 0, 128, 256)
      ctx.fillStyle = "rgba(255,255,255,0.75)"
      ctx.fillRect(4, 0, 5, 256)
      ctx.fillRect(119, 0, 5, 256)
      ctx.strokeStyle = "rgba(255,176,0,0.55)"
      ctx.lineWidth = 10
      for (const y of [60, 190]) {
        ctx.beginPath()
        ctx.moveTo(30, y + 30)
        ctx.lineTo(64, y)
        ctx.lineTo(98, y + 30)
        ctx.stroke()
      }
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  }, [])
  const items = useMemo(
    () =>
      CITY.surfaces.map((s) => ({
        s,
        geo: surfaceGeometry(s),
        rails: s.type === "plateau" ? [] : [edgeRail(s, 1), edgeRail(s, -1)],
        color: new THREE.Color(SURFACE_COLORS[s.type]).multiplyScalar(3),
      })),
    [],
  )
  return (
    <group>
      {items.map(({ s, geo, rails, color }, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, s.rot, 0]}>
          <mesh geometry={geo} castShadow receiveShadow>
            <meshStandardMaterial
              map={tex}
              emissiveMap={tex}
              emissive="#ffffff"
              emissiveIntensity={0.35}
              metalness={0.5}
              roughness={0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
          {rails.map((r, k) => (
            <mesh key={k} geometry={r}>
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          ))}
          {s.type === "plateau" &&
            [1, -1].map((side) => (
              <mesh key={side} position={[(side * s.w) / 2, s.h + 0.08, 0]}>
                <boxGeometry args={[0.16, 0.16, s.len]} />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
            ))}
          {s.type === "kicker" && (
            <mesh position={[s.w / 2 - 0.4, s.h + 0.6, s.len / 2]}>
              <boxGeometry args={[0.12, 1.2, 0.12]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

/** Ribbon road (top, underside and side walls) following a loop's helix. */
function loopGeometry(l: Loop) {
  const N = 180
  const T = 0.35 // track thickness
  const pos: number[] = []
  const idx: number[] = []
  // 4 vertices per ring: top-left, top-right, bottom-right, bottom-left
  for (let k = 0; k <= N; k++) {
    const th = (k / N) * l.arc
    const p = loopPoint(l, th)
    // inward normal points to the circle center
    const ny = Math.cos(th)
    const nz = -Math.sin(th)
    const half = l.w / 2
    pos.push(p.lx - half, p.y, p.lz, p.lx + half, p.y, p.lz)
    pos.push(p.lx + half, p.y - ny * T, p.lz - nz * T, p.lx - half, p.y - ny * T, p.lz - nz * T)
  }
  for (let k = 0; k < N; k++) {
    const a = k * 4
    const b = a + 4
    for (let e = 0; e < 4; e++) {
      const e2 = (e + 1) % 4
      idx.push(a + e, b + e, a + e2, a + e2, b + e, b + e2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function loopRail(l: Loop, side: number) {
  const pts: THREE.Vector3[] = []
  for (let k = 0; k <= 120; k++) {
    const th = (k / 120) * l.arc
    const p = loopPoint(l, th)
    pts.push(new THREE.Vector3(p.lx + (side * l.w) / 2, p.y + Math.cos(th) * 0.25, p.lz - Math.sin(th) * 0.25))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.12, 6)
}

function LoopTracks() {
  const items = useMemo(
    () =>
      LOOPS.map((l) => ({
        l,
        geo: loopGeometry(l),
        rails: [loopRail(l, 1), loopRail(l, -1)],
        sign: canvasTexture(512, 128, (ctx) => {
          ctx.fillStyle = "#120800"
          ctx.fillRect(0, 0, 512, 128)
          ctx.strokeStyle = "#ff7a00"
          ctx.lineWidth = 8
          ctx.strokeRect(6, 6, 500, 116)
          ctx.font = "bold 52px monospace"
          ctx.textAlign = "center"
          ctx.fillStyle = "#ffffff"
          ctx.shadowColor = "#ff7a00"
          ctx.shadowBlur = 18
          ctx.font = `bold ${l.label.length > 20 ? 38 : 52}px monospace`
          ctx.fillText(l.label, 256, 80)
        }),
      })),
    [],
  )
  const railColor = useMemo(() => new THREE.Color("#ff7a00").multiplyScalar(3), [])
  return (
    <group>
      {items.map(({ l, geo, rails, sign }, i) => (
        <group key={i} position={[l.x, 0, l.z]} rotation={[0, l.rot, 0]}>
          <mesh geometry={geo} castShadow receiveShadow>
            <meshStandardMaterial color="#ff6a00" emissive="#ff4a00" emissiveIntensity={0.35} metalness={0.3} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>
          {rails.map((r, k) => (
            <mesh key={k} geometry={r}>
              <meshBasicMaterial color={railColor} toneMapped={false} />
            </mesh>
          ))}
          {/* pylons + gantry with the speed sign */}
          {[-l.w / 2 - 1.2, l.shift + l.w / 2 + 1.2].map((x) => (
            <mesh key={x} position={[x, l.R + 1, 0]}>
              <boxGeometry args={[0.6, l.R * 2 + 2, 0.6]} />
              <meshStandardMaterial color="#1b1c24" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[l.shift / 2, l.R * 2 + 2.2, 0]}>
            <boxGeometry args={[l.shift + l.w + 3, 0.5, 0.6]} />
            <meshStandardMaterial color="#1b1c24" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 6.5, -l.R - 6]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[8, 2]} />
            <meshBasicMaterial map={sign} toneMapped={false} color={new THREE.Color(1.6, 1.6, 1.6)} side={THREE.DoubleSide} />
          </mesh>
          {[-l.w / 2 - 0.3, l.w / 2 + 0.3].map((x) => (
            <mesh key={x} position={[x, 3.2, -l.R - 6]}>
              <boxGeometry args={[0.25, 6.5, 0.25]} />
              <meshStandardMaterial color="#1b1c24" />
            </mesh>
          ))}
          {/* approach chevrons */}
          {Array.from({ length: 8 }).map((_, k) => (
            <mesh key={k} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, -4 - k * 4]}>
              <planeGeometry args={[l.w * 0.8, 0.6]} />
              <meshBasicMaterial color={new THREE.Color("#ff7a00").multiplyScalar(1.8)} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Ground plate + signage of the test-track district. */
function TrackGround() {
  const { x0, x1, z0, z1 } = TRACK_AREA
  const w = x1 - x0
  const d = z1 - z0
  const tex = useMemo(
    () =>
      canvasTexture(1024, 1024, (ctx) => {
        ctx.fillStyle = "#0b0a0f"
        ctx.fillRect(0, 0, 1024, 1024)
        ctx.strokeStyle = "rgba(255,176,0,0.14)"
        ctx.lineWidth = 2
        for (let i = 0; i <= 1024; i += 64) {
          ctx.beginPath()
          ctx.moveTo(i, 0)
          ctx.lineTo(i, 1024)
          ctx.moveTo(0, i)
          ctx.lineTo(1024, i)
          ctx.stroke()
        }
        // hazard border
        for (let i = 0; i < 1024; i += 40) {
          ctx.fillStyle = (i / 40) % 2 ? "#ffb000" : "#111"
          ctx.fillRect(i, 0, 40, 14)
          ctx.fillRect(i, 1010, 40, 14)
          ctx.fillRect(0, i, 14, 40)
          ctx.fillRect(1010, i, 14, 40)
        }
        ctx.font = "bold 64px monospace"
        ctx.textAlign = "center"
        ctx.fillStyle = "rgba(255,176,0,0.9)"
        ctx.fillText("NEXUS TEST TRACK", 512, 110)
        ctx.font = "bold 30px monospace"
        ctx.fillStyle = "rgba(255,34,68,0.9)"
        ctx.fillText("▲ FLIP ZONE ▲", 512 + 0.05 * 1024, 900)
      }),
    [],
  )
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.035, (z0 + z1) / 2]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.7} roughness={0.45} metalness={0.4} />
      </mesh>
      {/* entrance gantry */}
      <group position={[TRACK_START.x, 0, TRACK_START.z]}>
        {[1, -1].map((s) => (
          <mesh key={s} position={[s * 8, 4, 0]}>
            <boxGeometry args={[0.5, 8, 0.5]} />
            <meshStandardMaterial color="#202230" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        <mesh position={[0, 8, 0]}>
          <boxGeometry args={[16.5, 1.4, 0.4]} />
          <meshBasicMaterial color={new THREE.Color("#ffb000").multiplyScalar(2.2)} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

function ShowroomPad() {
  const ringRef = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (ringRef.current) ringRef.current.rotation.y += dt * 0.4
  })
  return (
    <group position={[SPAWN.x, 0.04, SPAWN.z]}>
      <mesh receiveShadow>
        <cylinderGeometry args={[5.4, 5.6, 0.06, 6]} />
        <meshStandardMaterial color="#0d0f16" metalness={0.9} roughness={0.15} />
      </mesh>
      <group ref={ringRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[5.1, 5.3, 6]} />
          <meshBasicMaterial color={new THREE.Color("#00e5ff").multiplyScalar(3)} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[3.6, 3.68, 64, 1, 0, Math.PI * 1.4]} />
          <meshBasicMaterial color={new THREE.Color("#ff2bd6").multiplyScalar(3)} toneMapped={false} />
        </mesh>
      </group>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 5.4, 0.12, Math.sin(a) * 5.4]}>
            <boxGeometry args={[0.5, 0.18, 0.5]} />
            <meshBasicMaterial color={new THREE.Color("#7a5cff").multiplyScalar(3)} toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}

const coneState = CITY.cones.map((c) => ({ x: c.x, z: c.z, vx: 0, vz: 0, tilt: 0, spin: 0, ry: 0 }))

function Cones() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.ConeGeometry(0.32, 0.9, 12).translate(0, 0.45, 0), [])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const mesh = ref.current
    if (!mesh) return
    coneState.forEach((c, i) => {
      const dx = c.x - drive.x
      const dz = c.z - drive.z
      const dist = Math.hypot(dx, dz)
      if (dist < 1.9 && drive.y < 1) {
        const nx = dx / (dist || 1)
        const nz = dz / (dist || 1)
        const push = Math.max(4, drive.speedAbs * 1.1)
        c.vx = drive.vx * 0.9 + nx * push * 0.5
        c.vz = drive.vz * 0.9 + nz * push * 0.5
        c.spin = (Math.random() - 0.5) * 14
        c.tilt = Math.PI / 2
        drive.speed *= 0.995
      }
      c.x += c.vx * dt
      c.z += c.vz * dt
      const f = Math.exp(-dt * 1.6)
      c.vx *= f
      c.vz *= f
      c.ry += c.spin * dt
      c.spin *= f
      tmp.position.set(c.x, c.tilt ? 0.3 : 0, c.z)
      tmp.rotation.set(0, c.ry, 0)
      tmp.rotateX(c.tilt)
      tmp.scale.setScalar(1)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[geo, undefined, coneState.length]} castShadow frustumCulled={false}>
      <meshStandardMaterial color="#ff5a00" emissive="#ff3a00" emissiveIntensity={0.8} roughness={0.5} />
    </instancedMesh>
  )
}

export function resetCones() {
  coneState.forEach((c, i) => {
    c.x = CITY.cones[i].x
    c.z = CITY.cones[i].z
    c.vx = c.vz = c.tilt = c.spin = c.ry = 0
  })
}

/** Respawn timestamps per orb (0 = available). Read by the minimap. */
export const orbRespawn = new Float32Array(CITY.orbs.length)

function Orbs() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const haloRef = useRef<THREE.InstancedMesh>(null)
  const haloMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: getGlowTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: new THREE.Color("#00ff9c").multiplyScalar(1.5),
        toneMapped: false,
      }),
    [],
  )
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const mesh = ref.current
    const halo = haloRef.current
    if (!mesh || !halo) return
    CITY.orbs.forEach((o, i) => {
      if (orbRespawn[i] && t > orbRespawn[i]) orbRespawn[i] = 0
      const active = orbRespawn[i] === 0
      if (active && Math.hypot(o.x - drive.x, o.z - drive.z) < 2.6 && Math.abs(drive.y + 1 - o.y) < 3) {
        orbRespawn[i] = t + 30
        drive.score += 250
        drive.nitro = Math.min(1, drive.nitro + 0.4)
        drive.orbs += 1
        drive.pickupTime = performance.now()
      }
      tmp.position.set(o.x, o.y + Math.sin(t * 2 + i) * 0.3, o.z)
      tmp.rotation.set(0, t * 2 + i, Math.PI / 4)
      tmp.scale.setScalar(active ? 0.75 : 0)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
      tmp.rotation.set(0, 0, 0)
      tmp.lookAt(state.camera.position)
      tmp.scale.setScalar(active ? 4.5 : 0)
      tmp.updateMatrix()
      halo.setMatrixAt(i, tmp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    halo.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, CITY.orbs.length]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={new THREE.Color("#00ff9c").multiplyScalar(3)} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={haloRef} args={[undefined, haloMat, CITY.orbs.length]} frustumCulled={false}>
        <planeGeometry />
      </instancedMesh>
    </>
  )
}

// ---------------------------------------------------------------------------
// Boundary, mountains, sky
// ---------------------------------------------------------------------------

function Boundary() {
  const tex = useMemo(() => {
    const t = canvasTexture(256, 64, (ctx) => {
      ctx.clearRect(0, 0, 256, 64)
      ctx.strokeStyle = "rgba(0,229,255,0.9)"
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, 254, 62)
      ctx.beginPath()
      for (let x = 0; x < 256; x += 32) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x + 32, 64)
      }
      ctx.stroke()
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set((WORLD_LIMIT * 2) / 24, 1)
    return t
  }, [])
  const L = WORLD_LIMIT
  return (
    <group>
      {[
        [0, L, 0],
        [0, -L, 0],
        [L, 0, Math.PI / 2],
        [-L, 0, Math.PI / 2],
      ].map(([x, z, r], i) => (
        <mesh key={i} position={[x, 3, z]} rotation={[0, r, 0]}>
          <planeGeometry args={[L * 2, 6]} />
          <meshBasicMaterial
            map={tex}
            transparent
            opacity={0.55}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            color={new THREE.Color("#00e5ff").multiplyScalar(1.4)}
          />
        </mesh>
      ))}
    </group>
  )
}

const MOUNTAINS = (() => {
  let seed = 31
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: 46 }).map((_, i) => {
    const a = (i / 46) * Math.PI * 2 + rnd() * 0.1
    const r = 900 + rnd() * 400
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 120 + rnd() * 260, w: 160 + rnd() * 200 }
  })
})()

function Mountains() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const wireRef = useRef<THREE.InstancedMesh>(null)
  const fill = (i: number, o: THREE.Object3D) => {
    const m = MOUNTAINS[i]
    o.position.set(m.x, m.h / 2 - 2, m.z)
    o.scale.set(m.w, m.h, m.w)
    o.rotation.y = i
  }
  useInstances(ref, MOUNTAINS.length, fill)
  useInstances(wireRef, MOUNTAINS.length, (i, o) => {
    fill(i, o)
    o.scale.multiplyScalar(1.002)
  })
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, MOUNTAINS.length]}>
        <coneGeometry args={[0.5, 1, 5]} />
        <meshStandardMaterial color="#0c0818" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={wireRef} args={[undefined, undefined, MOUNTAINS.length]}>
        <coneGeometry args={[0.5, 1, 5, 4]} />
        <meshBasicMaterial color="#3d1a7a" wireframe transparent opacity={0.35} />
      </instancedMesh>
    </>
  )
}

function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {},
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP;
          void main(){
            float h = vP.y;
            vec3 top = vec3(0.01, 0.01, 0.05);
            vec3 mid = vec3(0.07, 0.02, 0.16);
            vec3 hor = vec3(0.45, 0.06, 0.38);
            vec3 col = mix(hor, mid, smoothstep(0.0, 0.18, h));
            col = mix(col, top, smoothstep(0.18, 0.7, h));
            col += vec3(0.0, 0.25, 0.35) * pow(1.0 - abs(h), 18.0) * 0.6;
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  )
  const ringRef = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => {
    if (ringRef.current) ringRef.current.rotation.z += dt * 0.01
  })
  return (
    <group>
      <mesh material={mat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[2600, 32, 16]} />
      </mesh>
      <Stars radius={1600} depth={400} count={5000} factor={7} saturation={0.6} fade speed={0.4} />
      {/* ringed gas giant */}
      <group position={[-900, 520, -1700]}>
        <mesh>
          <sphereGeometry args={[260, 48, 32]} />
          <meshStandardMaterial color="#5a2a8a" emissive="#2a0c4a" roughness={1} fog={false} />
        </mesh>
        <mesh ref={ringRef} rotation={[1.25, 0.2, 0]}>
          <ringGeometry args={[340, 520, 96]} />
          <meshBasicMaterial color="#c08cff" transparent opacity={0.28} side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>
      <mesh position={[1300, 700, -1200]}>
        <sphereGeometry args={[60, 32, 16]} />
        <meshBasicMaterial color={new THREE.Color("#dff6ff").multiplyScalar(2)} toneMapped={false} fog={false} />
      </mesh>
    </group>
  )
}

export function City() {
  return (
    <group>
      <Sky />
      <Mountains />
      <Ground />
      <Towers />
      <NeonEdges />
      <Antennas />
      <Billboards />
      <StreetLights />
      <Trees />
      <HoloArches />
      <FlyingTraffic />
      <Surfaces />
      <LoopTracks />
      <TrackGround />
      <ShowroomPad />
      <Cones />
      <Orbs />
      <Boundary />
    </group>
  )
}
