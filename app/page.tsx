"use client"

import dynamic from "next/dynamic"

const CarCustomizer = dynamic(
    () => import("@/components/car-customizer").then((mod) => ({ default: mod.CarCustomizer })),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center w-full h-screen bg-black">
                <div className="text-cyan-500 text-2xl font-bold animate-pulse">Loading 3D Car Studio...</div>
            </div>
        ),
    },
)

export default function Page() {
    return (
        <main className="w-full h-screen">
            <CarCustomizer />
        </main>
    )
}
