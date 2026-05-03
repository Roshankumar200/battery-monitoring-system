"use client"

import { Activity, Thermometer, Zap } from "lucide-react"

type Battery = {
  stationId: string
  batteryId: string
  voltage: number
  temperature: number
  soc: number
  soh: number
  imp: number
  timestamp: string
}

export function BatteryMiniCard({
  battery,
  selected = false,
  onClick,
}: {
  battery: Battery
  selected?: boolean
  onClick?: () => void
}) {
  const { batteryId, voltage, temperature, soc, soh, imp } = battery

  const status = (() => {
    const crit = soc <= 33 || soh <= 50 || temperature > 300
    const warn = (soc > 33 && soc <= 66) || (soh > 50 && soh <= 75) || (temperature > 290 && temperature <= 300)
    if (crit) return "CRIT"
    if (warn) return "WARN"
    return "OK"
  })()

  const pillClass =
    status === "OK"
      ? "bg-foreground/10 text-foreground"
      : status === "WARN"
      ? "bg-orange-500/10 text-orange-500"
      : "bg-red-500/10 text-red-500"

  const borderClass = soc <= 33 ? "border-red-500" : soc <= 66 ? "border-orange-500" : "border-green-500"
  const healthBar = Math.max(0, Math.min(soh, 100))
  const socBar = soc
  const tempBar = Math.min((temperature / 350) * 100, 100)
  const voltBar = Math.min((voltage / 13000) * 100, 100)

  // In systems theme, main health bar is a strong foreground bar on muted track
  const healthColor = "bg-foreground"
  const tempColor = temperature > 300 ? "bg-red-500" : "bg-orange-500"

  return (
    <div
      onClick={onClick}
      className={`p-2.5 border-2 rounded cursor-pointer transition-colors ${borderClass} ${
        selected ? "bg-muted" : "bg-muted hover:bg-muted/80"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono font-bold tracking-wider text-foreground">{batteryId}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border border-border font-mono ${pillClass}`}>{status}</span>
      </div>

      {/* System Health */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground tracking-wider whitespace-nowrap">
          <span>SYSTEM HEALTH</span>
          <span className="text-foreground font-mono tabular-nums">{soh}%</span>
        </div>
        <div className="w-full bg-muted rounded h-1 mt-1">
          <div className={`h-1 rounded ${healthColor}`} style={{ width: `${healthBar}%` }} />
        </div>
      </div>

      {/* Mini metrics row */}
      <div className="grid grid-cols-3 gap-2">
        {/* Voltage */}
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground tracking-wider">
            <Zap className="w-3 h-3" />VOLT
          </div>
          <div className="text-[10px] text-foreground font-mono mt-0.5">{(voltage / 1000).toFixed(1)}V</div>
          <div className="w-full bg-muted rounded h-1 mt-1">
            <div className="h-1 rounded bg-orange-500" style={{ width: `${voltBar}%` }} />
          </div>
        </div>

        {/* Temp */}
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground tracking-wider">
            <Thermometer className="w-3 h-3" />TEMP
          </div>
          <div className="text-[10px] text-foreground font-mono mt-0.5">{(temperature / 10).toFixed(1)}°C</div>
          <div className="w-full bg-muted rounded h-1 mt-1">
            <div className={`h-1 rounded ${tempColor}`} style={{ width: `${tempBar}%` }} />
          </div>
        </div>

        {/* SOC */}
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground tracking-wider">
            <Activity className="w-3 h-3" />SOC
          </div>
          <div className="text-[10px] text-foreground font-mono mt-0.5">{soc}%</div>
          <div className="w-full bg-muted rounded h-1 mt-1">
            <div className="h-1 rounded bg-blue-500" style={{ width: `${socBar}%` }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted-foreground">Ω:</span>
        <span className="text-foreground">{imp}Ω</span>
      </div>
    </div>
  )
}
