/**
 * Deterministic procedural layout for the open-world city "Neo Kyra".
 * Everything (rendering, collisions, minimap) is derived from this data.
 */

export const BLOCK = 64 // distance between road centerlines
export const ROAD = 16 // road width
export const GRID = 4 // blocks from center to edge (=> 9x9 blocks)
export const HALF = (GRID + 0.5) * BLOCK // 288: outermost road centerline
export const WORLD_LIMIT = HALF + 14 // drivable area half-size

export type Box = { x0: number; z0: number; x1: number; z1: number }
export type Tower = {
  x: number
  z: number
  w: number
  d: number
  h: number
  tint: [number, number, number]
  neon: number // index into NEON_COLORS, -1 = none
  crown: boolean
  tierH: number // second (set-back) tier height, 0 = none
}
export type Tree = { x: number; z: number; s: number; hue: number }
/**
 * Drivable relief. In local space the surface spans lx ∈ [-w/2, w/2], lz ∈ [-len/2, len/2]
 * and is rotated by `rot` around Y.
 * - ramp: rises linearly along +lz up to h
 * - plateau: flat top at h
 * - bank: road tilted sideways (high at +lx), eased in/out at both ends
 * - kicker: rises along +lz on one side only, launches the car into a roll
 */
/**
 * Vertical loop. Entry at local origin heading +lz; the path is a circle of radius R in the
 * lz/y plane that drifts sideways by `shift` so the exit lane sits beside the entry lane.
 */
export type Loop = {
  x: number
  z: number
  rot: number
  R: number
  w: number
  shift: number
  /** 2π = full loop; π = half-pipe that launches the car upside down from the top */
  arc: number
  label: string
}

export function loopPoint(l: Loop, theta: number) {
  return {
    lx: (l.shift * theta) / l.arc,
    y: l.R * (1 - Math.cos(theta)),
    lz: l.R * Math.sin(theta),
  }
}

export function localToWorld(o: { x: number; z: number; rot: number }, lx: number, lz: number) {
  const c = Math.cos(o.rot)
  const s = Math.sin(o.rot)
  return { x: o.x + lx * c + lz * s, z: o.z - lx * s + lz * c }
}

export function worldToLocal(o: { x: number; z: number; rot: number }, x: number, z: number) {
  const dx = x - o.x
  const dz = z - o.z
  const c = Math.cos(o.rot)
  const s = Math.sin(o.rot)
  return { lx: dx * c - dz * s, lz: dx * s + dz * c }
}

export const LOOPS: Loop[] = [
  { x: 162, z: -150, rot: Math.PI, R: 9, w: 6, shift: 6.5, arc: Math.PI * 2, label: "LOOP · 120 KM/H MIN" },
  { x: 228, z: -200, rot: Math.PI, R: 7, w: 7, shift: 0, arc: Math.PI, label: "HALF-PIPE LAUNCH · 105 KM/H" },
]

export type SurfaceType = "ramp" | "plateau" | "bank" | "kicker"
export type Surface = { type: SurfaceType; x: number; z: number; rot: number; w: number; len: number; h: number }
export type Cone = { x: number; z: number }
export type Orb = { x: number; z: number; y: number }
export type Billboard = { x: number; y: number; z: number; rot: number; w: number; h: number; text: string; color: string }

export const NEON_COLORS = ["#00e5ff", "#ff2bd6", "#7a5cff", "#ffb000", "#00ff9c"]
const BILLBOARD_TEXT = ["NEXUS", "NEO KYRA", "2099", "HYPERION", "VOLT", "SYNTH", "ORBITAL", "KAIJU", "AETHER", "DRIFT CITY"]

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type BlockKind = "plaza" | "park" | "city" | "track"

/** The test track occupies the south-east 3x3 blocks. */
export const TRACK_AREA = { x0: 2 * BLOCK - 24, x1: GRID * BLOCK + 24, z0: -GRID * BLOCK - 24, z1: -2 * BLOCK + 24 }
export const inTrackArea = (x: number, z: number) =>
  x > TRACK_AREA.x0 && x < TRACK_AREA.x1 && z > TRACK_AREA.z0 && z < TRACK_AREA.z1
export const TRACK_START = { x: 128, z: -100, heading: Math.PI }

function blockKind(i: number, j: number, rnd: () => number): BlockKind {
  if (Math.abs(i) <= 1 && Math.abs(j) <= 1) return "plaza"
  if (i >= 2 && j <= -2) return "track"
  return rnd() < 0.12 ? "park" : "city"
}

function buildLayout() {
  const rnd = mulberry32(2099)
  const towers: Tower[] = []
  const trees: Tree[] = []
  const blocks: { x: number; z: number; kind: BlockKind }[] = []
  const billboards: Billboard[] = []
  const inner = BLOCK - ROAD // 48

  for (let i = -GRID; i <= GRID; i++) {
    for (let j = -GRID; j <= GRID; j++) {
      const cx = i * BLOCK
      const cz = j * BLOCK
      const kind = blockKind(i, j, rnd)
      blocks.push({ x: cx, z: cz, kind })

      if (kind === "park") {
        const n = 10 + Math.floor(rnd() * 8)
        for (let t = 0; t < n; t++) {
          trees.push({
            x: cx + (rnd() - 0.5) * (inner - 8),
            z: cz + (rnd() - 0.5) * (inner - 8),
            s: 0.8 + rnd() * 0.8,
            hue: rnd(),
          })
        }
        continue
      }
      if (kind !== "city") continue

      // downtown towers are taller
      const dist = Math.hypot(i, j)
      const heightScale = Math.max(0.35, 1.5 - dist * 0.22)
      const split = rnd()
      const lots: { x: number; z: number; s: number }[] = []
      if (split < 0.3) {
        lots.push({ x: cx, z: cz, s: inner })
      } else if (split < 0.6) {
        const s = inner / 2
        lots.push({ x: cx - s / 2, z: cz, s }, { x: cx + s / 2, z: cz, s })
      } else {
        const s = inner / 2
        for (const ox of [-1, 1]) for (const oz of [-1, 1]) lots.push({ x: cx + (ox * s) / 2, z: cz + (oz * s) / 2, s })
      }

      for (const lot of lots) {
        const margin = 3 + rnd() * 3
        const w = lot.s - margin * 2 - (lots.length === 2 ? rnd() * 4 : 0)
        const d = lot.s - margin * 2 - rnd() * 6
        const h = (14 + rnd() * rnd() * 110) * heightScale + 8
        const shade = 0.05 + rnd() * 0.06
        const blue = shade + 0.02 + rnd() * 0.04
        const tower: Tower = {
          x: lot.x,
          z: lot.z,
          w: Math.max(8, w),
          d: Math.max(8, d),
          h,
          tint: [shade, shade + 0.01, blue],
          neon: rnd() < 0.55 ? Math.floor(rnd() * NEON_COLORS.length) : -1,
          crown: h > 60 && rnd() < 0.6,
          tierH: h > 40 && rnd() < 0.45 ? 8 + rnd() * 25 : 0,
        }
        towers.push(tower)

        if (h > 30 && rnd() < 0.28) {
          const face = Math.floor(rnd() * 4)
          const bw = Math.min(tower.w, tower.d) * 0.7
          const bh = bw * 0.45
          const by = h * (0.55 + rnd() * 0.3)
          const off = 0.3
          const pos = [
            { x: tower.x, z: tower.z + tower.d / 2 + off, rot: 0 },
            { x: tower.x + tower.w / 2 + off, z: tower.z, rot: Math.PI / 2 },
            { x: tower.x, z: tower.z - tower.d / 2 - off, rot: Math.PI },
            { x: tower.x - tower.w / 2 - off, z: tower.z, rot: -Math.PI / 2 },
          ][face]
          billboards.push({
            ...pos,
            y: by,
            w: bw,
            h: bh,
            text: BILLBOARD_TEXT[Math.floor(rnd() * BILLBOARD_TEXT.length)],
            color: NEON_COLORS[Math.floor(rnd() * NEON_COLORS.length)],
          })
        }
      }
    }
  }

  const surfaces: Surface[] = [
    // drift arena jumps
    { type: "ramp", x: -60, z: -40, rot: 0, w: 9, len: 16, h: 3.2 },
    { type: "ramp", x: 60, z: 40, rot: Math.PI, w: 9, len: 16, h: 3.2 },
    { type: "ramp", x: 55, z: -55, rot: Math.PI / 2, w: 8, len: 12, h: 2 },
    { type: "ramp", x: -55, z: 60, rot: -Math.PI / 2, w: 12, len: 22, h: 5 },

    // --- test track ---
    // hill road: 14° climb, elevated straight, descent
    { type: "ramp", x: 128, z: -140, rot: Math.PI, w: 12, len: 40, h: 10 },
    { type: "plateau", x: 128, z: -178, rot: 0, w: 12, len: 36, h: 10 },
    { type: "ramp", x: 128, z: -216, rot: 0, w: 12, len: 40, h: 10 },
    // long banked straight (~27°) and a steep wall-ride (~39°)
    { type: "bank", x: 258, z: -190, rot: 0, w: 14, len: 130, h: 7 },
    { type: "bank", x: 196, z: -150, rot: Math.PI, w: 10, len: 70, h: 8 },
    // flip zone: one-sided kickers that throw the car into a barrel roll
    { type: "kicker", x: 196, z: -236, rot: Math.PI, w: 4.5, len: 8, h: 1.8 },
    { type: "kicker", x: 160, z: -262, rot: Math.PI / 2, w: 4.5, len: 8, h: 1.8 },
    // big launch ramp
    { type: "ramp", x: 230, z: -265, rot: Math.PI / 2, w: 10, len: 20, h: 4.5 },
  ]

  const cones: Cone[] = []
  // slalom line
  for (let k = 0; k < 10; k++) cones.push({ x: -30 + k * 7, z: 52 })
  // donut circle
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2
    cones.push({ x: 40 + Math.cos(a) * 11, z: -20 + Math.sin(a) * 11 })
  }
  // gate rows
  for (let k = 0; k < 6; k++) {
    cones.push({ x: -45, z: -10 + k * 6 }, { x: -38, z: -10 + k * 6 })
  }

  // energy orbs on road intersections / avenues
  const orbs: Orb[] = []
  for (let k = 0; k < 36; k++) {
    const lineA = (Math.floor(rnd() * (GRID * 2 + 2)) - GRID - 1 + 0.5) * BLOCK
    const along = (rnd() - 0.5) * 2 * (HALF - 10)
    const onX = rnd() < 0.5
    orbs.push({ x: onX ? lineA : along, z: onX ? along : lineA, y: 1.6 })
  }

  const colliders: Box[] = towers.map((t) => ({
    x0: t.x - t.w / 2,
    z0: t.z - t.d / 2,
    x1: t.x + t.w / 2,
    z1: t.z + t.d / 2,
  }))
  for (const tr of trees) {
    const r = 0.6 * tr.s
    colliders.push({ x0: tr.x - r, z0: tr.z - r, x1: tr.x + r, z1: tr.z + r })
  }

  return { towers, trees, blocks, billboards, surfaces, cones, orbs, colliders }
}

export const CITY = buildLayout()

/** Road centerlines (both axes share the same offsets). */
export const ROAD_LINES: number[] = []
for (let k = -GRID - 1; k <= GRID; k++) ROAD_LINES.push((k + 0.5) * BLOCK)

// ---------- spatial hash for collisions ----------
const CELL = 32
const grid = new Map<string, number[]>()
CITY.colliders.forEach((b, idx) => {
  for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++) {
    for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
      const key = `${cx},${cz}`
      const list = grid.get(key)
      if (list) list.push(idx)
      else grid.set(key, [idx])
    }
  }
})

const seen = new Set<number>()
/** Calls fn for every collider near (x, z). */
export function forNearbyColliders(x: number, z: number, r: number, fn: (b: Box) => void) {
  seen.clear()
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      const list = grid.get(`${cx},${cz}`)
      if (!list) continue
      for (const idx of list) {
        if (seen.has(idx)) continue
        seen.add(idx)
        fn(CITY.colliders[idx])
      }
    }
  }
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Height of a surface at local coordinates (no bounds check). */
export function surfaceHeightLocal(s: Surface, lx: number, lz: number) {
  const u = (lz + s.len / 2) / s.len // 0..1 along the surface
  const v = (lx + s.w / 2) / s.w // 0..1 across
  switch (s.type) {
    case "ramp":
      return u * s.h
    case "plateau":
      return s.h
    case "bank":
      return s.h * v * smooth(Math.min(1, u / 0.2, (1 - u) / 0.2))
    case "kicker":
      return s.h * u * v
  }
}

/** Ground height at a world point, and the surface providing it. */
export function groundAt(x: number, z: number): { h: number; surf: Surface | null } {
  let best = 0
  let surf: Surface | null = null
  for (const s of CITY.surfaces) {
    const dx = x - s.x
    const dz = z - s.z
    const c = Math.cos(-s.rot)
    const sn = Math.sin(-s.rot)
    const lx = dx * c + dz * sn
    const lz = -dx * sn + dz * c
    if (Math.abs(lx) <= s.w / 2 && Math.abs(lz) <= s.len / 2) {
      const h = surfaceHeightLocal(s, lx, lz)
      if (h >= best) {
        best = h
        surf = s
      }
    }
  }
  return { h: best, surf }
}
