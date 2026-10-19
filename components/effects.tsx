"use client"

import { useLayoutEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { drive, input } from "./drive-store"
import type { CarConfig } from "./types"

const MAX_MARKS = 1600
const MAX_PARTICLES = 500
const tmp = new THREE.Object3D()
const zero = new THREE.Matrix4().makeScale(0, 0, 0)

/** Rear-wheel skid marks (ring buffer) + tire smoke / nitro particles. */
export function DriveEffects({ config, active }: { config: CarConfig; active: boolean }) {
  const marksRef = useRef<THREE.InstancedMesh>(null)
  const markIndex = useRef(0)
  const lastWheel = useRef<(THREE.Vector2 | null)[]>([null, null])
  const { gl } = useThree()

  const markGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), [])
  const markMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  )

  useLayoutEffect(() => {
    const m = marksRef.current
    if (!m) return
    for (let i = 0; i < MAX_MARKS; i++) m.setMatrixAt(i, zero)
    m.instanceMatrix.needsUpdate = true
  }, [])

  // ---- particles
  const particles = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(MAX_PARTICLES * 3)
    const col = new Float32Array(MAX_PARTICLES * 3)
    const size = new Float32Array(MAX_PARTICLES)
    const alpha = new Float32Array(MAX_PARTICLES)
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3))
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1))
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1))
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        varying vec3 vColor; varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // fade out particles that get too close to the camera
          vAlpha = aAlpha * smoothstep(1.5, 5.0, -mv.z);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = pow(smoothstep(0.5, 0.0, d), 1.6) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
    })
    return {
      geo,
      mat,
      pos,
      col,
      size,
      alpha,
      vel: new Float32Array(MAX_PARTICLES * 3),
      life: new Float32Array(MAX_PARTICLES),
      maxLife: new Float32Array(MAX_PARTICLES),
      grow: new Float32Array(MAX_PARTICLES),
      amp: new Float32Array(MAX_PARTICLES),
      next: 0,
    }
  }, [])

  const smokeColor = useMemo(() => new THREE.Color(), [])
  const nitroColor = useMemo(() => new THREE.Color(), [])
  const jetColor = useMemo(() => new THREE.Color(), [])
  const white = useMemo(() => new THREE.Color("#ffffff"), [])

  function emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    s: number,
    c: THREE.Color,
    life: number,
    grow: number,
    amp = grow < 0 ? 1 : 0.28,
  ) {
    const p = particles
    const i = p.next
    p.next = (p.next + 1) % MAX_PARTICLES
    p.pos.set([x, y, z], i * 3)
    p.vel.set([vx, vy, vz], i * 3)
    p.col.set([c.r, c.g, c.b], i * 3)
    p.size[i] = s
    p.life[i] = life
    p.maxLife[i] = life
    p.grow[i] = grow
    p.amp[i] = amp
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const cam = state.camera as THREE.PerspectiveCamera
    particles.mat.uniforms.uScale.value =
      (gl.domElement.height * 0.5) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / 1
    const h = drive.heading
    const fx = Math.sin(h)
    const fz = Math.cos(h)
    const rx = -Math.cos(h)
    const rz = Math.sin(h)
    const sp = drive.speedAbs

    const skidding =
      active &&
      !drive.airborne &&
      drive.flip === "none" &&
      (drive.drifting ||
        (input.handbrake && sp > 4) ||
        (drive.braking && input.brake > 0.5 && sp > 14) ||
        (input.throttle > 0.9 && drive.speed > 0 && drive.speed < 7))

    // ---- skid marks
    const marks = marksRef.current
    if (marks) {
      let dirty = false
      ;[1, -1].forEach((side, w) => {
        const wx = drive.x + rx * side * 0.88 - fx * 1.4
        const wz = drive.z + rz * side * 0.88 - fz * 1.4
        const last = lastWheel.current[w]
        if (!skidding) {
          lastWheel.current[w] = null
          return
        }
        if (!last) {
          lastWheel.current[w] = new THREE.Vector2(wx, wz)
          return
        }
        const dx = wx - last.x
        const dz = wz - last.y
        const len = Math.hypot(dx, dz)
        if (len < 0.3) return
        tmp.position.set((wx + last.x) / 2, drive.y + 0.035, (wz + last.y) / 2)
        tmp.rotation.set(0, Math.atan2(dx, dz), 0)
        tmp.scale.set(0.3, 1, len + 0.04)
        tmp.updateMatrix()
        marks.setMatrixAt(markIndex.current, tmp.matrix)
        markIndex.current = (markIndex.current + 1) % MAX_MARKS
        last.set(wx, wz)
        dirty = true

        // smoke from this wheel
        smokeColor.set(config.neonColor).lerp(new THREE.Color("#cfd3dc"), 0.75)
        const n = drive.drifting ? 2 : 1
        for (let k = 0; k < n; k++) {
          emit(
            wx + (Math.random() - 0.5) * 0.4,
            drive.y + 0.25,
            wz + (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 2 - drive.vx * 0.08,
            0.6 + Math.random() * 0.8,
            (Math.random() - 0.5) * 2 - drive.vz * 0.08,
            0.4 + Math.random() * 0.3,
            smokeColor,
            1.0 + Math.random() * 0.6,
            1.1,
          )
        }
      })
      if (dirty) marks.instanceMatrix.needsUpdate = true
    }

    // ---- nitro flames
    if (active && drive.boosting) {
      nitroColor.set(config.neonColor).multiplyScalar(3)
      for (const side of [0.35, -0.35]) {
        const ex = drive.x - fx * 2.45 + rx * side
        const ez = drive.z - fz * 2.45 + rz * side
        for (let k = 0; k < 2; k++) {
          emit(
            ex,
            drive.y + 0.42,
            ez,
            drive.vx * 0.85 - fx * 6 + (Math.random() - 0.5),
            (Math.random() - 0.5) * 0.6,
            drive.vz * 0.85 - fz * 6 + (Math.random() - 0.5),
            0.32 + Math.random() * 0.15,
            nitroColor,
            0.18 + Math.random() * 0.1,
            -1.2,
          )
        }
      }
    }

    // ---- air-pressure jets out of the wheels while upside down
    if (active && drive.jet > 0) {
      const blast = drive.jet === 2
      jetColor.set(config.neonColor).lerp(white, 0.6).multiplyScalar(blast ? 1.6 : 1.1)
      const n = blast ? 4 : 1
      for (let w = 0; w < 4; w++) {
        if (!((drive.jetMask >> w) & 1)) continue
        const k = w * 3
        const [px, py, pz] = [drive.wheelPos[k], drive.wheelPos[k + 1], drive.wheelPos[k + 2]]
        const [dx, dy, dz] = [drive.wheelDir[k], drive.wheelDir[k + 1], drive.wheelDir[k + 2]]
        const speed = blast ? 9 : 3
        for (let j = 0; j < n; j++) {
          emit(
            px + (Math.random() - 0.5) * 0.2,
            py,
            pz + (Math.random() - 0.5) * 0.2,
            dx * speed + (Math.random() - 0.5) * 2 + drive.vx * 0.5,
            dy * speed + (Math.random() - 0.5) * 2 + (blast ? 1.5 : 0.5),
            dz * speed + (Math.random() - 0.5) * 2 + drive.vz * 0.5,
            blast ? 0.45 : 0.25,
            jetColor,
            blast ? 0.6 + Math.random() * 0.4 : 0.35,
            blast ? 2.6 : 1.2,
            blast ? 0.65 : 0.4,
          )
        }
      }
    }

    // ---- integrate particles
    const p = particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (p.life[i] <= 0) {
        p.alpha[i] = 0
        continue
      }
      p.life[i] -= dt
      const k = i * 3
      p.pos[k] += p.vel[k] * dt
      p.pos[k + 1] += p.vel[k + 1] * dt
      p.pos[k + 2] += p.vel[k + 2] * dt
      const damp = Math.exp(-dt * 1.5)
      p.vel[k] *= damp
      p.vel[k + 2] *= damp
      p.vel[k + 1] += 0.4 * dt
      p.size[i] = Math.max(0.05, p.size[i] + p.grow[i] * dt)
      const f = Math.max(0, p.life[i] / p.maxLife[i])
      p.alpha[i] = f * p.amp[i]
    }
    p.geo.attributes.position.needsUpdate = true
    p.geo.attributes.aColor.needsUpdate = true
    p.geo.attributes.aSize.needsUpdate = true
    p.geo.attributes.aAlpha.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={marksRef} args={[markGeo, markMat, MAX_MARKS]} frustumCulled={false} renderOrder={1} />
      <points geometry={particles.geo} material={particles.mat} frustumCulled={false} renderOrder={5} />
    </>
  )
}
