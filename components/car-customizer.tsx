"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { DEFAULT_CONFIG, type CarConfig } from "./types"
import { CustomizationPanel } from "./customization-panel"
import { MobileControls } from "./mobile-controls"
import { Hud } from "./hud"
import { cycleCamera, drive, keys } from "./drive-store"
import type { Quality } from "./car-scene"
import { TRACK_START } from "./world/city-layout"

const CarSceneDynamic = dynamic(() => import("./car-scene").then((mod) => mod.CarScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#05030c]">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      <div className="font-mono text-xs tracking-[0.4em] text-cyan-300">BUILDING NEO KYRA</div>
    </div>
  ),
})

const STORAGE = { config: "nexus.config.v2", garage: "nexus.garage.v2", quality: "nexus.quality" }

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...(fallback as object), ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function CarCustomizer() {
  const [mounted, setMounted] = useState(false)
  const [config, setConfig] = useState<CarConfig>(DEFAULT_CONFIG)
  const [garage, setGarage] = useState<CarConfig[]>([])
  const [isDriving, setIsDriving] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [quality, setQuality] = useState<Quality>("high")
  const [isTouch, setIsTouch] = useState(false)
  const [rotateHint, setRotateHint] = useState(true)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)

  useEffect(() => {
    setConfig(load(STORAGE.config, DEFAULT_CONFIG))
    try {
      const g = JSON.parse(localStorage.getItem(STORAGE.garage) || "[]")
      if (Array.isArray(g)) setGarage(g.map((c) => ({ ...DEFAULT_CONFIG, ...c })))
    } catch {}
    const touchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1
    setIsTouch(touchDevice)
    const storedQ = (() => {
      try {
        return localStorage.getItem(STORAGE.quality) as Quality | null
      } catch {
        return null
      }
    })()
    const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 600
    setQuality(storedQ ?? (touchDevice && smallScreen ? "low" : "high"))
    // ?debug exposes live driving state for testing in the browser console
    if (new URLSearchParams(location.search).has("debug")) (window as any).__nexus = { drive }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) save(STORAGE.config, config)
  }, [config, mounted])

  const update = useCallback((patch: Partial<CarConfig>) => setConfig((c) => ({ ...c, ...patch })), [])

  const changeQuality = (q: Quality) => {
    setQuality(q)
    try {
      localStorage.setItem(STORAGE.quality, q)
    } catch {}
  }

  const startDrive = () => {
    setIsDriving(true)
    drive.cameraMode = "chase"
  }
  const stopDrive = useCallback(() => {
    setIsDriving(false)
    keys.clear()
  }, [])

  // keyboard
  useEffect(() => {
    if (!isDriving) return
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault()
      if (e.repeat) return
      keys.add(k)
      if (k === "c") cycleCamera()
      if (k === "r") drive.resetRequested = true
      if (k === "t") drive.teleport = { ...TRACK_START }
      if (k === "escape") stopDrive()
    }
    const up = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
    const blur = () => keys.clear()
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
      keys.clear()
    }
  }, [isDriving, stopDrive])

  // drag to look around while driving (mouse or a free finger)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isDriving || drag.current) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    drive.lookActive = true
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drive.lookYaw = Math.max(-Math.PI, Math.min(Math.PI, drive.lookYaw - (e.clientX - d.x) * 0.006))
    drive.lookPitch = Math.max(-0.25, Math.min(0.9, drive.lookPitch + (e.clientY - d.y) * 0.004))
    d.x = e.clientX
    d.y = e.clientY
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    drive.lookActive = false
  }

  if (!mounted) return <div className="h-[100dvh] w-full bg-[#05030c]" />

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#05030c] text-white landscape:flex-row">
      <div
        className="relative min-h-0 flex-1"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <CarSceneDynamic config={config} isDriving={isDriving} quality={quality} />

        {!isDriving && (
          <div className="pointer-events-none absolute left-0 top-0 p-4 md:p-6">
            <h1
              className="text-2xl font-black tracking-tight md:text-4xl lg:text-5xl"
              style={{ textShadow: "0 0 18px rgba(0,229,255,0.6)" }}
            >
              NEXUS <span className="text-cyan-300">CAR STUDIO</span>
            </h1>
            <p className="mt-2 font-mono text-[10px] tracking-[0.3em] text-fuchsia-200 md:text-xs" style={{ textShadow: "0 1px 6px #000" }}>
              NEO KYRA · 2099 · OPEN WORLD
            </p>
          </div>
        )}

        {isDriving && <Hud onExit={stopDrive} isTouch={isTouch} />}
        {isDriving && isTouch && <MobileControls />}

        {isDriving && isTouch && rotateHint && (
          <button
            onClick={() => setRotateHint(false)}
            className="absolute left-1/2 top-[45%] z-50 -translate-x-1/2 rounded-xl border border-cyan-300/40 bg-black/70 px-4 py-3 text-center font-mono text-xs text-cyan-100 backdrop-blur landscape:hidden"
          >
            ↻ Rotate your phone to landscape for the best drive
            <span className="mt-1 block text-[10px] text-white/50">tap to dismiss</span>
          </button>
        )}
      </div>

      {!isDriving && (
        <aside
          className={`relative z-20 shrink-0 border-white/10 border-t landscape:border-t-0 landscape:border-l w-full landscape:h-full landscape:w-[min(340px,45vw)] lg:!w-[400px] ${
            collapsed ? "h-auto" : "h-[48dvh] md:h-[42dvh]"
          } landscape:!h-full`}
        >
          <CustomizationPanel
            config={config}
            update={update}
            replace={setConfig}
            garage={garage}
            onSave={() => {
              const next = [...garage, { ...config }].slice(0, 8)
              setGarage(next)
              save(STORAGE.garage, next)
            }}
            onDelete={(i) => {
              const next = garage.filter((_, j) => j !== i)
              setGarage(next)
              save(STORAGE.garage, next)
            }}
            onDrive={startDrive}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((c) => !c)}
            quality={quality}
            setQuality={changeQuality}
          />
        </aside>
      )}
    </div>
  )
}
