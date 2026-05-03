"use client"

import { useState, useMemo, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, Thermometer, Activity, AlertTriangle, CheckCircle, TrendingUp, Download, ArrowLeft, Settings } from "lucide-react"
import { ActivityNotification } from "@/components/activity-notification"
import { BatteryMiniCard } from "@/components/battery-mini-card"
import { StationSummaryCard } from "@/components/station-summary-card"
import { StationConfigModal } from "@/components/station-config-modal"
import { BatteryDetailsModal } from "@/components/battery-details-modal"
import { useBatteryAlerts, useBatteryHistory, useStation, useBatteries, acknowledgeAlert } from "@/hooks/use-batteries"
import { DeleteStationDialog } from "@/components/delete-station-dialog"
import { ThresholdSettings } from "@/components/threshold-settings"

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

export default function StationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const stationId = params.stationId as string

  const [selectedBattery, setSelectedBattery] = useState<BatteryData | null>(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false)
  const [lastUpdatedIST, setLastUpdatedIST] = useState<string>("")
  const { station } = useStation(stationId)

  const stationInfo = {
    id: stationId,
    name: station?.name || `Battery Station ${stationId}`,
    location: {
      facility: station?.facility || "Facility A",
      building: station?.building || "Building 1",
      zone: station?.zone || "Main Hub",
    },
    status: "online",
    lastUpdate: new Date().toLocaleTimeString(),
  }

  const { batteries: liveBatteries } = useBatteries(stationId)
  const batteries: BatteryData[] = liveBatteries || []

  const stats = useMemo(() => {
    const count = batteries.length || 1 // avoid division by zero
    const voltageSum = batteries.reduce((sum, b) => sum + b.voltage, 0)
    const avgVoltage = voltageSum / count
    const avgTemp = batteries.reduce((sum, b) => sum + b.temperature, 0) / count
    const avgSoc = batteries.reduce((sum, b) => sum + b.soc, 0) / count
    const avgHealth = batteries.reduce((sum, b) => sum + b.soh, 0) / count
    const avgImp = batteries.reduce((sum, b) => sum + b.imp, 0) / count

    const criticalCount = batteries.filter((b) => b.soc <= 33 || b.soh <= 50 || b.temperature > 300).length
    const warningCount = batteries.filter(
      (b) =>
        (b.soc > 33 && b.soc <= 66) || (b.soh > 50 && b.soh <= 75) || (b.temperature > 290 && b.temperature <= 300),
    ).length
    const healthyCount = batteries.length - criticalCount - warningCount

    const latestTimestamp = batteries.reduce<string | null>((latest, battery) => {
      if (!latest) return battery.timestamp
      return new Date(battery.timestamp).getTime() > new Date(latest).getTime() ? battery.timestamp : latest
    }, null)

    const latestTimestampAgeMinutes = latestTimestamp
      ? (Date.now() - new Date(latestTimestamp).getTime()) / 60000
      : Number.POSITIVE_INFINITY

    let overallStatus = "online"
    if (batteries.length === 0 || !Number.isFinite(latestTimestampAgeMinutes) || latestTimestampAgeMinutes > 10) {
      overallStatus = "offline"
    } else if (criticalCount > 0 || warningCount > 0) {
      overallStatus = "warning"
    }

    return {
      avgVoltage,
  totalVoltage: voltageSum,
      avgTemp,
      avgSoc,
      avgHealth,
      avgImp,
      criticalCount,
      warningCount,
      healthyCount,
      overallStatus,
      latestTimestamp,
      uptime: "247 days",
      maintenance: "2025-05-15",
    }
  }, [batteries])

  useEffect(() => {
    if (!stats.latestTimestamp) {
      setLastUpdatedIST("")
      return
    }

    const d = new Date(stats.latestTimestamp)
    const ist = d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    setLastUpdatedIST(`${ist} IST`)
  }, [stats.latestTimestamp])

  const summaryLocation = [station?.facility, station?.building, station?.zone].filter(Boolean).join(" • ")

  const { alerts, mutate: mutateAlerts } = useBatteryAlerts(stationId)
  const { history } = useBatteryHistory(
    stationId,
    selectedBattery?.batteryId || "",
    100,
  )

  const getStatusColor = (status: string) => {
    switch (status) {
          case "online":
            return "bg-foreground/20 text-foreground"
          case "warning":
            return "bg-orange-500/20 text-orange-500"
          case "offline":
            return "bg-red-500/20 text-red-500"
          default:
            return "bg-muted/50 text-muted-foreground"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle className="w-4 h-4" />
      case "warning":
        return <AlertTriangle className="w-4 h-4" />
      case "offline":
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  const getSocColor = (soc: number) => {
    if (soc <= 33) return "border-red-500"
    if (soc <= 66) return "border-orange-500"
    return "border-green-500"
  }

  const getHealthDot = (soh: number) => {
    if (soh <= 50) return "bg-red-500"
    if (soh <= 75) return "bg-orange-500"
    return "bg-green-500"
  }

  const handleExportCSV = () => {
    let csv = "Timestamp,Station ID,Battery ID,Voltage (V),Temperature (°C),SOC (%),Health (%),Impedance (Ω)\n"

    batteries.forEach((battery) => {
      csv += `${battery.timestamp},${battery.stationId},${battery.batteryId},${(battery.voltage / 1000).toFixed(2)},${(battery.temperature / 10).toFixed(1)},${battery.soc},${battery.soh},${battery.imp}\n`
    })

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${stationId}-batteries-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Back Button and Export */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const from = search.get("from") || "/command-center"
              // Prefer going back in history if possible
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back()
                return
              }
              router.push(from)
      }}
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-mono">Back to Stations</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-wider">{stationInfo.name}</h1>
            <p className="text-xs text-muted-foreground">
              {stationInfo.location.facility} • {stationInfo.location.building}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsThresholdsOpen(true)}
            className="text-xs border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Threshold settings"
          >
            <Settings className="w-4 h-4 mr-2" />
            THRESHOLDS
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsConfigOpen(true)}
            className="text-xs"
          >
            EDIT STATION
          </Button>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteOpen(true)}
            className="text-xs"
          >
            DELETE
          </Button>
          <Button onClick={handleExportCSV} className="bg-orange-600 hover:bg-orange-700 text-white gap-2 text-xs">
            <Download className="w-4 h-4" />
            CSV EXPORT
          </Button>
        </div>
      </div>

      <StationSummaryCard
        data={{
          stationId,
          stationName: station?.name || `Battery Station ${stationId}`,
          location: summaryLocation || undefined,
          batteryCount: batteries.length,
          totalVoltage: stats.totalVoltage,
          avgVoltage: stats.avgVoltage,
          avgTemperature: stats.avgTemp,
          avgSoc: stats.avgSoc,
          avgSoh: stats.avgHealth,
          avgImp: stats.avgImp,
          criticalCount: stats.criticalCount,
          warningCount: stats.warningCount,
          status: stats.overallStatus as "online" | "warning" | "offline",
          lastUpdated: lastUpdatedIST || undefined,
        }}
      />

      {/* Station Overview - Systems-style quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Health */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground tracking-wider">SYSTEM HEALTH</p>
                <p className="text-2xl font-bold text-foreground font-mono mt-1">{stats.avgHealth.toFixed(0)}%</p>
              </div>
              <Activity className="w-8 h-8 text-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Total Voltage */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground tracking-wider">TOTAL VOLTAGE</p>
                <p className="text-2xl font-bold text-foreground font-mono mt-1">
                  {(stats.totalVoltage / 1000).toFixed(1)}V
                </p>
              </div>
              <Zap className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        {/* Batteries Count */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground tracking-wider">BATTERIES</p>
                <p className="text-2xl font-bold text-foreground font-mono mt-1">{batteries.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Critical Batteries */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground tracking-wider">CRITICAL</p>
                <p className="text-2xl font-bold text-orange-500 font-mono mt-1">{stats.criticalCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid Layout (12-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Activity Log - Left Panel (5 columns) */}
        <Card className="lg:col-span-5 bg-card border-border max-h-96">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-muted-foreground tracking-wider">STATION ACTIVITY LOG</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {alerts.map((alert: any, idx: number) => (
                <ActivityNotification
                  key={alert.id || `${alert.stationId}-${alert.batteryId}-${idx}`}
                  id={alert.id || `${alert.stationId}-${alert.batteryId}-${idx}`}
                  timestamp={new Date(alert.timestamp).toLocaleTimeString()}
                  type={alert.severity as any}
                  title={alert.severity.toUpperCase()}
                  description={alert.message}
                  station={alert.stationId}
                  battery={alert.batteryId}
                  acknowledged={alert.acknowledged}
                  onAcknowledge={
                    alert.id && !alert.acknowledged
                      ? async () => { await acknowledgeAlert(alert.id); mutateAlerts(); }
                      : undefined
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Batteries Grid - Expanded to occupy center/right (7 columns) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground tracking-wider">
                BATTERIES ({batteries.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {batteries.map((battery) => (
                  <BatteryMiniCard
                    key={battery.batteryId}
                    battery={battery}
                    selected={selectedBattery?.batteryId === battery.batteryId}
                    onClick={() => {
                      setSelectedBattery(battery)
                      setIsAnalyticsOpen(true)
                    }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Mission Activity Section */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-muted-foreground tracking-wider">STATION MISSION ACTIVITY</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="relative w-32 h-32 mb-4">
            <div className="absolute inset-0 border-2 border-foreground rounded-full opacity-60 animate-pulse"></div>
            <div className="absolute inset-2 border border-foreground rounded-full opacity-40"></div>
            <div className="absolute inset-4 border border-foreground rounded-full opacity-20"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-px bg-foreground opacity-30"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-px h-full bg-foreground opacity-30"></div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1 w-full font-mono">
            <div className="flex justify-between">
              {/* Avoid hydration mismatch from dynamic timestamps by rendering on client after mount */}
              <ClientTimestamp />
            </div>
            <div className="text-foreground">{`> [STN:${stationId}] ::: MONITORING >> ^^^ data stream active`}</div>
            <div className="text-orange-500">{`> CH#${batteries.length} | ${batteries.length}.battery.stream...xR3`}</div>
            <div className="text-foreground">{"> SENSORS LOCKED"}</div>
            <div className="text-muted-foreground">
              {'> MSG >> "...real-time monitoring initiated... all batteries tracked"'}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Modals */}
      <StationConfigModal stationId={stationId} open={isConfigOpen} onOpenChange={setIsConfigOpen} />
      <DeleteStationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        stationId={stationId}
        name={station?.name}
        onDeleted={() => {
          const from = search.get("from") || "/command-center"
          setIsDeleteOpen(false)
          router.push(from)
        }}
      />
      <BatteryDetailsModal
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        batteryData={selectedBattery}
        historyData={history}
      />
      <ThresholdSettings open={isThresholdsOpen} onOpenChange={setIsThresholdsOpen} stationId={stationId} />
    </div>
  )
}

// Renders a client-only timestamp to prevent React hydration errors due to differing server/client times
function ClientTimestamp() {
  const [now, setNow] = useState<string>("")

  useEffect(() => {
    const d = new Date()
    const ist = d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    setNow(`${ist} IST`)
  }, [])

  return (
    <span suppressHydrationWarning>{`# ${now}`}</span>
  )
}

// Analytics modal wired to backend history
function BatteryAnalyticsModal({
  open,
  onOpenChange,
  stationId,
  batteryId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  stationId: string
  batteryId?: string
}) {
  const { history, isLoading } = useBatteryHistory(stationId, batteryId || "", 100)
  // This component is unused; analytics handled via BatteryDetailsModal for consistency
  return null
}
