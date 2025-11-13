"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import type * as THREE from "three"
import type { CarConfig } from "./car-customizer"

export function Car({
  config,
  isDriving,
  speed,
  trackDistance = 0,
}: {
  config: CarConfig
  isDriving?: boolean
  speed?: number
  trackDistance?: number
}) {
  const carRef = useRef<THREE.Group>(null)
  const wheelsRef = useRef<THREE.Group[]>([])

  const FLAT_TRACK_LENGTH = 200
  const CLIMB_ANGLE = Math.PI / 12 // 15 degrees

  useFrame((state) => {
    if (carRef.current) {
      if (isDriving && trackDistance >= FLAT_TRACK_LENGTH) {
        const tiltAngle = -CLIMB_ANGLE
        carRef.current.rotation.x = tiltAngle
        carRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.03
        carRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.01
      } else if (isDriving) {
        carRef.current.rotation.x = 0
        carRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.03
        carRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.01
      } else {
        carRef.current.rotation.x = 0
        carRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 0.5) * 0.02
      }
    }

    if (isDriving && Math.abs(speed) > 0.001) {
      wheelsRef.current.forEach((wheel) => {
        if (wheel) {
          wheel.rotation.x -= speed * 5
        }
      })
    }
  })

  return (
    <group ref={carRef} position={[0, 0.5, 0]} castShadow>
      {/* Car Body - Lower section */}
      <mesh castShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[2, 0.6, 4]} />
        <meshStandardMaterial color={config.bodyColor} metalness={config.metalness} roughness={config.roughness} />
      </mesh>

      {/* Car Roof/Cabin */}
      <mesh castShadow position={[0, 0.8, -0.3]}>
        <boxGeometry args={[1.8, 0.6, 2]} />
        <meshStandardMaterial color={config.bodyColor} metalness={config.metalness} roughness={config.roughness} />
      </mesh>

      {/* Hood */}
      <mesh castShadow position={[0, 0.4, 1.8]}>
        <boxGeometry args={[1.8, 0.3, 0.8]} />
        <meshStandardMaterial color={config.bodyColor} metalness={config.metalness} roughness={config.roughness} />
      </mesh>

      {/* Windows - Front */}
      <mesh position={[0, 0.85, 0.5]}>
        <boxGeometry args={[1.75, 0.5, 0.05]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={config.windowTint} metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Windows - Sides */}
      <mesh position={[0.88, 0.85, -0.3]}>
        <boxGeometry args={[0.05, 0.5, 1.8]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={config.windowTint} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[-0.88, 0.85, -0.3]}>
        <boxGeometry args={[0.05, 0.5, 1.8]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={config.windowTint} metalness={0.9} roughness={0.1} />
      </mesh>

      {config.spoilerType === "sport" && (
        <group position={[0, 0.7, -2.2]}>
          <mesh castShadow>
            <boxGeometry args={[1.8, 0.1, 0.3]} />
            <meshStandardMaterial color={config.bodyColor} metalness={config.metalness} roughness={config.roughness} />
          </mesh>
          {/* Support posts */}
          <mesh castShadow position={[0.6, -0.15, 0]}>
            <boxGeometry args={[0.1, 0.3, 0.1]} />
            <meshStandardMaterial color={config.bodyColor} metalness={config.metalness} roughness={config.roughness} />
          </mesh>
          <mesh castShadow position={[-0.6, -0.15, 0]}>
            <boxGeometry args={[0.1, 0.3, 0.1]} />
            <meshStandardMaterial color={config.bodyColor} metalness={config.metalness} roughness={config.roughness} />
          </mesh>
        </group>
      )}

      {config.spoilerType === "racing" && (
        <group position={[0, 0.9, -2.2]}>
          <mesh castShadow rotation={[0.2, 0, 0]}>
            <boxGeometry args={[1.9, 0.15, 0.4]} />
            <meshStandardMaterial color={config.bodyColor} metalness={config.metalness} roughness={config.roughness} />
          </mesh>
          {/* Racing spoiler supports - taller */}
          <mesh castShadow position={[0.7, -0.25, 0]}>
            <boxGeometry args={[0.12, 0.5, 0.12]} />
            <meshStandardMaterial color={config.bodyColor} metalness={config.metalness} roughness={config.roughness} />
          </mesh>
          <mesh castShadow position={[-0.7, -0.25, 0]}>
            <boxGeometry args={[0.12, 0.5, 0.12]} />
            <meshStandardMaterial color={config.bodyColor} metalness={config.metalness} roughness={config.roughness} />
          </mesh>
        </group>
      )}

      {[
        [-0.9, 0, 1.3],
        [0.9, 0, 1.3],
        [-0.9, 0, -1.3],
        [0.9, 0, -1.3],
      ].map((position, i) => (
        <group
          key={i}
          position={position as [number, number, number]}
          ref={(el) => {
            if (el) wheelsRef.current[i] = el
          }}
        >
          {/* Tire */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.4, 0.4, 0.3, 32]} />
            <meshStandardMaterial color={config.wheelColor} metalness={0.8} roughness={0.2} />
          </mesh>

          {/* Rim - varies by style */}
          {config.rimStyle === "standard" && (
            <mesh rotation={[0, 0, Math.PI / 2]} position={[0.16, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.05, 32]} />
              <meshStandardMaterial color="#888888" metalness={1} roughness={0.1} />
            </mesh>
          )}

          {config.rimStyle === "sport" && (
            <>
              <mesh rotation={[0, 0, Math.PI / 2]} position={[0.16, 0, 0]}>
                <cylinderGeometry args={[0.25, 0.25, 0.05, 6]} />
                <meshStandardMaterial color="#444444" metalness={1} roughness={0.1} />
              </mesh>
              <mesh rotation={[0, 0, Math.PI / 2]} position={[0.17, 0, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 0.06, 32]} />
                <meshStandardMaterial color="#ff0000" metalness={0.9} roughness={0.2} />
              </mesh>
            </>
          )}

          {config.rimStyle === "chrome" && (
            <>
              <mesh rotation={[0, 0, Math.PI / 2]} position={[0.16, 0, 0]}>
                <cylinderGeometry args={[0.25, 0.25, 0.05, 32]} />
                <meshStandardMaterial color="#e0e0e0" metalness={1} roughness={0.05} />
              </mesh>
              {/* Chrome spokes */}
              {[0, 1, 2, 3, 4].map((spoke) => (
                <mesh key={spoke} rotation={[0, (spoke * Math.PI * 2) / 5, Math.PI / 2]} position={[0.16, 0, 0]}>
                  <boxGeometry args={[0.3, 0.03, 0.06]} />
                  <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.05} />
                </mesh>
              ))}
            </>
          )}
        </group>
      ))}

      <mesh position={[0.6, 0.35, 2.2]}>
        <boxGeometry args={[0.3, 0.15, 0.1]} />
        <meshStandardMaterial color={config.headlightColor} emissive={config.headlightColor} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[-0.6, 0.35, 2.2]}>
        <boxGeometry args={[0.3, 0.15, 0.1]} />
        <meshStandardMaterial color={config.headlightColor} emissive={config.headlightColor} emissiveIntensity={1.2} />
      </mesh>

      <pointLight position={[0.6, 0.35, 2.3]} color={config.headlightColor} intensity={2} distance={5} />
      <pointLight position={[-0.6, 0.35, 2.3]} color={config.headlightColor} intensity={2} distance={5} />

      {/* Taillights */}
      <mesh position={[0.6, 0.35, -2.0]}>
        <boxGeometry args={[0.3, 0.15, 0.1]} />
        <meshStandardMaterial color="#FF3333" emissive="#FF0000" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[-0.6, 0.35, -2.0]}>
        <boxGeometry args={[0.3, 0.15, 0.1]} />
        <meshStandardMaterial color="#FF3333" emissive="#FF0000" emissiveIntensity={0.8} />
      </mesh>

      {config.underglow && (
        <>
          {/* Underglow light strips */}
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.8, 3.8]} />
            <meshStandardMaterial
              color={config.underglowColor}
              emissive={config.underglowColor}
              emissiveIntensity={0.8}
              transparent
              opacity={0.6}
            />
          </mesh>

          {/* Point lights for ground glow effect */}
          <pointLight position={[0, 0.1, 1.5]} color={config.underglowColor} intensity={3} distance={3} />
          <pointLight position={[0, 0.1, 0]} color={config.underglowColor} intensity={3} distance={3} />
          <pointLight position={[0, 0.1, -1.5]} color={config.underglowColor} intensity={3} distance={3} />
        </>
      )}
    </group>
  )
}
