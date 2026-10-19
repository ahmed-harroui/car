"use client"

import { useEffect, useRef } from "react"
import { Camera, Flag, RotateCcw, X } from "lucide-react"
import { CITY, LOOPS, TRACK_AREA, TRACK_START, WORLD_LIMIT } from "./world/city-layout"
import { orbRespawn } from "./world/city"
import { cycleCamera, drive } from "./drive-store"

const GEARS = [0, 11, 21, 32, 44, 57, 71, 999]
const CAMERA_LABEL = { chase: "CHASE", far: "FAR CHASE", hood: "BUMPER", cinematic: "CINEMATIC" } as const

function buildMinimap() {
  const L = WORLD_LIMIT
  const c = document.createElement("canvas")
  c.width = c.height = L * 2
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#0b1020"
  ctx.fillRect(0, 0, L * 2, L * 2)
  for (const b of CITY.blocks) {
    const s = 48
    ctx.fillStyle = b.kind === "park" ? "#0c3a32" : b.kind === "plaza" ? "#1a0b2e" : "#141a2c"
    ctx.fillRect(b.x + L - s / 2, b.z + L - s / 2, s, s)
  }
  ctx.fillStyle = "#1a0b2e"
  ctx.fillRect(L - 88, L - 88, 176, 176)
  ctx.fillStyle = "#2c3a63"
  for (const t of CITY.towers) ctx.fillRect(t.x - t.w / 2 + L, t.z - t.d / 2 + L, t.w, t.d)
  ctx.fillStyle = "#1c1406"
  ctx.fillRect(TRACK_AREA.x0 + L, TRACK_AREA.z0 + L, TRACK_AREA.x1 - TRACK_AREA.x0, TRACK_AREA.z1 - TRACK_AREA.z0)
  const SURF = { ramp: "#ffb000", plateau: "#ff8a00", bank: "#7a5cff", kicker: "#ff2244" }
  ctx.fillStyle = "#ff6a00"
  for (const l of LOOPS) {
    ctx.save()
    ctx.translate(l.x + L, l.z + L)
    ctx.rotate(-l.rot)
    ctx.fillRect(-l.w / 2, -l.R, l.shift + l.w, l.R * 2)
    ctx.restore()
  }
  for (const r of CITY.surfaces) {
    ctx.fillStyle = SURF[r.type]
    ctx.save()
    ctx.translate(r.x + L, r.z + L)
    ctx.rotate(-r.rot)
    ctx.fillRect(-r.w / 2, -r.len / 2, r.w, r.len)
    ctx.restore()
  }
  ctx.strokeStyle = "#00e5ff"
  ctx.lineWidth = 3
  ctx.strokeRect(1.5, 1.5, L * 2 - 3, L * 2 - 3)
  return c
}

export function Hud({ onExit, isTouch }: { onExit: () => void; isTouch: boolean }) {
  const speedRef = useRef<HTMLSpanElement>(null)
  const gearRef = useRef<HTMLSpanElement>(null)
  const arcRef = useRef<SVGCircleElement>(null)
  const nitroRef = useRef<HTMLDivElement>(null)
  const scoreRef = useRef<HTMLSpanElement>(null)
  const orbsRef = useRef<HTMLSpanElement>(null)
  const driftRef = useRef<HTMLDivElement>(null)
  const driftValRef = useRef<HTMLSpanElement>(null)
  const driftMultRef = useRef<HTMLSpanElement>(null)
  const bankRef = useRef<HTMLDivElement>(null)
  const toastRef = useRef<HTMLDivElement>(null)
  const camRef = useRef<HTMLSpanElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const staticMap = buildMinimap()
    const L = WORLD_LIMIT
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const now = performance.now()
      const kmh = Math.round(drive.speedAbs * 3.6)
      if (speedRef.current) speedRef.current.textContent = String(kmh).padStart(3, "0")
      let gear = 1
      while (gear < GEARS.length - 1 && drive.speedAbs > GEARS[gear]) gear++
      const lo = GEARS[gear - 1]
      const hi = GEARS[gear] === 999 ? 95 : GEARS[gear]
      const rpm = drive.speedAbs < 0.3 ? 0.08 : Math.min(1, 0.25 + ((drive.speedAbs - lo) / (hi - lo)) * 0.75)
      if (gearRef.current) gearRef.current.textContent = drive.speed < -0.5 ? "R" : drive.speedAbs < 0.3 ? "N" : String(gear)
      if (arcRef.current) {
        arcRef.current.style.strokeDasharray = `${(245 * rpm).toFixed(1)} 999`
        arcRef.current.style.stroke = rpm > 0.88 ? "#ff2bd6" : "#00e5ff"
      }
      if (nitroRef.current) {
        nitroRef.current.style.width = `${drive.nitro * 100}%`
        nitroRef.current.style.opacity = drive.boosting ? "1" : "0.8"
      }
      if (scoreRef.current) scoreRef.current.textContent = drive.score.toLocaleString("en-US")
      if (orbsRef.current) orbsRef.current.textContent = String(drive.orbs)
      if (camRef.current) camRef.current.textContent = CAMERA_LABEL[drive.cameraMode]

      if (driftRef.current) {
        const show = drive.driftCombo > 0
        driftRef.current.style.opacity = show ? "1" : "0"
        driftRef.current.style.transform = `translateX(-50%) scale(${show ? 1 + Math.min(0.25, drive.driftAngle * 0.3) : 0.8})`
        if (driftValRef.current) driftValRef.current.textContent = Math.round(drive.driftCombo).toLocaleString("en-US")
        if (driftMultRef.current) driftMultRef.current.textContent = `×${drive.driftMultiplier}`
      }
      if (bankRef.current) {
        const age = (now - drive.lastComboTime) / 1000
        bankRef.current.style.opacity = age < 1.6 ? String(1 - age / 1.6) : "0"
        bankRef.current.style.transform = `translateX(-50%) translateY(${-age * 30}px)`
        bankRef.current.textContent = `+${drive.lastComboBanked.toLocaleString("en-US")} DRIFT`
      }
      if (toastRef.current) {
        const age = (now - drive.toastTime) / 1000
        const pick = (now - drive.pickupTime) / 1000
        const text = pick < age ? "+250 ENERGY · NITRO" : drive.toast
        const a = Math.min(age, pick)
        toastRef.current.textContent = text
        toastRef.current.style.opacity = a < 1.8 ? String(Math.min(1, (1.8 - a) * 2)) : "0"
      }

      // minimap
      const canvas = mapRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")!
        const S = canvas.width
        const R = S / 2
        ctx.clearRect(0, 0, S, S)
        ctx.save()
        ctx.beginPath()
        ctx.arc(R, R, R - 2, 0, Math.PI * 2)
        ctx.clip()
        ctx.fillStyle = "#05070e"
        ctx.fillRect(0, 0, S, S)
        ctx.translate(R, R)
        ctx.rotate(drive.heading + Math.PI)
        const zoom = (S / 150) * (1.15 - Math.min(0.5, drive.speedAbs / 160))
        ctx.scale(zoom, zoom)
        ctx.translate(-(drive.x + L), -(drive.z + L))
        ctx.drawImage(staticMap, 0, 0)
        ctx.fillStyle = "#00ff9c"
        CITY.orbs.forEach((o, i) => {
          if (orbRespawn[i]) return
          ctx.beginPath()
          ctx.arc(o.x + L, o.z + L, 3.2, 0, Math.PI * 2)
          ctx.fill()
        })
        ctx.restore()
        // player arrow
        ctx.fillStyle = "#ffffff"
        ctx.shadowColor = "#00e5ff"
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(R, R - 8)
        ctx.lineTo(R + 6, R + 7)
        ctx.lineTo(R, R + 3)
        ctx.lineTo(R - 6, R + 7)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle = "rgba(0,229,255,0.7)"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(R, R, R - 2, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  const btn =
    "pointer-events-auto flex items-center justify-center rounded-xl border border-cyan-400/40 bg-black/50 backdrop-blur-md text-cyan-200 hover:bg-cyan-400/20 active:scale-95 transition"

  return (
    <div className="absolute inset-0 z-30 pointer-events-none select-none font-mono">
      {/* score */}
      <div className="absolute left-3 top-3 md:left-5 md:top-5 rounded-xl border border-cyan-400/30 bg-black/45 backdrop-blur-md px-3 py-2 md:px-4 md:py-3">
        <div className="text-[9px] md:text-[10px] tracking-[0.3em] text-cyan-300/70">NEO KYRA · FREE ROAM</div>
        <div className="flex items-baseline gap-2">
          <span ref={scoreRef} className="text-lg md:text-2xl font-bold text-white tabular-nums">
            0
          </span>
          <span className="text-[10px] text-cyan-300/70">PTS</span>
        </div>
        <div className="text-[10px] md:text-xs text-emerald-300">
          ◆ <span ref={orbsRef}>0</span> energy
        </div>
      </div>

      {/* top-right: minimap + buttons */}
      <div className="absolute right-3 top-3 md:right-5 md:top-5 flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button
            className={`${btn} h-10 px-3 gap-1.5 text-xs border-amber-400/50 text-amber-200 hover:bg-amber-400/20`}
            onClick={() => (drive.teleport = { ...TRACK_START })}
            title="Teleport to the test track (T)"
          >
            <Flag className="h-4 w-4" />
            <span className="hidden sm:inline">TEST TRACK</span>
          </button>
          <button className={`${btn} h-10 px-3 gap-1.5 text-xs`} onClick={cycleCamera} title="Camera (C)">
            <Camera className="h-4 w-4" />
            <span ref={camRef} className="hidden sm:inline">
              CHASE
            </span>
          </button>
          <button className={`${btn} h-10 w-10`} onClick={() => (drive.resetRequested = true)} title="Reset (R)">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            className={`${btn} h-10 w-10 border-red-400/50 text-red-300 hover:bg-red-500/20`}
            onClick={onExit}
            title="Back to garage (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <canvas
          ref={mapRef}
          width={300}
          height={300}
          className={`${isTouch ? "h-[92px] w-[92px] landscape:h-[110px] landscape:w-[110px]" : "h-[150px] w-[150px]"} rounded-full`}
        />
      </div>

      {/* drift combo */}
      <div
        ref={driftRef}
        className="absolute left-1/2 top-[14%] md:top-[12%] text-center transition-[opacity,transform] duration-150"
        style={{ opacity: 0, transform: "translateX(-50%)" }}
      >
        <div className="text-[10px] md:text-xs tracking-[0.5em] text-fuchsia-300">DRIFT</div>
        <div className="flex items-baseline justify-center gap-2">
          <span
            ref={driftValRef}
            className="text-3xl md:text-5xl font-black text-white tabular-nums"
            style={{ textShadow: "0 0 18px #ff2bd6, 0 0 40px #ff2bd6" }}
          />
          <span ref={driftMultRef} className="text-xl md:text-2xl font-bold text-cyan-300" />
        </div>
      </div>
      <div
        ref={bankRef}
        className="absolute left-1/2 top-[24%] text-lg md:text-2xl font-bold text-emerald-300"
        style={{ opacity: 0, textShadow: "0 0 14px #00ff9c" }}
      />
      <div
        ref={toastRef}
        className="absolute left-1/2 top-[32%] -translate-x-1/2 whitespace-nowrap rounded-full border border-cyan-300/30 bg-black/50 px-4 py-1.5 text-xs md:text-sm font-bold tracking-widest text-cyan-100 backdrop-blur"
        style={{ opacity: 0 }}
      />

      {/* speedometer */}
      <div
        className={
          isTouch
            ? "absolute left-1 top-[92px] scale-[0.62] origin-top-left landscape:left-1/2 landscape:top-auto landscape:bottom-3 landscape:-translate-x-1/2 landscape:scale-[0.72] landscape:origin-bottom"
            : "absolute left-1/2 -translate-x-1/2 bottom-5"
        }
      >
        <div className="relative h-[130px] w-[150px]">
          <svg viewBox="0 0 130 130" className="absolute inset-0 h-full w-full -rotate-[225deg]">
            <circle cx="65" cy="65" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeDasharray="245 999" />
            <circle
              ref={arcRef}
              cx="65"
              cy="65"
              r="52"
              fill="none"
              stroke="#00e5ff"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="0 999"
              style={{ filter: "drop-shadow(0 0 6px currentColor)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
            <span ref={speedRef} className="text-4xl font-black text-white tabular-nums" style={{ textShadow: "0 0 12px #00e5ff" }}>
              000
            </span>
            <span className="text-[10px] tracking-[0.3em] text-cyan-300/80">KM/H</span>
            <span ref={gearRef} className="mt-0.5 text-lg font-bold text-fuchsia-300">
              N
            </span>
          </div>
        </div>
        <div className="mx-auto -mt-2 w-[150px]">
          <div className="mb-1 flex justify-between text-[9px] tracking-widest text-cyan-300/70">
            <span>NITRO</span>
            <span>{isTouch ? "" : "SHIFT"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              ref={nitroRef}
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500"
              style={{ width: "100%", boxShadow: "0 0 10px #00e5ff" }}
            />
          </div>
        </div>
      </div>

      {/* keyboard hints */}
      {!isTouch && (
        <div className="absolute bottom-5 left-5 hidden md:grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[11px] text-white/70 backdrop-blur">
          {[
            ["W / ↑", "Throttle"],
            ["S / ↓", "Brake · Reverse"],
            ["A D / ← →", "Steer"],
            ["SPACE", "Handbrake · Drift"],
            ["SHIFT", "Nitro"],
            ["C", "Camera"],
            ["R", "Reset"],
            ["T", "Test track"],
            ["Drag", "Look around"],
          ].map(([k, v]) => (
            <div key={k} className="contents">
              <span className="font-bold text-cyan-300">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
