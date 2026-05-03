"use client"

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ActivityNotification } from "@/components/activity-notification"
import { BatteryExport } from "@/components/battery-export"
import { BatteryDetailsModal } from "@/components/battery-details-modal"
import { Button } from "@/components/ui/button"
import { CreateStationModal } from "@/components/create-station-modal"
import { ThemeToggle } from "@/components/theme-toggle"
import { useStations, useBatteries, useBatteryAlerts, acknowledgeAlert } from "@/hooks/use-batteries"
import { DeleteStationDialog } from "@/components/delete-station-dialog"
import { Trash2 } from "lucide-react"
import { StationSystemCard } from "@/components/station-system-card"

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

interface StationData {
  id: string
  location: string
}

export default function CommandCenterPage() {
  const pathname = usePathname()
  const [selectedBattery, setSelectedBattery] = useState<BatteryData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const { stations: liveStations, mutate } = useStations()
  
  // Fetch batteries for all stations
  const { batteries: allBatteriesData } = useBatteries()
  const { alerts, mutate: mutateAlerts } = useBatteryAlerts()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteStationId, setDeleteStationId] = useState<string | null>(null)
  const [deleteStationName, setDeleteStationName] = useState<string | undefined>(undefined)

  const stations: StationData[] = useMemo(
    () =>
      (liveStations || []).map((s) => ({
        id: s.station_id,
        location: [s.facility, s.building, s.zone].filter(Boolean).join(" - ") || s.name || "",
      })),
    [liveStations],
  )

  // Convert API batteries to local format
  const batteries: BatteryData[] = useMemo(() => {
    return (allBatteriesData || []).map(b => ({
      stationId: b.stationId,
      batteryId: b.batteryId,
      voltage: b.voltage,
      temperature: b.temperature,
      soc: b.soc,
      soh: b.soh,
      imp: b.imp,
      timestamp: b.timestamp,
    }))
  }, [allBatteriesData])

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId)
      mutateAlerts()
    } catch (e) {
      console.error("Failed to acknowledge:", e)
    }
  }

  const handleBatteryClick = (battery: BatteryData) => {
    setSelectedBattery(battery)
    setIsModalOpen(true)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stations Grid - Primary View */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-muted-foreground tracking-wider">BATTERY STATIONS ({stations.length})</h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="secondary" size="sm" onClick={() => setIsCreateOpen(true)}>
              NEW STATION
            </Button>
            <BatteryExport batteries={batteries} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {stations.map((station) => {
            const stationBatteries = batteries.filter((b) => b.stationId === station.id)

            const backTo = encodeURIComponent(pathname || "/command-center")
            return (
              <StationSystemCard
                key={station.id}
                stationId={station.id}
                location={station.location}
                batteries={stationBatteries}
                href={`/battery-stations/${station.id}?from=${backTo}`}
                actions={
                  <button
                    title="Delete station"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setDeleteStationId(station.id)
                      setDeleteStationName(station.location)
                      setDeleteOpen(true)
                    }}
                    className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                }
              />
            )
          })}
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Activity Log with Notifications */}
        <Card className="lg:col-span-5 bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-muted-foreground tracking-wider">ACTIVITY NOTIFICATIONS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {alerts.map((a: any, idx: number) => (
                <ActivityNotification
                  key={a.id || `${a.stationId}-${a.batteryId}-${idx}`}
                  id={a.id || `${a.stationId}-${a.batteryId}-${idx}`}
                  timestamp={new Date(a.timestamp).toLocaleTimeString()}
                  type={a.severity as any}
                  title={`${a.severity.toUpperCase()} — ${a.stationId}/${a.batteryId}`}
                  description={a.message}
                  station={a.stationId}
                  battery={a.batteryId}
                  acknowledged={a.acknowledged}
                  onAcknowledge={
                    a.id && !a.acknowledged
                      ? () => handleAcknowledge(a.id)
                      : undefined
                  }
                />
              ))}
              {alerts.length === 0 && (
                <div className="text-xs text-muted-foreground">No alerts.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agent Allocation with Locations */}
        <Card className="lg:col-span-3 bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-muted-foreground tracking-wider">STATION OVERVIEW</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="text-center bg-muted p-3 rounded">
                <div className="text-2xl font-bold text-foreground font-mono">{stations.length}</div>
                <div className="text-xs text-muted-foreground">Stations</div>
              </div>
              <div className="text-center bg-muted p-3 rounded">
                <div className="text-2xl font-bold text-foreground font-mono">{batteries.length}</div>
                <div className="text-xs text-muted-foreground">Batteries</div>
              </div>
              <div className="text-center bg-muted p-3 rounded">
                <div className="text-2xl font-bold text-orange-500 font-mono">
                  {batteries.filter((b) => b.soc <= 33 || b.soh <= 50).length}
                </div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-muted-foreground tracking-wide mb-3">LOCATIONS</div>
              {stations.map((station) => {
                const stationBatteries = batteries.filter((b) => b.stationId === station.id)
                const hasIssues = stationBatteries.some((b) => b.soc <= 33 || b.soh <= 50)

                return (
                  <div
                    key={station.id}
                    className="p-2 bg-muted rounded border border-border hover:border-foreground/20 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-foreground">{station.id}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          hasIssues ? "bg-red-500" : stationBatteries.length > 0 ? "bg-green-500" : "bg-muted-foreground"
                        }`}
                      ></span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{station.location}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Battery Statistics - Right Side */}
        <Card className="lg:col-span-4 bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-muted-foreground tracking-wider">
              {selectedBattery
                ? `${selectedBattery.stationId}/${selectedBattery.batteryId} - DETAILS`
                : "SELECT A BATTERY"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedBattery ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted p-3 rounded">
                    <div className="text-xs text-muted-foreground mb-1">Voltage</div>
                    <div className="text-lg font-bold text-foreground font-mono">
                      {(selectedBattery.voltage / 1000).toFixed(2)}V
                    </div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-xs text-muted-foreground mb-1">Temperature</div>
                    <div className="text-lg font-bold text-foreground font-mono">
                      {(selectedBattery.temperature / 10).toFixed(1)}°C
                    </div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-xs text-muted-foreground mb-1">SOC</div>
                    <div className="text-lg font-bold text-foreground font-mono">{selectedBattery.soc}%</div>
                  </div>
                  <div className="bg-muted p-3 rounded">
                    <div className="text-xs text-muted-foreground mb-1">Health</div>
                    <div className="text-lg font-bold text-foreground font-mono">{selectedBattery.soh}%</div>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full p-2 bg-orange-600 hover:bg-orange-700 text-xs font-bold text-white rounded tracking-wider transition-colors"
                >
                  VIEW FULL ANALYTICS
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-xs">Click a battery card to view detailed analytics</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Encrypted Chat Activity */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-muted-foreground tracking-wider">MISSION ACTIVITY OVERVIEW</CardTitle>
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
              <span># {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC</span>
            </div>
            <div className="text-foreground">
              {`> [SYS:G3_BMS] ::: STATUS >> ${stations.length} station(s) online, ${batteries.length} batteries tracked`}
            </div>
            <div className="text-orange-500">
              {`> ALERTS | ${alerts.filter((a: any) => !a.acknowledged).length} unresolved, ${alerts.filter((a: any) => a.severity === "critical" && !a.acknowledged).length} critical`}
            </div>
            <div className="text-foreground">
              {`> HEALTH >> avg SOC ${batteries.length > 0 ? Math.round(batteries.reduce((s, b) => s + b.soc, 0) / batteries.length) : "--"}% | avg SOH ${batteries.length > 0 ? Math.round(batteries.reduce((s, b) => s + b.soh, 0) / batteries.length) : "--"}%`}
            </div>
            <div className="text-muted-foreground">
              {`> MSG >> "${alerts.length > 0 ? (alerts[0] as any).message : "...all systems nominal... awaiting next data cycle"}"`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Battery Details Modal with Statistics */}
      <BatteryDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        batteryData={selectedBattery}
        historyData={batteries.filter(
          (b) =>
            selectedBattery && b.stationId === selectedBattery.stationId && b.batteryId === selectedBattery.batteryId,
        )}
      />
      <CreateStationModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <DeleteStationDialog
        open={deleteOpen}
        onOpenChange={(o) => setDeleteOpen(o)}
        stationId={deleteStationId || ""}
        name={deleteStationName}
        onDeleted={() => {
          setDeleteOpen(false)
          setDeleteStationId(null)
          setDeleteStationName(undefined)
          mutate()
        }}
      />
    </div>
  )
}
