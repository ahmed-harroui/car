"use client"

import { useMemo, type ReactNode } from "react"
import {
  Car,
  ChevronDown,
  ChevronUp,
  Disc3,
  Gauge,
  Lightbulb,
  Play,
  Save,
  Shuffle,
  Sparkles,
  Trash2,
  Warehouse,
  Wind,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  FINISHES,
  PRESETS,
  getPerformance,
  type BodyStyle,
  type CarConfig,
  type Livery,
  type PaintFinish,
  type RimStyle,
  type SpoilerType,
  type UnderglowMode,
} from "./types"
import { getProfileSvg } from "./car-model"
import type { Quality } from "./car-scene"

const PAINT = ["#0b0f1a", "#f2f4f7", "#c9ced6", "#dc2626", "#ff4d00", "#ffd000", "#00ff9c", "#00e5ff", "#0066ff", "#7a1cff", "#ff2bd6", "#1d3b2a"]
const ACCENT = ["#111111", "#ffffff", "#00e5ff", "#ff2bd6", "#ffb000", "#00ff9c", "#ff2244", "#7a5cff"]
const WHEEL = ["#1c1f26", "#0d0d12", "#c0c4cc", "#d4a017", "#ffffff", "#ff2244", "#00e5ff", "#7a1cff"]
const LIGHT = ["#bff8ff", "#ffffff", "#fff2c0", "#00e5ff", "#ff2bd6", "#7a5cff", "#00ff9c", "#ffb000", "#ff2244"]

type Props = {
  config: CarConfig
  update: (patch: Partial<CarConfig>) => void
  replace: (c: CarConfig) => void
  garage: CarConfig[]
  onSave: () => void
  onDelete: (i: number) => void
  onDrive: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
  quality: Quality
  setQuality: (q: Quality) => void
}

function Section({ title, icon, children, right }: { title: string; icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
          {icon}
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  )
}

function Swatches({ colors, value, onChange, glow }: { colors: string[]; value: string; onChange: (c: string) => void; glow?: boolean }) {
  return (
    <div className="grid grid-cols-7 sm:grid-cols-9 landscape:grid-cols-6 lg:!grid-cols-7 gap-2">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={c}
          className={`aspect-square rounded-lg border-2 transition hover:scale-110 active:scale-95 ${
            value.toLowerCase() === c.toLowerCase() ? "border-white scale-105" : "border-white/10"
          }`}
          style={{ background: c, boxShadow: glow || value === c ? `0 0 14px ${c}88` : undefined }}
        />
      ))}
      <label
        className="relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-white/30 hover:border-white"
        style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
        title="Custom color"
      >
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>
    </div>
  )
}

function Options<T extends string>({
  options,
  value,
  onChange,
  cols = 3,
}: {
  options: { value: T; label: string; desc?: string; preview?: ReactNode }[]
  value: T
  onChange: (v: T) => void
  cols?: number
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-xl border px-2 py-2 text-left transition active:scale-[0.97] ${
            value === o.value
              ? "border-cyan-300 bg-cyan-400/15 shadow-[0_0_16px_rgba(0,229,255,0.25)]"
              : "border-white/10 bg-white/[0.03] hover:border-white/30"
          }`}
        >
          {o.preview}
          <div className="text-xs font-semibold text-white">{o.label}</div>
          {o.desc && <div className="text-[10px] leading-tight text-white/50">{o.desc}</div>}
        </button>
      ))}
    </div>
  )
}

function SliderRow({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  format = (v: number) => `${Math.round(v * 100)}%`,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  format?: (v: number) => string
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-white/80">{label}</span>
        <span className="font-mono text-cyan-300">{format(value)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div>
        <div className="text-xs font-semibold text-white">{label}</div>
        {desc && <div className="text-[10px] text-white/50">{desc}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

function Silhouette({ style, color }: { style: BodyStyle; color: string }) {
  const p = useMemo(() => getProfileSvg(style), [style])
  return (
    <svg viewBox="0 0 104 34" className="mb-1 h-8 w-full">
      <path d={p.body} fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
      {p.cabin && <path d={p.cabin} fill="#0a1a26" stroke="rgba(0,229,255,0.6)" strokeWidth="0.6" />}
      {p.wheels.map((w, i) => (
        <circle key={i} cx={w.cx} cy={w.cy} r={w.r} fill="#0b0b0f" stroke="#888" strokeWidth="0.8" />
      ))}
    </svg>
  )
}

function StatBar({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-white/70">{label}</span>
        <span className="font-mono text-cyan-300">{text}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
    </div>
  )
}

const TABS = [
  { id: "body", label: "Body", icon: Car },
  { id: "wheels", label: "Wheels", icon: Disc3 },
  { id: "aero", label: "Aero", icon: Wind },
  { id: "lights", label: "Lights", icon: Lightbulb },
  { id: "tune", label: "Tune", icon: Gauge },
  { id: "garage", label: "Garage", icon: Warehouse },
]

function randomBuild(base: CarConfig): CarConfig {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
  const neon = pick(LIGHT.slice(3))
  return {
    ...base,
    bodyStyle: pick(["aero", "hyper", "roadster", "titan"] as const),
    bodyColor: pick(PAINT),
    accentColor: pick(ACCENT),
    finish: pick(Object.keys(FINISHES) as PaintFinish[]),
    livery: pick(["none", "stripes", "twotone", "circuit"] as const),
    rimStyle: pick(["turbine", "spoke", "mesh", "aero", "neon"] as const),
    wheelColor: pick(WHEEL),
    caliperColor: pick(ACCENT.slice(2)),
    spoilerType: pick(["none", "lip", "wing", "gt"] as const),
    splitter: Math.random() > 0.3,
    sideSkirts: Math.random() > 0.3,
    underglow: Math.random() > 0.3,
    underglowColor: neon,
    underglowMode: pick(["static", "pulse", "rainbow"] as const),
    neonColor: neon,
    headlightColor: pick(LIGHT),
    wheelSize: 0.9 + Math.random() * 0.25,
    rideHeight: Math.random(),
  }
}

export function CustomizationPanel({
  config,
  update,
  replace,
  garage,
  onSave,
  onDelete,
  onDrive,
  collapsed,
  onToggleCollapsed,
  quality,
  setQuality,
}: Props) {
  const perf = getPerformance(config)
  const zeroTo100 = 27.8 / (perf.accel * 0.82)

  return (
    <div className="flex h-full flex-col bg-[#070912]/90 backdrop-blur-xl">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] tracking-[0.3em] text-cyan-300/70">NEXUS STUDIO</div>
          <input
            value={config.name}
            onChange={(e) => update({ name: e.target.value.slice(0, 22) })}
            className="w-full bg-transparent text-lg font-bold text-white outline-none focus:text-cyan-100"
            aria-label="Build name"
          />
        </div>
        <button
          onClick={onToggleCollapsed}
          className="rounded-lg border border-white/15 p-2 text-white/70 hover:text-white landscape:hidden lg:hidden"
          aria-label={collapsed ? "Expand panel" : "Collapse panel"}
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {
        <Tabs defaultValue="body" className={`${collapsed ? "hidden landscape:flex" : "flex"} min-h-0 flex-1 flex-col`}>
          <TabsList className="mx-3 mt-3 flex h-auto justify-start gap-1 overflow-x-auto bg-white/5 p-1 [scrollbar-width:none]">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="flex-1 flex-col gap-0.5 px-2 py-1.5 text-[10px] data-[state=active]:bg-cyan-400 data-[state=active]:text-black min-w-[52px]"
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3 [&_[role=tabpanel]]:space-y-5">
            <TabsContent value="body">
              <Section title="Chassis" icon={<Car className="h-3.5 w-3.5" />}>
                <Options<BodyStyle>
                  cols={2}
                  value={config.bodyStyle}
                  onChange={(v) => update({ bodyStyle: v })}
                  options={[
                    { value: "aero", label: "Aero GT", desc: "Balanced grand tourer", preview: <Silhouette style="aero" color={config.bodyColor} /> },
                    { value: "hyper", label: "Hyper", desc: "Low wedge, long tail", preview: <Silhouette style="hyper" color={config.bodyColor} /> },
                    {
                      value: "roadster",
                      label: "Roadster",
                      desc: "Electric hypercar, glass canopy",
                      preview: <Silhouette style="roadster" color={config.bodyColor} />,
                    },
                    { value: "titan", label: "Titan", desc: "Angular armored", preview: <Silhouette style="titan" color={config.bodyColor} /> },
                  ]}
                />
              </Section>
              <Section title="Paint">
                <Swatches colors={PAINT} value={config.bodyColor} onChange={(c) => update({ bodyColor: c })} />
              </Section>
              <Section title="Finish" icon={<Sparkles className="h-3.5 w-3.5" />}>
                <Options<PaintFinish>
                  cols={3}
                  value={config.finish}
                  onChange={(v) => update({ finish: v })}
                  options={[
                    { value: "gloss", label: "Gloss" },
                    { value: "metallic", label: "Metallic" },
                    { value: "pearl", label: "Pearl", desc: "Color-shift" },
                    { value: "matte", label: "Matte" },
                    { value: "satin", label: "Satin" },
                    { value: "chrome", label: "Chrome" },
                  ]}
                />
              </Section>
              <Section title="Livery">
                <Options<Livery>
                  cols={4}
                  value={config.livery}
                  onChange={(v) => update({ livery: v })}
                  options={[
                    { value: "none", label: "Clean" },
                    { value: "stripes", label: "Stripes" },
                    { value: "twotone", label: "Two-tone" },
                    { value: "circuit", label: "Circuit" },
                  ]}
                />
              </Section>
              <Section title="Accent color">
                <Swatches colors={ACCENT} value={config.accentColor} onChange={(c) => update({ accentColor: c })} />
              </Section>
              <SliderRow label="Window tint" value={config.windowTint} onChange={(v) => update({ windowTint: v })} />
            </TabsContent>

            <TabsContent value="wheels">
              <Section title="Rim design" icon={<Disc3 className="h-3.5 w-3.5" />}>
                <Options<RimStyle>
                  cols={3}
                  value={config.rimStyle}
                  onChange={(v) => update({ rimStyle: v })}
                  options={[
                    { value: "turbine", label: "Turbine", desc: "Bladed fan" },
                    { value: "spoke", label: "5-Spoke", desc: "Classic sport" },
                    { value: "mesh", label: "Mesh", desc: "Motorsport" },
                    { value: "aero", label: "Aero Disc", desc: "Low drag" },
                    { value: "neon", label: "Neon Ring", desc: "Illuminated" },
                  ]}
                />
              </Section>
              <Section title="Rim color">
                <Swatches colors={WHEEL} value={config.wheelColor} onChange={(c) => update({ wheelColor: c })} />
              </Section>
              <Section title="Brake calipers">
                <Swatches colors={ACCENT} value={config.caliperColor} onChange={(c) => update({ caliperColor: c })} />
              </Section>
              <SliderRow
                label="Wheel size"
                value={config.wheelSize}
                min={0.85}
                max={1.15}
                step={0.01}
                format={(v) => `${Math.round(18 + (v - 0.85) * 20)}"`}
                onChange={(v) => update({ wheelSize: v })}
              />
            </TabsContent>

            <TabsContent value="aero">
              <Section title="Rear wing" icon={<Wind className="h-3.5 w-3.5" />}>
                <Options<SpoilerType>
                  cols={4}
                  value={config.spoilerType}
                  onChange={(v) => update({ spoilerType: v })}
                  options={[
                    { value: "none", label: "None" },
                    { value: "lip", label: "Lip" },
                    { value: "wing", label: "Wing" },
                    { value: "gt", label: "GT" },
                  ]}
                />
              </Section>
              <ToggleRow label="Front splitter" desc="Carbon blade with neon edge" checked={config.splitter} onChange={(v) => update({ splitter: v })} />
              <ToggleRow label="Side skirts" desc="Illuminated sills" checked={config.sideSkirts} onChange={(v) => update({ sideSkirts: v })} />
              <SliderRow
                label="Ride height"
                value={config.rideHeight}
                onChange={(v) => update({ rideHeight: v })}
                format={(v) => (v < 0.25 ? "Slammed" : v < 0.6 ? "Street" : "Raised")}
              />
            </TabsContent>

            <TabsContent value="lights">
              <Section title="Headlights" icon={<Lightbulb className="h-3.5 w-3.5" />}>
                <Swatches glow colors={LIGHT} value={config.headlightColor} onChange={(c) => update({ headlightColor: c })} />
              </Section>
              <Section title="Neon trim">
                <Swatches glow colors={LIGHT.slice(3)} value={config.neonColor} onChange={(c) => update({ neonColor: c })} />
              </Section>
              <ToggleRow label="Underglow" desc="Ground-effect lighting" checked={config.underglow} onChange={(v) => update({ underglow: v })} />
              {config.underglow && (
                <>
                  <Swatches glow colors={LIGHT.slice(3)} value={config.underglowColor} onChange={(c) => update({ underglowColor: c })} />
                  <Options<UnderglowMode>
                    value={config.underglowMode}
                    onChange={(v) => update({ underglowMode: v })}
                    options={[
                      { value: "static", label: "Static" },
                      { value: "pulse", label: "Pulse" },
                      { value: "rainbow", label: "Spectrum" },
                    ]}
                  />
                </>
              )}
              <Section title="License plate">
                <input
                  value={config.plate}
                  onChange={(e) => update({ plate: e.target.value.toUpperCase().slice(0, 9) })}
                  className="w-full rounded-lg border border-cyan-400/40 bg-black px-3 py-2 text-center font-mono text-lg tracking-[0.2em] outline-none focus:border-cyan-300"
                  style={{ color: config.neonColor, textShadow: `0 0 8px ${config.neonColor}` }}
                />
              </Section>
            </TabsContent>

            <TabsContent value="tune">
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <StatBar label="Top speed" value={(perf.topSpeed - 50) / 40} text={`${Math.round(perf.topSpeed * 3.6)} km/h`} />
                <StatBar label="0–100 km/h" value={(4.2 - zeroTo100) / 3} text={`${zeroTo100.toFixed(1)} s`} />
                <StatBar label="Grip" value={config.grip} text={`${Math.round(config.grip * 10)}/10`} />
                <StatBar label="Drift" value={config.driftiness} text={`${Math.round(config.driftiness * 10)}/10`} />
                <div className="text-[10px] text-white/50">Nitro boost: {Math.round(perf.topSpeed * 3.6 * 1.3)} km/h</div>
              </div>
              <SliderRow label="Engine power" value={config.power} onChange={(v) => update({ power: v })} />
              <SliderRow label="Tire grip" value={config.grip} onChange={(v) => update({ grip: v })} />
              <SliderRow label="Drift / slide" value={config.driftiness} onChange={(v) => update({ driftiness: v })} />
              <SliderRow label="Steering response" value={config.steering} onChange={(v) => update({ steering: v })} />
            </TabsContent>

            <TabsContent value="garage">
              <Section title="Factory presets">
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => replace({ ...p })}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left hover:border-cyan-300/60"
                    >
                      <span className="h-6 w-6 shrink-0 rounded-full border border-white/20" style={{ background: p.bodyColor, boxShadow: `0 0 10px ${p.neonColor}` }} />
                      <span className="truncate text-xs font-semibold">{p.name}</span>
                    </button>
                  ))}
                </div>
              </Section>
              <Section
                title={`My builds (${garage.length}/8)`}
                right={
                  <button onClick={() => replace(randomBuild(config))} className="flex items-center gap-1 text-[11px] text-fuchsia-300 hover:text-fuchsia-200">
                    <Shuffle className="h-3 w-3" /> Randomize
                  </button>
                }
              >
                {garage.length === 0 && <p className="text-xs text-white/50">Save a build to keep it here — stored on this device.</p>}
                <div className="space-y-1.5">
                  {garage.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                      <span className="h-5 w-5 shrink-0 rounded-full" style={{ background: g.bodyColor, boxShadow: `0 0 8px ${g.neonColor}` }} />
                      <button onClick={() => replace({ ...g })} className="min-w-0 flex-1 truncate text-left text-xs font-semibold hover:text-cyan-200">
                        {g.name}
                        <span className="ml-2 font-normal text-white/40">{g.bodyStyle}</span>
                      </button>
                      <button onClick={() => onDelete(i)} className="p-1 text-white/40 hover:text-red-400" aria-label="Delete build">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Graphics">
                <Options<Quality>
                  cols={2}
                  value={quality}
                  onChange={setQuality}
                  options={[
                    { value: "high", label: "Ultra", desc: "Bloom, shadows, HD" },
                    { value: "low", label: "Performance", desc: "Best for phones" },
                  ]}
                />
              </Section>
            </TabsContent>
          </div>
        </Tabs>
      }

      {/* actions */}
      <div className="flex gap-2 border-t border-white/10 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          onClick={onSave}
          disabled={garage.length >= 8}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
          title="Save build"
        >
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">Save</span>
        </button>
        <button
          onClick={onDrive}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-fuchsia-500 text-sm font-black tracking-[0.25em] text-black shadow-[0_0_30px_rgba(0,229,255,0.45)] hover:brightness-110 active:scale-[0.98]"
        >
          <Play className="h-4 w-4 fill-black" />
          FREE DRIVE
        </button>
      </div>
    </div>
  )
}
