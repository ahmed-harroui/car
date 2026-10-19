"use client"

import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { CarModel, getBodyDims } from "./car-model"
import { getPerformance, type CarConfig } from "./types"
import { drive, input, pollInput, resetDrive } from "./drive-store"
import {
  LOOPS,
  WORLD_LIMIT,
  forNearbyColliders,
  groundAt,
  localToWorld,
  loopPoint,
  worldToLocal,
  type Loop,
  type Surface,
} from "./world/city-layout"

const GRAVITY = 24
import { resetCones } from "./world/city"

const clamp = THREE.MathUtils.clamp
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

export function toast(text: string) {
  drive.toast = text
  drive.toastTime = performance.now()
}

export function Vehicle({
  config,
  isDriving,
  controlsRef,
}: {
  config: CarConfig
  isDriving: boolean
  controlsRef: React.RefObject<any>
}) {
  const root = useRef<THREE.Group>(null)
  const pivot = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const perf = useMemo(() => getPerformance(config), [config])
  const dims = useMemo(() => getBodyDims(config.bodyStyle), [config.bodyStyle])
  const { camera } = useThree()
  const cam = camera as THREE.PerspectiveCamera
  const s = useRef({
    prevVF: 0,
    pitch: 0,
    driftTime: 0,
    offDrift: 0,
    airTime: 0,
    airRoll: 0,
    rollRate: 0,
    lastSurf: null as Surface | null,
    loop: null as Loop | null,
    theta: 0,
    loopV: 0,
    loopFall: false,
    pitchRate: 0,
    flipTimer: 0,
    flipTarget: 0,
    recoverFrom: 0,
    camYaw: 0,
    camInit: false,
    lookTarget: new THREE.Vector3(),
    v: new THREE.Vector3(),
  })

  useEffect(() => {
    s.current.camInit = false
    if (!isDriving) {
      input.throttle = input.brake = input.steer = 0
      input.handbrake = input.boost = false
      cam.fov = 50
      cam.updateProjectionMatrix()
    }
  }, [isDriving, cam])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const st = s.current
    const t = state.clock.elapsedTime

    if (drive.resetRequested) {
      resetDrive()
      resetCones()
      drive.resetRequested = false
      st.camInit = false
      st.pitch = st.rollRate = 0
      st.loop = null
      st.loopFall = false
    }
    if (drive.teleport) {
      st.loop = null
      st.loopFall = false
      resetDrive()
      drive.x = drive.teleport.x
      drive.z = drive.teleport.z
      drive.heading = drive.teleport.heading
      drive.teleport = null
      st.camInit = false
      st.pitch = st.rollRate = 0
    }

    if (isDriving) {
      pollInput(dt)
      if (drive.flip !== "none") stepFlip(dt)
      else if (st.loop) stepLoop(dt)
      else step(dt)
    } else {
      st.loop = null
      st.loopFall = false
      drive.autoLand = false
      if (drive.flip !== "none" || Math.abs(drive.roll) > 0.01) {
        drive.flip = "none"
        drive.jet = 0
        drive.roll *= 0.85
      }
      // coast to a stop while in the garage view
      drive.vx *= Math.exp(-dt * 3)
      drive.vz *= Math.exp(-dt * 3)
      drive.speed *= Math.exp(-dt * 3)
      drive.speedAbs = Math.hypot(drive.vx, drive.vz)
      drive.x += drive.vx * dt
      drive.z += drive.vz * dt
      drive.y += (groundAt(drive.x, drive.z).h - drive.y) * Math.min(1, dt * 6)
      drive.airborne = false
      drive.drifting = false
      drive.boosting = false
      drive.braking = false
      drive.bodyRoll = 0
      drive.bodyPitch = 0
      st.pitch *= 0.9
    }

    // roll happens around the middle of the body, lifted so the car rests on its side/roof
    const g = root.current
    const p = dims.roof / 2
    if (g && pivot.current && inner.current) {
      g.position.set(drive.x, drive.y, drive.z)
      g.rotation.set(-st.pitch, drive.heading, 0, "YXZ")
      pivot.current.position.y = p + Math.max(0, dims.halfWidth - p) * Math.abs(Math.sin(drive.roll))
      pivot.current.rotation.z = drive.roll
      inner.current.position.y = -p
      inner.current.updateWorldMatrix(true, false)
      const m = inner.current.matrixWorld
      let k = 0
      for (const z of [dims.front, dims.rear]) {
        for (const side of [1, -1]) {
          st.v.set(side * (dims.track + 0.15), dims.wheelR, z).applyMatrix4(m)
          drive.wheelPos.set([st.v.x, st.v.y, st.v.z], k)
          st.v.set(side * 0.8, -0.6, 0).transformDirection(m)
          drive.wheelDir.set([st.v.x, st.v.y, st.v.z], k)
          k += 3
        }
      }
    }

    if (isDriving) updateCamera(dt, t)
    else if (controlsRef.current) {
      const target = controlsRef.current.target as THREE.Vector3
      target.lerp(st.lookTarget.set(drive.x, drive.y + 0.7, drive.z), Math.min(1, dt * 4))
      controlsRef.current.update()
    }
  })

  function step(dt: number) {
    const P = perf
    const st = s.current
    const h = drive.heading
    const fx = Math.sin(h)
    const fz = Math.cos(h)
    const rx = -Math.cos(h)
    const rz = Math.sin(h)
    let vF = drive.vx * fx + drive.vz * fz
    let vR = drive.vx * rx + drive.vz * rz
    const grounded = !drive.airborne

    // --- nitro
    const boosting = input.boost && drive.nitro > 0.01
    drive.boosting = boosting
    if (boosting) drive.nitro = Math.max(0, drive.nitro - dt * 0.28)
    else drive.nitro = Math.min(1, drive.nitro + dt * (drive.drifting ? 0.12 : 0.025))

    const top = P.topSpeed * (boosting ? 1.3 : 1)
    const throttle = boosting ? 1 : input.throttle
    let braking = false

    if (grounded) {
      if (throttle > 0) {
        if (vF < -1) {
          vF += 28 * dt * throttle
          braking = true
        } else {
          const ratio = Math.max(0, vF) / top
          vF += P.accel * (boosting ? 1.5 : 1) * throttle * Math.max(0, 1 - ratio * ratio) * dt
        }
      }
      if (input.brake > 0) {
        if (vF > 1) {
          vF -= 36 * input.brake * dt
          braking = true
        } else vF = Math.max(-16, vF - 14 * input.brake * dt)
      }
      if (throttle === 0 && input.brake === 0) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 2.2 * dt)
      vF -= vF * 0.05 * dt
      if (input.handbrake) vF -= Math.sign(vF) * Math.min(Math.abs(vF), 4.5 * dt)

      const speed = Math.hypot(vF, vR)
      const slip = Math.abs(vR) / Math.max(4, Math.abs(vF))
      let grip = P.grip
      if (input.handbrake) grip = P.driftGrip
      else if (slip > 0.18 && speed > 7) {
        // sustained slide: throttle keeps it alive, lifting regains grip
        grip = THREE.MathUtils.lerp(P.grip, P.driftGrip * 1.8, config.driftiness) * (throttle > 0 ? 0.7 : 1.2)
      }
      const newVR = vR * Math.exp(-grip * dt)
      if (vF > 0) vF += (Math.abs(vR) - Math.abs(newVR)) * 0.3 // keep momentum out of the slide
      vR = newVR

      const steerAuth = clamp(Math.abs(vF) / 5, 0, 1) / (1 + Math.abs(vF) / 55)
      let target = input.steer * P.turnRate * steerAuth * (vF < -0.5 ? -1 : 1)
      const sliding = input.handbrake || slip > 0.25
      if (sliding) target *= 1.4
      drive.yawRate += (target - drive.yawRate) * Math.min(1, dt * (sliding ? 4 : 9))
    } else {
      drive.yawRate *= Math.exp(-dt * 1.2)
      vF -= vF * 0.02 * dt
    }

    drive.heading = wrap(drive.heading + drive.yawRate * dt)
    drive.vx = fx * vF + rx * vR
    drive.vz = fz * vF + rz * vR
    const prevX = drive.x
    const prevZ = drive.z
    drive.x += drive.vx * dt
    drive.z += drive.vz * dt

    const nfx = Math.sin(drive.heading)
    const nfz = Math.cos(drive.heading)
    const hit = collide()
    if (hit > 3) {
      drive.shake = Math.min(1, drive.shake + hit / 14)
      if (hit > 7 && drive.driftCombo > 0) {
        drive.driftCombo = 0
        st.driftTime = 0
        drive.crashTime = performance.now()
        toast("CRASH · COMBO LOST")
      }
    }

    // --- ground, ramps, banks & kickers
    const gr = groundAt(drive.x, drive.z)
    if (!drive.airborne) {
      if (gr.h - drive.y > 0.9) {
        // hit the tall side of a surface: treat as a wall
        drive.x = prevX
        drive.z = prevZ
        drive.vx *= -0.3
        drive.vz *= -0.3
        drive.shake = Math.min(1, drive.shake + 0.4)
      } else if (gr.h >= drive.y - 0.6) {
        drive.vy = (gr.h - drive.y) / dt
        drive.y = gr.h
        st.lastSurf = gr.surf
      } else {
        takeOff()
      }
    } else {
      drive.vy -= GRAVITY * dt
      autoLanding(dt, drive.y - gr.h)
      drive.y += drive.vy * dt
      st.airTime += dt
      drive.roll += st.rollRate * dt
      st.airRoll += Math.abs(st.rollRate * dt)
      if (!drive.autoLand) st.rollRate *= Math.exp(-dt * 0.25)
      if (st.loopFall || drive.autoLand) st.pitch += st.pitchRate * dt
      if (drive.y <= gr.h) {
        drive.y = gr.h
        drive.airborne = false
        drive.shake = Math.min(1, drive.shake + Math.max(0, -drive.vy) / 22)
        drive.vy = 0
        const assisted = drive.autoLand
        drive.autoLand = false
        drive.jet = 0
        let landed = ""
        if (assisted && Math.abs(wrap(drive.roll)) < 0.5 && Math.cos(st.pitch) > 0.85) {
          st.loopFall = false
          st.pitch = wrap(st.pitch)
          drive.roll = wrap(drive.roll)
          st.rollRate = 0
          drive.score += 500
          landed = "AUTO-LANDING ✓ +500"
          toast(landed)
        }
        if (st.loopFall) {
          // fell off the loop: nose-over-tail rotation; on the roof = same pose as heading+π, roll π
          st.loopFall = false
          if (Math.cos(st.pitch) < 0.2) {
            drive.heading = wrap(drive.heading + Math.PI)
            st.pitch = 0
            drive.roll = Math.PI
            startFlip(Math.PI)
            return
          }
          st.pitch = wrap(st.pitch)
        }
        const r = wrap(drive.roll)
        drive.roll = r
        if (Math.abs(r) > 1.1) {
          startFlip(r)
          return
        }
        if (st.airRoll > 5) {
          const bonus = 1500 * Math.round(st.airRoll / (Math.PI * 2))
          drive.score += bonus
          toast(`BARREL ROLL +${bonus}${landed ? " · " + landed : ""}`)
        } else if (st.airTime > 0.55) {
          const bonus = Math.round(st.airTime * 400)
          drive.score += bonus
          toast(`BIG AIR +${bonus}${landed ? " · " + landed : ""}`)
        }
        st.rollRate = 0
      }
    }

    // --- side roll from the terrain (banks), tipping over when too slow
    if (!drive.airborne) {
      const lx = Math.cos(drive.heading) * 0.9
      const lz = -Math.sin(drive.heading) * 0.9
      const hL = groundAt(drive.x + lx, drive.z + lz).h
      const hR = groundAt(drive.x - lx, drive.z - lz).h
      const target = Math.atan2(hL - hR, 1.8)
      const prev = drive.roll
      drive.roll += (target - drive.roll) * Math.min(1, dt * 14)
      st.rollRate += ((drive.roll - prev) / dt - st.rollRate) * 0.5
      const spNow = Math.hypot(drive.vx, drive.vz)
      if (Math.abs(target) > 0.6 && spNow < 11) {
        // not enough speed to stick to the bank: the car rolls down
        takeOff()
        drive.vy = 2.5
        st.rollRate = Math.sign(target) * 3.4
        toast("TIPPING OVER!")
      }
    }

    // --- enter a loop when lined up with its entry lane
    if (!drive.airborne) {
      for (const l of LOOPS) {
        const p = worldToLocal(l, drive.x, drive.z)
        const aligned = Math.cos(wrap(drive.heading - l.rot)) > 0.85
        if (aligned && Math.abs(p.lx) < l.w / 2 && p.lz > -2.2 && p.lz < 0.3 && vF > 4) {
          st.loop = l
          st.theta = 0
          st.loopV = vF
          drive.heading = l.rot
          drive.yawRate = 0
          return
        }
      }
    }

    // --- pitch from terrain or flight
    if (st.loopFall || drive.autoLand) {
      // rotation handled in the airborne branch
    } else if (!drive.airborne) {
      const hf = groundAt(drive.x + nfx * 1.4, drive.z + nfz * 1.4).h
      const hb = groundAt(drive.x - nfx * 1.4, drive.z - nfz * 1.4).h
      st.pitch += (Math.atan2(hf - hb, 2.8) - st.pitch) * Math.min(1, dt * 12)
    } else {
      const target = clamp(Math.atan2(drive.vy, Math.max(8, Math.abs(vF))) * 0.6, -0.5, 0.4)
      st.pitch += (target - st.pitch) * Math.min(1, dt * 2)
    }

    // --- telemetry for visuals / HUD
    const sp = Math.hypot(drive.vx, drive.vz)
    const vFn = drive.vx * nfx + drive.vz * nfz
    const vRn = drive.vx * -Math.cos(drive.heading) + drive.vz * Math.sin(drive.heading)
    drive.speed = vFn
    drive.speedAbs = sp
    drive.braking = braking || input.brake > 0
    drive.driftAngle = Math.atan2(Math.abs(vRn), Math.abs(vFn))
    drive.drifting = !drive.airborne && sp > 9 && drive.driftAngle > 0.2 && vFn > 0
    drive.steerVisual += (input.steer * 0.5 - drive.steerVisual) * Math.min(1, dt * 12)
    drive.bodyRoll = clamp(drive.yawRate * vFn * 0.0065, -0.1, 0.1)
    const accel = (vFn - st.prevVF) / dt
    drive.bodyPitch = clamp(-accel * 0.0035, -0.05, 0.05)
    st.prevVF = vFn
    drive.shake *= Math.exp(-dt * 4)

    // --- drift scoring
    if (drive.drifting) {
      st.driftTime += dt
      st.offDrift = 0
      drive.driftMultiplier = Math.min(5, 1 + Math.floor(st.driftTime / 2))
      drive.driftCombo += sp * drive.driftAngle * dt * 6 * drive.driftMultiplier
    } else if (drive.driftCombo > 0 && !drive.airborne) {
      st.offDrift += dt
      if (st.offDrift > 0.9) {
        const banked = Math.round(drive.driftCombo)
        drive.score += banked
        drive.lastComboBanked = banked
        drive.lastComboTime = performance.now()
        drive.bestCombo = Math.max(drive.bestCombo, banked)
        drive.driftCombo = 0
        drive.driftMultiplier = 1
        st.driftTime = 0
      }
    }
  }

  /** Pushes the car out of buildings/trees and the world wall. Returns impact speed. */
  function collide() {
    let hit = 0
    const nfx = Math.sin(drive.heading)
    const nfz = Math.cos(drive.heading)
    if (drive.y < 6) {
      for (const off of [1.45, 0, -1.45]) {
        const r = 1.0
        let cx = drive.x + nfx * off
        let cz = drive.z + nfz * off
        forNearbyColliders(cx, cz, 2, (b) => {
          const px = clamp(cx, b.x0, b.x1)
          const pz = clamp(cz, b.z0, b.z1)
          const dx = cx - px
          const dz = cz - pz
          const d2 = dx * dx + dz * dz
          if (d2 > r * r) return
          let nx = 0
          let nz = 0
          let pen = 0
          if (d2 < 1e-6) {
            const opts = [
              [cx - b.x0, -1, 0],
              [b.x1 - cx, 1, 0],
              [cz - b.z0, 0, -1],
              [b.z1 - cz, 0, 1],
            ].sort((a, b2) => a[0] - b2[0])[0]
            nx = opts[1]
            nz = opts[2]
            pen = opts[0] + r
          } else {
            const d = Math.sqrt(d2)
            nx = dx / d
            nz = dz / d
            pen = r - d
          }
          drive.x += nx * pen
          drive.z += nz * pen
          cx += nx * pen
          cz += nz * pen
          const vn = drive.vx * nx + drive.vz * nz
          if (vn < 0) {
            drive.vx -= 1.3 * vn * nx
            drive.vz -= 1.3 * vn * nz
            drive.vx *= 0.9
            drive.vz *= 0.9
            hit = Math.max(hit, -vn)
          }
        })
      }
    }
    const lim = WORLD_LIMIT - 1.4
    if (Math.abs(drive.x) > lim) {
      hit = Math.max(hit, Math.abs(drive.vx))
      drive.x = Math.sign(drive.x) * lim
      drive.vx *= -0.4
    }
    if (Math.abs(drive.z) > lim) {
      hit = Math.max(hit, Math.abs(drive.vz))
      drive.z = Math.sign(drive.z) * lim
      drive.vz *= -0.4
    }
    return hit
  }

  function takeOff() {
    const st = s.current
    drive.airborne = true
    st.airTime = 0
    st.airRoll = 0
    // one-sided kickers convert their tilt into a violent barrel roll
    if (st.lastSurf?.type === "kicker") st.rollRate *= 2.6
    st.rollRate = clamp(st.rollRate, -7, 7)
  }

  function startFlip(r: number) {
    const st = s.current
    drive.flip = "upside"
    drive.airborne = false
    st.flipTimer = 0
    st.rollRate = 0
    st.flipTarget = Math.abs(r) > 2 ? Math.sign(r) * Math.PI : (Math.sign(r) * Math.PI) / 2
    drive.drifting = false
    drive.driftCombo = 0
    drive.driftMultiplier = 1
    st.driftTime = 0
    drive.shake = 1
    toast(Math.abs(st.flipTarget) > 2 ? "FLIPPED ON THE ROOF!" : "ROLLED ON THE SIDE!")
  }

  /** Upside down: slide to a stop, build air pressure, then blast back onto the wheels. */
  function stepFlip(dt: number) {
    const st = s.current
    st.flipTimer += dt
    const f = Math.exp(-dt * 2.4)
    drive.vx *= f
    drive.vz *= f
    drive.yawRate *= Math.exp(-dt * 3)
    drive.heading = wrap(drive.heading + drive.yawRate * dt)
    drive.x += drive.vx * dt
    drive.z += drive.vz * dt
    const hit = collide()
    if (hit > 3) drive.shake = Math.min(1, drive.shake + hit / 14)
    const gr = groundAt(drive.x, drive.z)

    drive.speedAbs = Math.hypot(drive.vx, drive.vz)
    drive.speed = drive.vx * Math.sin(drive.heading) + drive.vz * Math.cos(drive.heading)
    drive.drifting = drive.boosting = drive.braking = false
    drive.steerVisual *= 0.9
    drive.bodyRoll = drive.bodyPitch = 0
    st.pitch *= 0.9

    drive.jetMask = 0b1111
    if (drive.flip === "upside") {
      drive.roll += (st.flipTarget - drive.roll) * Math.min(1, dt * 7)
      drive.y += (gr.h - drive.y) * Math.min(1, dt * 10)
      drive.jet = st.flipTimer > 0.45 ? 1 : 0
      if (st.flipTimer > 1.25) {
        drive.flip = "recover"
        st.flipTimer = 0
        st.recoverFrom = drive.roll
        drive.jet = 2
        drive.shake = 0.6
        toast("AIR-PRESSURE RECOVERY")
      }
    } else {
      const t = Math.min(1, st.flipTimer / 1.05)
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      drive.roll = st.recoverFrom * (1 - e)
      drive.y = gr.h + Math.sin(Math.PI * t) * 1.9
      drive.jet = t < 0.8 ? 2 : 0
      if (t >= 1) {
        drive.flip = "none"
        drive.roll = 0
        drive.y = gr.h
        drive.jet = 0
        drive.shake = 0.35
        drive.airborne = false
        st.rollRate = 0
      }
    }
    drive.shake *= Math.exp(-dt * 4)
  }

  /**
   * Mid-air auto-landing: once past the apex with a bad attitude, compressed-air jets fire
   * from the wheels on the sides that produce the needed rotation (front/rear for pitch,
   * left/right for roll), then all four cushion the touchdown.
   */
  function autoLanding(dt: number, height: number) {
    const st = s.current
    let pitchErr = wrap(-st.pitch)
    let rollErr = wrap(-drive.roll)
    const tilted = Math.abs(pitchErr) > 0.6 || Math.abs(rollErr) > 0.5
    if (!drive.autoLand) {
      if (!(drive.vy < 0 && height > 1.2 && tilted)) return
      drive.autoLand = true
      // nose pointing back over the tail: same attitude as turned around + upside down,
      // so a barrel roll lands the car facing where it is flying
      if (Math.abs(pitchErr) > Math.PI / 2) {
        // keep the body where it is: pitch pivots at the ground point, roll at mid-height
        drive.y += (dims.roof / 2) * (Math.cos(st.pitch) - 1)
        drive.heading = wrap(drive.heading + Math.PI)
        st.pitch = wrap(-Math.PI - st.pitch)
        drive.roll = wrap(drive.roll + Math.PI)
        st.camInit = false
        pitchErr = wrap(-st.pitch)
        rollErr = wrap(-drive.roll)
      }
      toast("AUTO-LANDING · AIR THRUSTERS")
    }
    const maxRate = 5
    st.pitchRate = clamp(pitchErr * 6, -maxRate, maxRate)
    st.rollRate = clamp(rollErr * 6, -maxRate, maxRate)
    let mask = 0
    // force pushes the wheel side up: front raises the nose, left raises the left side
    if (Math.abs(pitchErr) > 0.08) mask |= pitchErr > 0 ? 0b0011 : 0b1100
    if (Math.abs(rollErr) > 0.08) mask |= rollErr > 0 ? 0b0101 : 0b1010
    const upright = Math.abs(pitchErr) < 0.5 && Math.abs(rollErr) < 0.5
    if (upright && height < 7 && drive.vy < -3) {
      drive.vy += 40 * dt // air cushion
      mask = 0b1111
    }
    drive.jetMask = mask || 0b1111
    drive.jet = mask ? 2 : 1
  }

  /** Rides the loop. Gravity slows the car on the way up; without enough speed it falls off. */
  function stepLoop(dt: number) {
    const st = s.current
    const l = st.loop!
    const boosting = input.boost && drive.nitro > 0.01
    drive.boosting = boosting
    if (boosting) drive.nitro = Math.max(0, drive.nitro - dt * 0.28)
    const thrust = perf.accel * (boosting ? 1 : input.throttle) * 0.55
    st.loopV += (thrust - GRAVITY * Math.sin(st.theta) - 0.6) * dt
    st.theta += (st.loopV / l.R) * dt

    const fx = Math.sin(l.rot)
    const fz = Math.cos(l.rot)
    const v = st.loopV
    // contact force with the track: centripetal need minus gravity pulling away
    const normal = (v * v) / l.R + GRAVITY * Math.cos(st.theta)
    const launched = l.arc < Math.PI * 2 && st.theta >= l.arc
    if (normal < 0 || v < 0 || launched) {
      // leave the track along its tangent, still rotating nose-over-tail
      st.theta = Math.min(st.theta, l.arc)
      st.loop = null
      st.loopFall = true
      st.pitch = st.theta
      st.pitchRate = launched ? 0.6 : Math.max(1.2, v / l.R)
      drive.airborne = true
      st.airTime = 0
      st.airRoll = 0
      st.rollRate = 0
      drive.vx = fx * v * Math.cos(st.theta)
      drive.vz = fz * v * Math.cos(st.theta)
      drive.vy = v * Math.sin(st.theta)
      if (!launched) drive.driftCombo = 0
      if (launched) drive.score += 600
      toast(launched ? "LAUNCH! +600" : "TOO SLOW · FALLING OFF THE TRACK")
      return
    }

    if (st.theta >= l.arc) {
      const exit = localToWorld(l, l.shift, 0)
      drive.x = exit.x
      drive.z = exit.z
      drive.y = 0
      drive.vy = 0
      drive.heading = l.rot
      drive.vx = fx * v
      drive.vz = fz * v
      st.pitch = 0
      st.loop = null
      drive.score += 800
      toast("LOOP COMPLETE +800")
      return
    }

    const p = loopPoint(l, st.theta)
    const w = localToWorld(l, p.lx, p.lz)
    drive.x = w.x
    drive.z = w.z
    drive.y = p.y
    st.pitch = st.theta
    drive.roll = 0
    drive.vx = fx * v * Math.cos(st.theta)
    drive.vz = fz * v * Math.cos(st.theta)
    drive.speed = v
    drive.speedAbs = v
    drive.airborne = false
    drive.drifting = drive.braking = false
    drive.bodyRoll = 0
    drive.bodyPitch = 0
    drive.steerVisual *= 0.9
    drive.shake = Math.max(drive.shake * Math.exp(-dt * 4), 0.08)
  }

  function updateCamera(dt: number, t: number) {
    const st = s.current
    const h = drive.heading
    const fx = Math.sin(h)
    const fz = Math.cos(h)
    const sp = drive.speedAbs
    const car = st.lookTarget.set(drive.x, drive.y, drive.z)

    if (!st.camInit) {
      st.camYaw = Math.atan2(drive.x - cam.position.x, drive.z - cam.position.z)
      st.camInit = true
    }
    if (!drive.lookActive) {
      drive.lookYaw *= Math.exp(-dt * 2.2)
      drive.lookPitch *= Math.exp(-dt * 2.2)
    }

    // blend heading with travel direction so drifts show the car's angle
    let dx = fx
    let dz = fz
    if (sp > 4 && drive.speed > 0 && !st.loop && !st.loopFall) {
      dx = fx * 0.45 + (drive.vx / sp) * 0.55
      dz = fz * 0.45 + (drive.vz / sp) * 0.55
    }
    const targetYaw = Math.atan2(dx, dz) + drive.lookYaw
    st.camYaw += wrap(targetYaw - st.camYaw) * (1 - Math.exp(-dt * 4.5))

    const shake = drive.shake * 0.35
    const sx = (Math.random() - 0.5) * shake
    const sy = (Math.random() - 0.5) * shake

    const mode = drive.cameraMode
    const ratio = Math.min(1.3, sp / perf.topSpeed)
    let fov = 58 + ratio * 16 + (drive.boosting ? 9 : 0)

    if (mode === "hood") {
      // bumper cam: low, in front of the nose, nothing blocking the view
      const eye = config.bodyStyle === "titan" ? 1.1 : 0.75
      const ahead = 2.7
      cam.position.set(drive.x + fx * ahead + sx * 0.2, drive.y + eye + sy * 0.2, drive.z + fz * ahead)
      const ly = h + drive.lookYaw
      cam.lookAt(drive.x + Math.sin(ly) * 30, drive.y + eye - 0.3 + drive.lookPitch * 10, drive.z + Math.cos(ly) * 30)
      fov += 8
    } else {
      let dist = 6.4
      let height = 2.2
      let yaw = st.camYaw
      if (mode === "far") {
        dist = 11
        height = 4
      } else if (mode === "cinematic") {
        dist = 9
        height = 1.4 + Math.sin(t * 0.3) * 0.8
        yaw = t * 0.28 + drive.lookYaw
        fov = 45
      }
      dist += ratio * 1.2
      // narrow portrait screens need the camera further back to see the road
      if (cam.aspect < 1) {
        dist *= 1 + (1 - cam.aspect) * 0.9
        height *= 1 + (1 - cam.aspect) * 0.6
      }
      height += drive.lookPitch * dist
      // in the loop, stay low and watch the car go round instead of flying with it
      const camY = st.loop || st.loopFall ? 3 + drive.y * 0.35 : drive.y + height
      if (st.loop) dist += 4
      const desired = new THREE.Vector3(
        drive.x - Math.sin(yaw) * dist,
        Math.max(0.6, camY),
        drive.z - Math.cos(yaw) * dist,
      )
      cam.position.lerp(desired, 1 - Math.exp(-dt * (mode === "cinematic" ? 3 : 10)))
      cam.position.x += sx
      cam.position.y += sy
      cam.lookAt(car.x + fx * 1.5, car.y + 1, car.z + fz * 1.5)
    }

    cam.fov += (fov - cam.fov) * Math.min(1, dt * 4)
    cam.updateProjectionMatrix()
  }

  return (
    <group ref={root}>
      <group ref={pivot}>
        <group ref={inner}>
          <CarModel config={config} live={isDriving} />
        </group>
      </group>
    </group>
  )
}
