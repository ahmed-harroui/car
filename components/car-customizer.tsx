"use client"

import { useState } from "react"
import type { CarConfig } from "./types"
import { CustomizationPanel } from "./customization-panel"
import { CarScene } from "./car-scene-wrapper"

export function CarCustomizer() {
    const [config, setConfig] = useState<CarConfig>({
        bodyColor: "#1a1a1a",
        wheelColor: "#2a2a2a",
        windowTint: 0.3,
        metalness: 0.9,
        roughness: 0.1,
        spoilerType: "none",
        rimStyle: "standard",
        headlightColor: "#00ffff",
        underglow: false,
        underglowColor: "#00ffff",
    })

    const [isDriving, setIsDriving] = useState(false)
    const [isPanelVisible, setIsPanelVisible] = useState(true)
    const [savedConfigs, setSavedConfigs] = useState<CarConfig[]>([])

    const handleSaveConfig = () => {
        setSavedConfigs([...savedConfigs, { ...config }])
    }

    const handleToggleDrive = () => {
        const newDrivingState = !isDriving
        setIsDriving(newDrivingState)

        if (newDrivingState) {
            setIsPanelVisible(false)
        } else {
            setIsPanelVisible(true)
        }
    }

    return (
        <div
            className="relative w-full h-screen flex flex-col lg:flex-row bg-background grid-pattern overflow-hidden"
            style={{ cursor: isDriving ? "none" : "auto" }}
        >
            <div className="absolute top-0 left-0 right-0 p-4 lg:p-6 z-20 pointer-events-none">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl lg:text-5xl font-bold text-foreground text-glow">NEXUS CAR STUDIO</h1>
                    <p className="text-sm lg:text-base text-accent mt-1">Advanced 3D Customization System</p>
                </div>
            </div>

            <div className="flex-1 w-full h-full relative transition-all duration-500">
                <CarScene config={config} isDriving={isDriving} />
            </div>

            <CustomizationPanel
                config={config}
                setConfig={setConfig}
                onSaveConfig={handleSaveConfig}
                isDriving={isDriving}
                isPanelVisible={isPanelVisible}
                onToggleDrive={handleToggleDrive}
                onTogglePanel={() => setIsPanelVisible(!isPanelVisible)}
            />
        </div>
    )
}
