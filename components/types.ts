export type BodyStyle = "aero" | "hyper" | "roadster" | "titan"
export type PaintFinish = "gloss" | "metallic" | "matte" | "pearl" | "chrome" | "satin"
export type Livery = "none" | "stripes" | "twotone" | "circuit"
export type SpoilerType = "none" | "lip" | "wing" | "gt"
export type RimStyle = "turbine" | "spoke" | "mesh" | "aero" | "neon"
export type UnderglowMode = "static" | "pulse" | "rainbow"

export type CarConfig = {
  name: string
  bodyStyle: BodyStyle
  bodyColor: string
  accentColor: string
  finish: PaintFinish
  livery: Livery
  windowTint: number

  rimStyle: RimStyle
  wheelColor: string
  caliperColor: string
  wheelSize: number

  spoilerType: SpoilerType
  splitter: boolean
  sideSkirts: boolean
  rideHeight: number

  headlightColor: string
  underglow: boolean
  underglowColor: string
  underglowMode: UnderglowMode
  neonColor: string

  plate: string

  power: number
  grip: number
  driftiness: number
  steering: number
}

export const DEFAULT_CONFIG: CarConfig = {
  name: "Neon Runner",
  bodyStyle: "aero",
  bodyColor: "#0b0f1a",
  accentColor: "#00e5ff",
  finish: "metallic",
  livery: "circuit",
  windowTint: 0.75,

  rimStyle: "turbine",
  wheelColor: "#1c1f26",
  caliperColor: "#00e5ff",
  wheelSize: 1,

  spoilerType: "wing",
  splitter: true,
  sideSkirts: true,
  rideHeight: 0.5,

  headlightColor: "#bff8ff",
  underglow: true,
  underglowColor: "#00e5ff",
  underglowMode: "pulse",
  neonColor: "#00e5ff",

  plate: "NEXUS 01",

  power: 0.6,
  grip: 0.55,
  driftiness: 0.6,
  steering: 0.6,
}

export const PRESETS: CarConfig[] = [
  DEFAULT_CONFIG,
  {
    ...DEFAULT_CONFIG,
    name: "Solar Flare",
    bodyStyle: "hyper",
    bodyColor: "#ff4d00",
    accentColor: "#111111",
    finish: "pearl",
    livery: "stripes",
    rimStyle: "aero",
    wheelColor: "#111111",
    caliperColor: "#ffd000",
    spoilerType: "gt",
    headlightColor: "#fff2c0",
    underglowColor: "#ff6a00",
    underglowMode: "static",
    neonColor: "#ffb000",
    plate: "SOLAR",
    power: 0.85,
    grip: 0.7,
    driftiness: 0.35,
  },
  {
    ...DEFAULT_CONFIG,
    name: "Roadster 2099",
    bodyStyle: "roadster",
    bodyColor: "#c8102e",
    accentColor: "#111111",
    finish: "gloss",
    livery: "none",
    windowTint: 0.85,
    rimStyle: "aero",
    wheelColor: "#1a1b20",
    caliperColor: "#c0c4cc",
    spoilerType: "none",
    splitter: false,
    sideSkirts: false,
    rideHeight: 0.3,
    headlightColor: "#ffffff",
    underglow: false,
    neonColor: "#ff2244",
    plate: "ROADSTER",
    power: 1,
    grip: 0.75,
    driftiness: 0.45,
    steering: 0.7,
  },
  {
    ...DEFAULT_CONFIG,
    name: "Ghost Titan",
    bodyStyle: "titan",
    bodyColor: "#c9ced6",
    accentColor: "#2b2f36",
    finish: "satin",
    livery: "twotone",
    rimStyle: "mesh",
    wheelColor: "#2b2f36",
    caliperColor: "#ff2244",
    spoilerType: "lip",
    headlightColor: "#ffffff",
    underglow: false,
    neonColor: "#ff2244",
    plate: "GHOST",
    power: 0.7,
    grip: 0.5,
    driftiness: 0.5,
  },
  {
    ...DEFAULT_CONFIG,
    name: "Vapor Drift",
    bodyStyle: "aero",
    bodyColor: "#7a1cff",
    accentColor: "#ff2bd6",
    finish: "chrome",
    livery: "circuit",
    rimStyle: "neon",
    wheelColor: "#0d0d12",
    caliperColor: "#ff2bd6",
    spoilerType: "gt",
    headlightColor: "#ff9cf2",
    underglowColor: "#ff2bd6",
    underglowMode: "rainbow",
    neonColor: "#ff2bd6",
    plate: "DRIFT",
    power: 0.65,
    grip: 0.35,
    driftiness: 0.9,
    steering: 0.75,
  },
]

export const FINISHES: Record<
  PaintFinish,
  { metalness: number; roughness: number; clearcoat: number; iridescence: number }
> = {
  gloss: { metalness: 0.15, roughness: 0.25, clearcoat: 1, iridescence: 0 },
  metallic: { metalness: 0.75, roughness: 0.3, clearcoat: 1, iridescence: 0 },
  matte: { metalness: 0.1, roughness: 0.85, clearcoat: 0, iridescence: 0 },
  pearl: { metalness: 0.4, roughness: 0.25, clearcoat: 1, iridescence: 1 },
  chrome: { metalness: 1, roughness: 0.06, clearcoat: 0.5, iridescence: 0 },
  satin: { metalness: 0.55, roughness: 0.55, clearcoat: 0.3, iridescence: 0 },
}

/** Physical tuning derived from the 0..1 sliders. */
export function getPerformance(config: CarConfig) {
  const topSpeed = 52 + config.power * 34 // m/s
  const accel = 14 + config.power * 16 // m/s²
  const grip = 6 + config.grip * 10 // lateral grip (1/s)
  const driftGrip = 2.6 - config.driftiness * 1.9 // grip while handbraking
  const turnRate = 1.7 + config.steering * 1.3 // rad/s
  return { topSpeed, accel, grip, driftGrip, turnRate }
}
