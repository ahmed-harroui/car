"use client"

import { useEffect, useRef, useState } from "react"
import { Smartphone } from "lucide-react"
import { input, touch } from "./drive-store"

type TouchKey = keyof typeof touch

function HoldButton({
  k,
  label,
  sub,
  className,
}: {
  k: TouchKey
  label: string
  sub?: string
  className: string
}) {
  const [down, setDown] = useState(false)
  const set = (v: boolean) => {
    touch[k] = v
    setDown(v)
    if (v && navigator.vibrate) navigator.vibrate(8)
  }
  useEffect(() => () => void (touch[k] = false), [k])
  return (
    <button
      className={`pointer-events-auto touch-none select-none rounded-2xl border-2 font-mono font-bold backdrop-blur-md transition-transform flex flex-col items-center justify-center leading-none ${className} ${
        down ? "scale-95 brightness-150" : ""
      }`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        e.stopPropagation()
        set(true)
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{label}</span>
      {sub && <span className="mt-1 text-[9px] font-normal opacity-70">{sub}</span>}
    </button>
  )
}

function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const origin = useRef<{ x: number; id: number } | null>(null)

  const move = (clientX: number) => {
    const base = baseRef.current
    if (!base || !origin.current) return
    const max = base.offsetWidth / 2 - 18
    const dx = Math.max(-max, Math.min(max, clientX - origin.current.x))
    if (knobRef.current) knobRef.current.style.transform = `translateX(${dx}px)`
    const v = dx / max
    // small dead-zone + slight curve for precision
    const dz = Math.abs(v) < 0.06 ? 0 : Math.sign(v) * Math.pow((Math.abs(v) - 0.06) / 0.94, 1.3)
    input.touchSteer = -dz
  }
  const end = () => {
    origin.current = null
    input.touchSteer = null
    if (knobRef.current) knobRef.current.style.transform = "translateX(0px)"
  }
  useEffect(() => end, [])

  return (
    <div
      ref={baseRef}
      className="pointer-events-auto touch-none relative h-[96px] w-[160px] landscape:h-[110px] landscape:w-[230px] rounded-full border-2 border-cyan-400/40 bg-black/35 backdrop-blur-md"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        e.stopPropagation()
        const rect = e.currentTarget.getBoundingClientRect()
        origin.current = { x: rect.left + rect.width / 2, id: e.pointerId }
        move(e.clientX)
      }}
      onPointerMove={(e) => origin.current?.id === e.pointerId && move(e.clientX)}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <div className="absolute inset-y-0 left-4 flex items-center text-cyan-300/60 text-xl">‹</div>
      <div className="absolute inset-y-0 right-4 flex items-center text-cyan-300/60 text-xl">›</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          ref={knobRef}
          className="h-[56px] w-[56px] landscape:h-[64px] landscape:w-[64px] rounded-full border-2 border-cyan-300 bg-cyan-400/30 shadow-[0_0_24px_rgba(0,229,255,0.6)]"
        />
      </div>
    </div>
  )
}

export function MobileControls() {
  const [tilt, setTilt] = useState(false)

  useEffect(() => {
    if (!tilt) {
      input.tiltSteer = null
      return
    }
    const handler = (e: DeviceOrientationEvent) => {
      const angle = (screen.orientation?.angle ?? (window as any).orientation ?? 0) as number
      let raw = 0
      if (angle === 90) raw = -(e.beta ?? 0)
      else if (angle === 270 || angle === -90) raw = e.beta ?? 0
      else raw = -(e.gamma ?? 0)
      const v = Math.max(-1, Math.min(1, raw / 28))
      input.tiltSteer = Math.abs(v) < 0.05 ? 0 : v
    }
    window.addEventListener("deviceorientation", handler)
    return () => {
      window.removeEventListener("deviceorientation", handler)
      input.tiltSteer = null
    }
  }, [tilt])

  const toggleTilt = async () => {
    if (!tilt) {
      const DOE = (window as any).DeviceOrientationEvent
      if (DOE && typeof DOE.requestPermission === "function") {
        try {
          if ((await DOE.requestPermission()) !== "granted") return
        } catch {
          return
        }
      }
    }
    setTilt((t) => !t)
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex items-end justify-between gap-3 px-4 pb-[max(16px,env(safe-area-inset-bottom))] landscape:px-6 pointer-events-none">
      <div className="flex flex-col items-start gap-2">
        <button
          onClick={toggleTilt}
          className={`pointer-events-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] backdrop-blur-md ${
            tilt ? "border-fuchsia-400 bg-fuchsia-500/30 text-fuchsia-100" : "border-white/20 bg-black/40 text-white/70"
          }`}
        >
          <Smartphone className="h-3 w-3" />
          {tilt ? "TILT ON" : "TILT STEER"}
        </button>
        {!tilt && <Joystick />}
      </div>

      <div className="grid shrink-0 grid-cols-[62px_74px] grid-rows-[56px_76px] gap-2 landscape:grid-cols-[70px_84px] landscape:grid-rows-[60px_84px] landscape:gap-2.5">
        <HoldButton
          k="boost"
          label="N₂O"
          sub="NITRO"
          className="border-sky-400 bg-sky-500/25 text-sky-100 text-base shadow-[0_0_18px_rgba(56,189,248,0.4)]"
        />
        <HoldButton
          k="handbrake"
          label="DRIFT"
          sub="HANDBRAKE"
          className="border-fuchsia-400 bg-fuchsia-500/25 text-fuchsia-100 text-sm shadow-[0_0_18px_rgba(255,43,214,0.4)]"
        />
        <HoldButton k="brake" label="BRAKE" sub="REVERSE" className="border-red-400 bg-red-500/25 text-red-100 text-xs" />
        <HoldButton
          k="throttle"
          label="GAS"
          className="border-emerald-400 bg-emerald-500/25 text-emerald-100 text-lg shadow-[0_0_22px_rgba(0,255,156,0.45)]"
        />
      </div>
    </div>
  )
}
