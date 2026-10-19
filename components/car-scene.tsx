"use client"

import { useEffect, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Environment, Lightformer, OrbitControls } from "@react-three/drei"
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing"
import { ToneMappingMode } from "postprocessing"
import * as THREE from "three"
import type { CarConfig } from "./types"
import { City } from "./world/city"
import { Vehicle } from "./vehicle"
import { DriveEffects } from "./effects"
import { drive } from "./drive-store"

export type Quality = "high" | "low"

function MoonLight({ quality }: { quality: Quality }) {
  const ref = useRef<THREE.DirectionalLight>(null)
  useFrame(() => {
    const l = ref.current
    if (!l) return
    l.position.set(drive.x + 30, 60, drive.z + 20)
    l.target.position.set(drive.x, 0, drive.z)
    l.target.updateMatrixWorld()
  })
  const size = quality === "high" ? 2048 : 1024
  return (
    <directionalLight
      ref={ref}
      color="#b4c2ff"
      intensity={1.1}
      castShadow={quality === "high"}
      shadow-mapSize-width={size}
      shadow-mapSize-height={size}
      shadow-camera-left={-35}
      shadow-camera-right={35}
      shadow-camera-top={35}
      shadow-camera-bottom={-35}
      shadow-camera-near={1}
      shadow-camera-far={160}
      shadow-bias={-0.0005}
    />
  )
}

function Reflections() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#05030c"]} />
      <Lightformer form="rect" intensity={4} color="#00e5ff" position={[0, 4, -10]} scale={[14, 1.2, 1]} />
      <Lightformer form="rect" intensity={3} color="#ff2bd6" position={[-10, 2, 0]} rotation-y={Math.PI / 2} scale={[24, 0.8, 1]} />
      <Lightformer form="rect" intensity={2.5} color="#7a5cff" position={[10, 2, 0]} rotation-y={-Math.PI / 2} scale={[24, 0.8, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[14, 14, 1]} />
      <Lightformer form="ring" intensity={2.5} color="#ffb000" position={[0, 3, 12]} scale={3} />
    </Environment>
  )
}

/** Pauses orbit auto-rotation while the user is interacting. */
function useAutoRotatePause(controlsRef: React.RefObject<any>, isDriving: boolean) {
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    let timer: ReturnType<typeof setTimeout>
    const start = () => {
      clearTimeout(timer)
      c.autoRotate = false
    }
    const end = () => {
      clearTimeout(timer)
      timer = setTimeout(() => (c.autoRotate = true), 5000)
    }
    c.addEventListener("start", start)
    c.addEventListener("end", end)
    return () => {
      clearTimeout(timer)
      c.removeEventListener("start", start)
      c.removeEventListener("end", end)
    }
  }, [controlsRef, isDriving])
}

function Controls({ isDriving, controlsRef }: { isDriving: boolean; controlsRef: React.RefObject<any> }) {
  useAutoRotatePause(controlsRef, isDriving)
  return (
    <OrbitControls
      ref={controlsRef}
      enabled={!isDriving}
      enablePan={false}
      enableDamping
      minDistance={4.5}
      maxDistance={18}
      minPolarAngle={0.35}
      maxPolarAngle={1.52}
      autoRotate
      autoRotateSpeed={0.5}
      target={[drive.x, 0.7, drive.z]}
    />
  )
}

export function CarScene({ config, isDriving, quality }: { config: CarConfig; isDriving: boolean; quality: Quality }) {
  const controlsRef = useRef<any>(null)
  const high = quality === "high"

  return (
    <Canvas
      key={quality}
      shadows={high}
      dpr={high ? [1, 1.5] : [0.75, 1.1]}
      gl={{ antialias: !high, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 50, near: 0.1, far: 6000, position: [drive.x + 6.5, 2.4, drive.z - 7.5] }}
      className="touch-none"
    >
      <color attach="background" args={["#05030c"]} />
      <fog attach="fog" args={["#170a2e", 110, 1500]} />
      <hemisphereLight args={["#6a4cff", "#07060c", 0.55]} />
      <ambientLight intensity={0.12} />
      <MoonLight quality={quality} />
      <Reflections />

      <City />
      <Vehicle config={config} isDriving={isDriving} controlsRef={controlsRef} />
      <DriveEffects config={config} active={isDriving} />
      <Controls isDriving={isDriving} controlsRef={controlsRef} />

      {high && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={1} luminanceSmoothing={0.25} radius={0.7} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.25} darkness={0.65} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
