"use client"

import { useRef, useState, useEffect } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Environment, PerspectiveCamera } from "@react-three/drei"
import * as THREE from "three"
import { Car } from "./car-model"
import type { CarConfig } from "./types"

export function CarScene({ config, isDriving }: { config: CarConfig; isDriving: boolean }) {
    const [carPosition, setCarPosition] = useState({ x: 0, z: 0 })
    const [speed, setSpeed] = useState(0)
    const [trackDistance, setTrackDistance] = useState(0)
    const [raceFinished, setRaceFinished] = useState(false)
    const [hasArrived, setHasArrived] = useState(false)

    const cameraRef = useRef<THREE.PerspectiveCamera>(null)
    const controlsRef = useRef<any>(null)

    const savedCameraPosition = useRef<THREE.Vector3 | null>(null)
    const savedCameraTarget = useRef<THREE.Vector3 | null>(null)

    useEffect(() => {
        if (!isDriving) return

        if (trackDistance >= 70 && !hasArrived) {
            setSpeed(0)
            setHasArrived(true)
        }

        const frictionInterval = setInterval(() => {
            setSpeed((currentSpeed) => {
                if (Math.abs(currentSpeed) < 0.01) return 0
                return currentSpeed * 0.95
            })
        }, 100)

        return () => clearInterval(frictionInterval)
    }, [isDriving, trackDistance, hasArrived])

    useEffect(() => {
        if (!isDriving) {
            setCarPosition({ x: 0, z: 0 })
            setSpeed(0)
            setTrackDistance(0)
            setRaceFinished(false)
            setHasArrived(false)

            setTimeout(() => {
                if (cameraRef.current && controlsRef.current && savedCameraPosition.current && savedCameraTarget.current) {
                    cameraRef.current.position.copy(savedCameraPosition.current)
                    controlsRef.current.target.copy(savedCameraTarget.current)
                    controlsRef.current.update()
                }
            }, 100)
        } else {
            if (cameraRef.current && controlsRef.current) {
                savedCameraPosition.current = cameraRef.current.position.clone()
                savedCameraTarget.current = controlsRef.current.target.clone()
            }
        }
    }, [isDriving])

    useEffect(() => {
        if (!isDriving) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown" || e.key === "w" || e.key === "W") {
                if (!hasArrived) {
                    setSpeed((s) => Math.min(s + 0.05, 0.3))
                }
            }
            if (e.key === "ArrowUp" || e.key === "s" || e.key === "S") {
                setSpeed((s) => Math.max(s - 0.05, -0.1))
                if (hasArrived && trackDistance < 70) {
                    setHasArrived(false)
                }
            }
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
                setCarPosition((pos) => ({ ...pos, x: Math.max(pos.x - 0.5, -5) }))
            }
            if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                setCarPosition((pos) => ({ ...pos, x: Math.min(pos.x + 0.5, 5) }))
            }
        }

        window.addEventListener("keydown", handleKeyDown)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [isDriving, hasArrived, trackDistance])

    return (
        <>
            {isDriving && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20 bg-black/70 backdrop-blur-sm px-6 py-3 rounded-lg border border-accent/30">
                    {hasArrived ? (
                        <p className="text-green-400 text-lg font-mono font-bold">
                            🎯 DESTINATION ARRIVED! Distance: {trackDistance.toFixed(0)}m - Press S/↓ to reverse
                        </p>
                    ) : raceFinished ? (
                        <p className="text-green-400 text-lg font-mono font-bold">
                            🏁 CLIMB COMPLETED! Distance: {trackDistance.toFixed(0)}m
                        </p>
                    ) : trackDistance >= 200 ? (
                        <p className="text-yellow-400 text-lg font-mono font-bold">
                            ⛰️ CLIMBING SECTION! Altitude: {((trackDistance - 200) * 0.1).toFixed(1)}m
                        </p>
                    ) : (
                        <p className="text-accent text-sm font-mono">
                            🎮 WASD / Arrows | Speed: {(speed * 100).toFixed(0)}% | Distance: {trackDistance.toFixed(0)}m / 70m
                        </p>
                    )}
                </div>
            )}

            <Canvas shadows className="w-full h-full">
                <PerspectiveCamera ref={cameraRef} makeDefault position={[6, 2, 4]} fov={60} />
                <OrbitControls
                    ref={controlsRef}
                    enablePan={false}
                    minDistance={3}
                    maxDistance={10}
                    minPolarAngle={Math.PI / 4}
                    maxPolarAngle={Math.PI / 2}
                    target={[0, 0.5, 0]}
                    enabled={true}
                />

                <ambientLight intensity={0.3} />
                <directionalLight
                    position={[10, 10, 5]}
                    intensity={1.2}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />
                <spotLight position={[-10, 10, -10]} intensity={0.5} color="#00ffff" />
                <pointLight position={[0, 3, 0]} intensity={0.5} color="#0088ff" />

                <group position={[carPosition.x, 0, 0]}>
                    <Car config={config} isDriving={isDriving} speed={speed} trackDistance={trackDistance} />
                </group>

                <Environment preset="night" />

                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                    <planeGeometry args={[50, 400]} />
                    <meshStandardMaterial color="#0a0a0a" metalness={0.8} roughness={0.2} />
                </mesh>

                <group position={[0, 0.01, 0]}>
                    <AnimatedGrid
                        isDriving={isDriving}
                        speed={speed}
                        trackDistance={trackDistance}
                        setTrackDistance={setTrackDistance}
                        setRaceFinished={setRaceFinished}
                    />
                </group>
            </Canvas>
        </>
    )
}

function AnimatedGrid({
                          isDriving,
                          speed,
                          trackDistance,
                          setTrackDistance,
                          setRaceFinished,
                      }: {
    isDriving: boolean
    speed: number
    trackDistance: number
    setTrackDistance: (distance: number) => void
    setRaceFinished: (finished: boolean) => void
}) {
    const gridRef = useRef<THREE.Group>(null)
    const FLAT_TRACK_LENGTH = 200
    const CLIMB_LENGTH = 100
    const TOTAL_TRACK_LENGTH = FLAT_TRACK_LENGTH + CLIMB_LENGTH
    const GRID_SIZE = 25
    const CLIMB_ANGLE = Math.PI / 12
    const TRACK_WIDTH = 12

    useFrame(() => {
        if (gridRef.current && isDriving) {
            const moveSpeed = speed * 2

            const newDistance = trackDistance + moveSpeed
            setTrackDistance(newDistance)

            gridRef.current.position.z += moveSpeed

            if (newDistance >= TOTAL_TRACK_LENGTH) {
                setRaceFinished(true)
            }
        }
    })

    const gridsToRender = []
    const gridsBehindCar = 2
    const gridsAheadOfCar = Math.ceil((TOTAL_TRACK_LENGTH - trackDistance) / GRID_SIZE) + 2

    for (let i = -gridsBehindCar; i < gridsAheadOfCar; i++) {
        const offset = i * GRID_SIZE
        gridsToRender.push(offset)
    }

    return (
        <group ref={gridRef}>
            {gridsToRender.map((offset) => {
                const isClimbing = offset >= FLAT_TRACK_LENGTH

                if (isClimbing) {
                    const climbProgress = offset - FLAT_TRACK_LENGTH
                    const climbHeight = climbProgress * Math.sin(CLIMB_ANGLE)
                    const climbZ = -offset + climbProgress * (1 - Math.cos(CLIMB_ANGLE))

                    return (
                        <group key={offset} position={[0, climbHeight, climbZ]} rotation={[-CLIMB_ANGLE, 0, 0]}>
                            <gridHelper args={[GRID_SIZE, GRID_SIZE, "#ff9900", "#442200"]} />
                        </group>
                    )
                } else {
                    return (
                        <gridHelper key={offset} args={[GRID_SIZE, GRID_SIZE, "#00ffff", "#003344"]} position={[0, 0, -offset]} />
                    )
                }
            })}

            <group position={[-TRACK_WIDTH / 2, 0, 0]}>
                {Array.from({ length: Math.ceil(FLAT_TRACK_LENGTH / 5) }).map((_, i) => (
                    <group key={`left-${i}`} position={[0, 0, -i * 5]}>
                        <mesh rotation={[0, Math.PI / 2, 0]}>
                            <planeGeometry args={[5, 3]} />
                            <meshStandardMaterial
                                color="#001a33"
                                wireframe
                                emissive="#00ffff"
                                emissiveIntensity={0.2}
                                transparent
                                opacity={0.6}
                            />
                        </mesh>
                        <lineSegments rotation={[0, Math.PI / 2, 0]} position={[0, 1.5, 0]}>
                            <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(0.1, 3, 5)]} />
                            <lineBasicMaterial attach="material" color="#00ffff" />
                        </lineSegments>
                        <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                            <boxGeometry args={[5, 0.1, 0.1]} />
                            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={1} />
                        </mesh>
                    </group>
                ))}
            </group>

            <group position={[TRACK_WIDTH / 2, 0, 0]}>
                {Array.from({ length: Math.ceil(FLAT_TRACK_LENGTH / 5) }).map((_, i) => (
                    <group key={`right-${i}`} position={[0, 0, -i * 5]}>
                        <mesh rotation={[0, -Math.PI / 2, 0]}>
                            <planeGeometry args={[5, 3]} />
                            <meshStandardMaterial
                                color="#001a33"
                                wireframe
                                emissive="#00ffff"
                                emissiveIntensity={0.2}
                                transparent
                                opacity={0.6}
                            />
                        </mesh>
                        <lineSegments rotation={[0, -Math.PI / 2, 0]} position={[0, 1.5, 0]}>
                            <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(0.1, 3, 5)]} />
                            <lineBasicMaterial attach="material" color="#00ffff" />
                        </lineSegments>
                        <mesh position={[0, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
                            <boxGeometry args={[5, 0.1, 0.1]} />
                            <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={1} />
                        </mesh>
                    </group>
                ))}
            </group>

            <group position={[-TRACK_WIDTH / 2, 0, -FLAT_TRACK_LENGTH]}>
                {Array.from({ length: Math.ceil(CLIMB_LENGTH / 5) }).map((_, i) => {
                    const climbProgress = i * 5
                    const climbHeight = climbProgress * Math.sin(CLIMB_ANGLE)
                    const climbZ = -climbProgress * Math.cos(CLIMB_ANGLE)

                    return (
                        <group key={`left-climb-${i}`} position={[0, climbHeight, climbZ]} rotation={[-CLIMB_ANGLE, 0, 0]}>
                            <mesh rotation={[0, Math.PI / 2, 0]}>
                                <planeGeometry args={[5, 3]} />
                                <meshStandardMaterial
                                    color="#331a00"
                                    wireframe
                                    emissive="#ff9900"
                                    emissiveIntensity={0.2}
                                    transparent
                                    opacity={0.6}
                                />
                            </mesh>
                            <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                                <boxGeometry args={[5, 0.1, 0.1]} />
                                <meshStandardMaterial color="#ff9900" emissive="#ff9900" emissiveIntensity={1} />
                            </mesh>
                        </group>
                    )
                })}
            </group>

            <group position={[TRACK_WIDTH / 2, 0, -FLAT_TRACK_LENGTH]}>
                {Array.from({ length: Math.ceil(CLIMB_LENGTH / 5) }).map((_, i) => {
                    const climbProgress = i * 5
                    const climbHeight = climbProgress * Math.sin(CLIMB_ANGLE)
                    const climbZ = -climbProgress * Math.cos(CLIMB_ANGLE)

                    return (
                        <group key={`right-climb-${i}`} position={[0, climbHeight, climbZ]} rotation={[-CLIMB_ANGLE, 0, 0]}>
                            <mesh rotation={[0, -Math.PI / 2, 0]}>
                                <planeGeometry args={[5, 3]} />
                                <meshStandardMaterial
                                    color="#331a00"
                                    wireframe
                                    emissive="#ff9900"
                                    emissiveIntensity={0.2}
                                    transparent
                                    opacity={0.6}
                                />
                            </mesh>
                            <mesh position={[0, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
                                <boxGeometry args={[5, 0.1, 0.1]} />
                                <meshStandardMaterial color="#ff9900" emissive="#ff9900" emissiveIntensity={1} />
                            </mesh>
                        </group>
                    )
                })}
            </group>

            <group position={[0, 0.1, -FLAT_TRACK_LENGTH]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[12, 2]} />
                    <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
                </mesh>
                {Array.from({ length: 20 }).map((_, i) => (
                    <mesh
                        key={i}
                        rotation={[-Math.PI / 2, 0, 0]}
                        position={[((i % 10) - 4.5) * 1.2, 0.01, Math.floor(i / 10) - 0.5]}
                    >
                        <planeGeometry args={[1.2, 1]} />
                        <meshStandardMaterial color={i % 2 === 0 ? "#000000" : "#ffffff"} />
                    </mesh>
                ))}
            </group>

            <group
                position={[
                    0,
                    CLIMB_LENGTH * Math.sin(CLIMB_ANGLE) + 0.1,
                    -FLAT_TRACK_LENGTH - CLIMB_LENGTH * Math.cos(CLIMB_ANGLE),
                ]}
                rotation={[-CLIMB_ANGLE, 0, 0]}
            >
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[12, 2]} />
                    <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.8} />
                </mesh>
                {Array.from({ length: 20 }).map((_, i) => (
                    <mesh
                        key={i}
                        rotation={[-Math.PI / 2, 0, 0]}
                        position={[((i % 10) - 4.5) * 1.2, 0.01, Math.floor(i / 10) - 0.5]}
                    >
                        <planeGeometry args={[1.2, 1]} />
                        <meshStandardMaterial
                            color={i % 2 === 0 ? "#ffaa00" : "#ffff00"}
                            emissive={i % 2 === 0 ? "#ffaa00" : "#ffff00"}
                            emissiveIntensity={0.5}
                        />
                    </mesh>
                ))}
            </group>
        </group>
    )
}
