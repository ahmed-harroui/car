"use client"

import dynamic from "next/dynamic"

export const CarScene = dynamic(() => import("./car-scene").then((mod) => ({ default: mod.CarScene })), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center w-full h-full bg-background">
            <div className="text-accent text-xl animate-pulse">Loading 3D Engine...</div>
        </div>
    ),
})
