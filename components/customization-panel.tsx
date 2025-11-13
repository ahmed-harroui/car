"use client"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Palette, Circle, Droplets, Sparkles, Zap, Settings2, Lightbulb, Save, Play, Square } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { CarConfig } from "./types"

const PRESET_COLORS = [
  { name: "Midnight Black", value: "#0a0a0a" },
  { name: "Pearl White", value: "#f5f5f5" },
  { name: "Racing Red", value: "#dc2626" },
  { name: "Electric Blue", value: "#0088ff" },
  { name: "Neon Green", value: "#00ff88" },
  { name: "Sunset Orange", value: "#ff6600" },
  { name: "Cyber Purple", value: "#8800ff" },
  { name: "Chrome Silver", value: "#c0c0c0" },
  { name: "Gold Rush", value: "#ffd700" },
  { name: "Hot Pink", value: "#ff1493" },
  { name: "Lime", value: "#ccff00" },
  { name: "Deep Ocean", value: "#003366" },
]

const WHEEL_COLORS = [
  { name: "Dark Chrome", value: "#2a2a2a" },
  { name: "Silver", value: "#c0c0c0" },
  { name: "Gold", value: "#fbbf24" },
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#dc2626" },
  { name: "Blue", value: "#0088ff" },
]

const GLOW_COLORS = [
  { name: "Cyan", value: "#00ffff" },
  { name: "Blue", value: "#0088ff" },
  { name: "Green", value: "#00ff88" },
  { name: "Purple", value: "#8800ff" },
  { name: "Pink", value: "#ff1493" },
  { name: "Orange", value: "#ff6600" },
  { name: "White", value: "#ffffff" },
]

type CustomizationPanelProps = {
  config: CarConfig
  setConfig: (config: CarConfig) => void
  onSaveConfig: () => void
  isDriving: boolean
  isPanelVisible: boolean
  onToggleDrive: () => void
  onTogglePanel: () => void
}

export function CustomizationPanel({
                                     config,
                                     setConfig,
                                     onSaveConfig,
                                     isDriving,
                                     isPanelVisible,
                                     onToggleDrive,
                                     onTogglePanel,
                                   }: CustomizationPanelProps) {
  return (
      <div
          className={`${isDriving ? "w-[80px]" : "w-full lg:w-[420px]"} h-auto lg:h-full flex-shrink-0 relative z-10 transition-all duration-500`}
      >
        <div
            className={`h-full lg:overflow-y-auto backdrop-blur-xl bg-card/40 border-l border-border transition-all duration-500 ${isDriving ? "p-2" : "p-4 lg:p-6"}`}
        >
          {!isDriving && isPanelVisible ? (
              // Full panel content when not driving and panel is visible
              <>
                <Tabs defaultValue="colors" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-6 bg-secondary/50 glow-blue">
                    <TabsTrigger
                        value="colors"
                        className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                    >
                      <Palette className="w-4 h-4 mr-2" />
                      Colors
                    </TabsTrigger>
                    <TabsTrigger
                        value="features"
                        className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                    >
                      <Settings2 className="w-4 h-4 mr-2" />
                      Features
                    </TabsTrigger>
                    <TabsTrigger
                        value="effects"
                        className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Effects
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="colors" className="space-y-6">
                    {/* Body Color */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-accent" />
                        <Label className="font-semibold text-foreground">Body Color</Label>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {PRESET_COLORS.map((color) => (
                            <button
                                key={color.value}
                                onClick={() => setConfig({ ...config, bodyColor: color.value })}
                                className={`relative h-12 rounded-md border-2 transition-all hover:scale-105 ${
                                    config.bodyColor === color.value
                                        ? "border-accent ring-2 ring-accent/50 glow-cyan"
                                        : "border-border/50"
                                }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                            >
                              {config.bodyColor === color.value && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Circle className="w-4 h-4 fill-accent text-accent" />
                                  </div>
                              )}
                            </button>
                        ))}
                      </div>
                    </div>

                    {/* Wheel Color */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Circle className="w-4 h-4 text-accent" />
                        <Label className="font-semibold text-foreground">Wheel Color</Label>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {WHEEL_COLORS.map((color) => (
                            <button
                                key={color.value}
                                onClick={() => setConfig({ ...config, wheelColor: color.value })}
                                className={`relative h-12 rounded-md border-2 transition-all hover:scale-105 ${
                                    config.wheelColor === color.value
                                        ? "border-accent ring-2 ring-accent/50 glow-cyan"
                                        : "border-border/50"
                                }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                            >
                              {config.wheelColor === color.value && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Circle className="w-4 h-4 fill-accent text-accent" />
                                  </div>
                              )}
                            </button>
                        ))}
                      </div>
                    </div>

                    {/* Material Properties */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-accent" />
                            Metalness
                          </Label>
                          <span className="text-xs text-muted-foreground">{Math.round(config.metalness * 100)}%</span>
                        </div>
                        <Slider
                            value={[config.metalness]}
                            onValueChange={([value]) => setConfig({ ...config, metalness: value })}
                            min={0}
                            max={1}
                            step={0.1}
                            className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-accent" />
                            Glossiness
                          </Label>
                          <span className="text-xs text-muted-foreground">{Math.round((1 - config.roughness) * 100)}%</span>
                        </div>
                        <Slider
                            value={[config.roughness]}
                            onValueChange={([value]) => setConfig({ ...config, roughness: value })}
                            min={0}
                            max={1}
                            step={0.1}
                            className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Droplets className="w-4 h-4 text-accent" />
                            Window Tint
                          </Label>
                          <span className="text-xs text-muted-foreground">{Math.round(config.windowTint * 100)}%</span>
                        </div>
                        <Slider
                            value={[config.windowTint]}
                            onValueChange={([value]) => setConfig({ ...config, windowTint: value })}
                            min={0.1}
                            max={0.9}
                            step={0.1}
                            className="w-full"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="features" className="space-y-6">
                    {/* Spoiler Type */}
                    <div className="space-y-3">
                      <Label className="font-semibold text-foreground">Spoiler Type</Label>
                      <RadioGroup
                          value={config.spoilerType}
                          onValueChange={(value) => setConfig({ ...config, spoilerType: value as CarConfig["spoilerType"] })}
                      >
                        <div className="flex items-center space-x-2 p-3 rounded-md border border-border/50 hover:border-accent/50 transition-colors">
                          <RadioGroupItem value="none" id="spoiler-none" />
                          <Label htmlFor="spoiler-none" className="flex-1 cursor-pointer">
                            None
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 rounded-md border border-border/50 hover:border-accent/50 transition-colors">
                          <RadioGroupItem value="sport" id="spoiler-sport" />
                          <Label htmlFor="spoiler-sport" className="flex-1 cursor-pointer">
                            Sport
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 rounded-md border border-border/50 hover:border-accent/50 transition-colors">
                          <RadioGroupItem value="racing" id="spoiler-racing" />
                          <Label htmlFor="spoiler-racing" className="flex-1 cursor-pointer">
                            Racing
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Rim Style */}
                    <div className="space-y-3">
                      <Label className="font-semibold text-foreground">Rim Style</Label>
                      <RadioGroup
                          value={config.rimStyle}
                          onValueChange={(value) => setConfig({ ...config, rimStyle: value as CarConfig["rimStyle"] })}
                      >
                        <div className="flex items-center space-x-2 p-3 rounded-md border border-border/50 hover:border-accent/50 transition-colors">
                          <RadioGroupItem value="standard" id="rim-standard" />
                          <Label htmlFor="rim-standard" className="flex-1 cursor-pointer">
                            Standard
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 rounded-md border border-border/50 hover:border-accent/50 transition-colors">
                          <RadioGroupItem value="sport" id="rim-sport" />
                          <Label htmlFor="rim-sport" className="flex-1 cursor-pointer">
                            Sport
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 rounded-md border border-border/50 hover:border-accent/50 transition-colors">
                          <RadioGroupItem value="chrome" id="rim-chrome" />
                          <Label htmlFor="rim-chrome" className="flex-1 cursor-pointer">
                            Chrome
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </TabsContent>

                  <TabsContent value="effects" className="space-y-6">
                    {/* Headlight Color */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-accent" />
                        <Label className="font-semibold text-foreground">Headlight Color</Label>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {GLOW_COLORS.map((color) => (
                            <button
                                key={`headlight-${color.value}`}
                                onClick={() => setConfig({ ...config, headlightColor: color.value })}
                                className={`relative h-12 rounded-md border-2 transition-all hover:scale-105 ${
                                    config.headlightColor === color.value
                                        ? "border-accent ring-2 ring-accent/50 glow-cyan"
                                        : "border-border/50"
                                }`}
                                style={{
                                  backgroundColor: color.value,
                                  boxShadow: config.headlightColor === color.value ? `0 0 20px ${color.value}` : "none",
                                }}
                                title={color.name}
                            >
                              {config.headlightColor === color.value && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Lightbulb className="w-4 h-4 text-background" />
                                  </div>
                              )}
                            </button>
                        ))}
                      </div>
                    </div>

                    {/* Underglow */}
                    <div className="space-y-4 p-4 rounded-md border border-border/50 bg-secondary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-accent" />
                          <Label htmlFor="underglow" className="font-semibold text-foreground">
                            Underglow
                          </Label>
                        </div>
                        <Switch
                            id="underglow"
                            checked={config.underglow}
                            onCheckedChange={(checked) => setConfig({ ...config, underglow: checked })}
                        />
                      </div>

                      {config.underglow && (
                          <div className="space-y-3 pt-2">
                            <Label className="text-sm text-muted-foreground">Underglow Color</Label>
                            <div className="grid grid-cols-4 gap-2">
                              {GLOW_COLORS.map((color) => (
                                  <button
                                      key={`underglow-${color.value}`}
                                      onClick={() => setConfig({ ...config, underglowColor: color.value })}
                                      className={`relative h-10 rounded-md border-2 transition-all hover:scale-105 ${
                                          config.underglowColor === color.value
                                              ? "border-accent ring-2 ring-accent/50"
                                              : "border-border/50"
                                      }`}
                                      style={{
                                        backgroundColor: color.value,
                                        boxShadow: config.underglowColor === color.value ? `0 0 15px ${color.value}` : "none",
                                      }}
                                      title={color.name}
                                  />
                              ))}
                            </div>
                          </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Action Button */}
                <div className="mt-6 pt-6 border-t border-border/50 space-y-3">
                  <Button
                      onClick={onSaveConfig}
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold glow-cyan"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                  </Button>

                  <Button
                      onClick={onToggleDrive}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold glow-cyan"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Driving
                  </Button>
                </div>
              </>
          ) : isDriving ? (
              <div className="h-full flex items-center justify-center">
                <Button
                    onClick={onToggleDrive}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold glow-red p-3 rounded-lg"
                    title="Stop Driving"
                >
                  <Square className="w-6 h-6" />
                </Button>
              </div>
          ) : (
              <div className="h-full flex items-center justify-center">
                <Button
                    onClick={onTogglePanel}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold glow-blue p-3 rounded-lg"
                    title="Show Panel"
                >
                  Show Panel
                </Button>
              </div>
          )}
        </div>
      </div>
  )
}
