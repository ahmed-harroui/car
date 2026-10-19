/**
 * Mutable, frame-rate state shared between the 3D scene, the HUD and the
 * input layers. Kept outside React so 60fps updates never trigger re-renders.
 */

export type CameraMode = "chase" | "far" | "hood" | "cinematic"
export const CAMERA_MODES: CameraMode[] = ["chase", "far", "hood", "cinematic"]

export const input = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  boost: false,
  // touch / tilt override the keyboard while they are active
  touchSteer: null as number | null,
  tiltSteer: null as number | null,
}

export const keys = new Set<string>()

export const drive = {
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  speed: 0, // signed forward speed, m/s
  speedAbs: 0,
  vx: 0,
  vz: 0,
  yawRate: 0,
  driftAngle: 0,
  drifting: false,
  airborne: false,
  steerVisual: 0,
  bodyRoll: 0,
  bodyPitch: 0,
  /** chassis roll around the length axis (rad); ±π = on the roof */
  roll: 0,
  flip: "none" as "none" | "upside" | "recover",
  /** air-pressure jets from the wheels: 0 off, 1 building pressure, 2 blast */
  jet: 0,
  /** which wheels fire: bit0 front-left, bit1 front-right, bit2 rear-left, bit3 rear-right */
  jetMask: 15,
  autoLand: false,
  /** world positions / jet directions of the 4 wheels (x,y,z per wheel) */
  wheelPos: new Float32Array(12),
  wheelDir: new Float32Array(12),
  teleport: null as null | { x: number; z: number; heading: number },
  wheelSpin: 0,
  braking: false,
  nitro: 1,
  boosting: false,
  driftCombo: 0,
  driftMultiplier: 1,
  score: 0,
  orbs: 0,
  pickupTime: 0,
  crashTime: 0,
  toast: "",
  toastTime: 0,
  vy: 0,
  bestCombo: 0,
  lastComboBanked: 0,
  lastComboTime: -10,
  shake: 0,
  cameraMode: "chase" as CameraMode,
  lookYaw: 0,
  lookPitch: 0,
  lookActive: false,
  resetRequested: false,
}

/** Showroom pad, on the avenue crossing the drift arena. */
export const SPAWN = { x: 32, z: 30, heading: Math.PI }

export function resetDrive() {
  drive.x = SPAWN.x
  drive.z = SPAWN.z
  drive.y = 0
  drive.heading = SPAWN.heading
  drive.speed = 0
  drive.speedAbs = 0
  drive.vx = 0
  drive.vz = 0
  drive.yawRate = 0
  drive.driftCombo = 0
  drive.drifting = false
  drive.airborne = false
  drive.roll = 0
  drive.flip = "none"
  drive.jet = 0
  drive.jetMask = 0b1111
  drive.autoLand = false
}

export function cycleCamera() {
  const i = CAMERA_MODES.indexOf(drive.cameraMode)
  drive.cameraMode = CAMERA_MODES[(i + 1) % CAMERA_MODES.length]
}

const KEYMAP = {
  throttle: ["w", "z", "arrowup"],
  brake: ["s", "arrowdown"],
  left: ["a", "q", "arrowleft"],
  right: ["d", "arrowright"],
  handbrake: [" "],
  boost: ["shift"],
}

const has = (list: string[]) => list.some((k) => keys.has(k))

/** Polls keyboard + gamepad and merges with touch/tilt into `input`. */
export function pollInput(dt: number) {
  let throttle = has(KEYMAP.throttle) ? 1 : 0
  let brake = has(KEYMAP.brake) ? 1 : 0
  let steerTarget = (has(KEYMAP.left) ? 1 : 0) - (has(KEYMAP.right) ? 1 : 0)
  let handbrake = has(KEYMAP.handbrake)
  let boost = has(KEYMAP.boost)
  let analog = false

  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : []
  for (const pad of pads) {
    if (!pad) continue
    const ax = pad.axes[0] ?? 0
    if (Math.abs(ax) > 0.12) {
      steerTarget = -ax
      analog = true
    }
    throttle = Math.max(throttle, pad.buttons[7]?.value ?? 0)
    brake = Math.max(brake, pad.buttons[6]?.value ?? 0)
    handbrake ||= !!pad.buttons[0]?.pressed || !!pad.buttons[5]?.pressed
    boost ||= !!pad.buttons[2]?.pressed || !!pad.buttons[4]?.pressed
  }

  if (input.tiltSteer !== null) {
    steerTarget = input.tiltSteer
    analog = true
  }
  if (input.touchSteer !== null) {
    steerTarget = input.touchSteer
    analog = true
  }

  // touch buttons write directly into the "touch*" flags below
  throttle = Math.max(throttle, touch.throttle ? 1 : 0)
  brake = Math.max(brake, touch.brake ? 1 : 0)
  handbrake ||= touch.handbrake
  boost ||= touch.boost

  input.throttle = throttle
  input.brake = brake
  input.handbrake = handbrake
  input.boost = boost

  if (analog) {
    input.steer = steerTarget
  } else {
    // smooth digital steering so keyboard feels less twitchy
    const rate = steerTarget === 0 ? 7 : 4.5
    input.steer += (steerTarget - input.steer) * Math.min(1, dt * rate)
    if (Math.abs(input.steer) < 0.001) input.steer = 0
  }
}

export const touch = {
  throttle: false,
  brake: false,
  handbrake: false,
  boost: false,
}

resetDrive()
