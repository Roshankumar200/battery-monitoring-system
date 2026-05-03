"use client"

import { useState } from "react"
import { ChevronDown, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { BatteryCard } from "./battery-card"

interface BatteryData {
  stationId: string
  batteryId: string
  voltage: number
  temperature: number
  soc: number
  soh: number
  imp: number
  timestamp: string
}

interface StationCardProps {
  stationId: string
  location: string
  batteries: BatteryData[]
  onBatteryClick?: (battery: BatteryData) => void
}

export function StationCard({ stationId, location, batteries, onBatteryClick }: StationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate station status
  const getStationStatus = () => {
    if (batteries.length === 0)
      return { status: "inactive", label: "No Batteries", icon: Clock, color: "text-muted-foreground" }

    const hasIssues = batteries.some((b) => b.soc <= 33 || b.soh <= 50 || b.temperature > 400)
    const hasWarnings = batteries.some((b) => b.soc <= 66 || b.soh <= 80)

    if (hasIssues) {
      return { status: "critical", label: "Issues Detected", icon: AlertCircle, color: "text-red-500" }
    }
    if (hasWarnings) {
      return { status: "warning", label: "Warnings", icon: AlertCircle, color: "text-yellow-500" }
    }
    return { status: "healthy", label: "Functioning Well", icon: CheckCircle, color: "text-green-500" }
  }

  const stationStatus = getStationStatus()
  const StatusIcon = stationStatus.icon

  // Calculate statistics
  const avgSoc = batteries.length > 0 ? Math.round(batteries.reduce((sum, b) => sum + b.soc, 0) / batteries.length) : 0
  const avgTemp =
    batteries.length > 0
      ? (batteries.reduce((sum, b) => sum + b.temperature, 0) / batteries.length / 10).toFixed(1)
      : "0"
  const avgHealth =
    batteries.length > 0 ? Math.round(batteries.reduce((sum, b) => sum + b.soh, 0) / batteries.length) : 0
  const criticalCount = batteries.filter((b) => b.soc <= 33 || b.soh <= 50).length

  return (
  <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/30 transition-colors">
      {/* Station Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
  className="p-4 cursor-pointer hover:bg-muted/60 transition-colors border-b border-border"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-foreground tracking-wider font-mono">{stationId}</h3>
              <StatusIcon className={`w-4 h-4 ${stationStatus.color}`} />
            </div>
            <p className="text-xs text-muted-foreground">{location}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className={`text-xs font-medium ${stationStatus.color}`}>{stationStatus.label}</p>
              <p className="text-xs text-muted-foreground">{batteries.length} batteries</p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {/* Station Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-muted/60 p-2 rounded text-center">
            <div className="text-xs text-muted-foreground">Avg SOC</div>
            <div className="text-sm font-bold text-foreground">{avgSoc}%</div>
          </div>
          <div className="bg-muted/60 p-2 rounded text-center">
            <div className="text-xs text-muted-foreground">Avg Temp</div>
            <div className="text-sm font-bold text-foreground">{avgTemp}°C</div>
          </div>
          <div className="bg-muted/60 p-2 rounded text-center">
            <div className="text-xs text-muted-foreground">Avg Health</div>
            <div className="text-sm font-bold text-foreground">{avgHealth}%</div>
          </div>
          <div className="bg-muted/60 p-2 rounded text-center">
            <div className="text-xs text-muted-foreground">Critical</div>
            <div className={`text-sm font-bold ${criticalCount > 0 ? "text-red-400" : "text-green-400"}`}>
              {criticalCount}
            </div>
          </div>
        </div>
      </div>

      {/* Batteries Grid - Expandable */}
      {isExpanded && batteries.length > 0 && (
  <div className="p-4 bg-muted border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {batteries.map((battery) => (
              <div key={`${battery.stationId}-${battery.batteryId}`}>
                <BatteryCard data={battery} onClick={() => onBatteryClick?.(battery)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {isExpanded && batteries.length === 0 && (
  <div className="p-4 bg-muted border-t border-border text-center text-muted-foreground text-xs">
          No batteries configured for this station
        </div>
      )}
    </div>
  )
}
