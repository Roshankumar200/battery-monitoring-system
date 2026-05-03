"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, AlertTriangle, Settings, Activity, Server, Trash2 } from "lucide-react"
import { ReactNode } from "react"

export interface BatteryData {
  stationId: string
  batteryId: string
  voltage: number
  temperature: number
  soc: number
  soh: number
  imp: number
  timestamp: string
}

export type StationStatus = "online" | "warning" | "offline"

function getStatusBadgeClass(status: StationStatus) {
  switch (status) {
    case "online":
      return "bg-foreground/20 text-foreground"
    case "warning":
      return "bg-orange-500/20 text-orange-500"
    case "offline":
    default:
      return "bg-red-500/20 text-red-500"
  }
}

function getStatusIcon(status: StationStatus) {
  switch (status) {
    case "online":
      return <CheckCircle className="w-4 h-4" />
    case "warning":
      return <AlertTriangle className="w-4 h-4" />
    case "offline":
    default:
      return <Activity className="w-4 h-4" />
  }
}

function getHealthColor(health: number) {
  if (health >= 95) return "text-foreground"
  if (health >= 85) return "text-foreground"
  if (health >= 70) return "text-orange-500"
  return "text-red-500"
}

export function StationSystemCard({
  stationId,
  location,
  batteries,
  href,
  actions,
}: {
  stationId: string
  location?: string
  batteries: BatteryData[]
  href?: string
  actions?: ReactNode
}) {
  const total = batteries.length
  const avgSoc = total ? Math.round(batteries.reduce((s, b) => s + b.soc, 0) / total) : 0
  const avgSoh = total ? Math.round(batteries.reduce((s, b) => s + b.soh, 0) / total) : 0
  const criticalCount = batteries.filter((b) => b.soc <= 33 || b.soh <= 50 || b.temperature > 400).length
  const criticalPct = total ? Math.round((criticalCount / total) * 100) : 0

  const status: StationStatus = total === 0 ? "offline" : criticalCount > 0 ? "warning" : "online"
  const health = avgSoh // interpret health as avg SOH for stations

  const content = (
    <Card className="bg-card border-border hover:border-orange-500/50 transition-colors cursor-pointer h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6" />
            <div>
              <CardTitle className="text-sm font-bold text-foreground tracking-wider">{stationId}</CardTitle>
              {location ? <p className="text-xs text-muted-foreground">{location}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <Badge className={getStatusBadgeClass(status)}>{status.toUpperCase()}</Badge>
            {actions}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">STATION HEALTH</span>
          <span className={`text-sm font-bold font-mono ${getHealthColor(health)}`}>{health}%</span>
        </div>
        <Progress value={health} className="h-2" />

        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground mb-1">SOC AVG</div>
            <div className="text-foreground font-mono">{avgSoc}%</div>
            <div className="w-full bg-muted rounded-full h-1 mt-1">
              <div className="bg-orange-500 h-1 rounded-full transition-all duration-300" style={{ width: `${avgSoc}%` }}></div>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">HEALTH AVG</div>
            <div className="text-foreground font-mono">{avgSoh}%</div>
            <div className="w-full bg-muted rounded-full h-1 mt-1">
              <div className="bg-orange-500 h-1 rounded-full transition-all duration-300" style={{ width: `${avgSoh}%` }}></div>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">CRITICAL</div>
            <div className="text-foreground font-mono">{criticalPct}%</div>
            <div className="w-full bg-muted rounded-full h-1 mt-1">
              <div className="bg-orange-500 h-1 rounded-full transition-all duration-300" style={{ width: `${criticalPct}%` }}></div>
            </div>
          </div>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Batteries:</span>
            <span className="text-foreground font-mono">{total}</span>
          </div>
          {location ? (
            <div className="flex justify-between">
              <span>Location:</span>
              <span className="text-foreground">{location}</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

export default StationSystemCard
