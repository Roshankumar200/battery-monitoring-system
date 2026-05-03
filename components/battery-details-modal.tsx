"use client"

import { useState, useEffect } from "react"
import { X, Download } from "lucide-react"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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

interface BatteryDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  batteryData: BatteryData | null
  historyData?: Array<BatteryData>
}

export function BatteryDetailsModal({ isOpen, onClose, batteryData, historyData = [] }: BatteryDetailsModalProps) {
  const [chartData, setChartData] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (historyData && historyData.length > 0) {
      const formattedData = historyData.map((item) => ({
        time: new Date(item.timestamp).toLocaleTimeString(),
        voltage: Number.parseFloat((item.voltage / 1000).toFixed(2)),
        temperature: Number.parseFloat((item.temperature / 10).toFixed(1)),
        soc: item.soc,
        soh: item.soh,
        imp: Number.parseFloat((item.imp / 1000).toFixed(2)),
        timestamp: item.timestamp,
      })).reverse() // Reverse to show oldest data on the left to newest on the right
      setChartData(formattedData)

      const voltages = historyData.map((b) => b.voltage / 1000)
      const temps = historyData.map((b) => b.temperature / 10)
      const socs = historyData.map((b) => b.soc)
      const sohs = historyData.map((b) => b.soh)
      const imps = historyData.map((b) => b.imp / 1000)

      setStats({
        voltage: {
          min: Math.min(...voltages).toFixed(2),
          max: Math.max(...voltages).toFixed(2),
          avg: (voltages.reduce((a, b) => a + b, 0) / voltages.length).toFixed(2),
          current: (historyData[historyData.length - 1].voltage / 1000).toFixed(2),
        },
        temperature: {
          min: Math.min(...temps).toFixed(1),
          max: Math.max(...temps).toFixed(1),
          avg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
          current: (historyData[historyData.length - 1].temperature / 10).toFixed(1),
        },
        soc: {
          min: Math.min(...socs),
          max: Math.max(...socs),
          avg: Math.round(socs.reduce((a, b) => a + b, 0) / socs.length),
          current: historyData[historyData.length - 1].soc,
        },
        soh: {
          min: Math.min(...sohs),
          max: Math.max(...sohs),
          avg: Math.round(sohs.reduce((a, b) => a + b, 0) / sohs.length),
          current: historyData[historyData.length - 1].soh,
        },
        imp: {
          min: Math.min(...imps).toFixed(2),
          max: Math.max(...imps).toFixed(2),
          avg: (imps.reduce((a, b) => a + b, 0) / imps.length).toFixed(2),
          current: (historyData[historyData.length - 1].imp / 1000).toFixed(2),
        },
      })
    }
  }, [historyData])

  const exportBatteryCSV = () => {
    if (!batteryData || historyData.length === 0) return

    const headers = [
      "Timestamp",
      "Station ID",
      "Battery ID",
      "Voltage (V)",
      "Temperature (°C)",
      "SOC (%)",
      "SOH (%)",
      "Impedance (Ω)",
    ]

    const rows = historyData.map((b) => [
      new Date(b.timestamp).toISOString(),
      b.stationId,
      b.batteryId,
      (b.voltage / 1000).toFixed(3),
      (b.temperature / 10).toFixed(2),
      b.soc,
      b.soh,
      (b.imp / 1000).toFixed(3),
    ])

    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute("download", `${batteryData.stationId}-${batteryData.batteryId}-data.csv`)
    link.style.visibility = "hidden"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!isOpen || !batteryData) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
        <div className="bg-card border border-border rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-wider">
                BATTERY DIAGNOSTICS - {batteryData.stationId}/{batteryData.batteryId}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">{new Date(batteryData.timestamp).toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={exportBatteryCSV}
                disabled={historyData.length === 0}
                className="gap-2 bg-orange-600 hover:bg-orange-700 text-white font-mono text-xs"
              >
                <Download className="w-4 h-4" />
                CSV
              </Button>
              <button onClick={onClose} className="text-muted-foreground hover:text-orange-500 transition-colors p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Current Status Grid */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground tracking-wider mb-3">CURRENT STATUS</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">VOLTAGE</div>
                    <div className="text-2xl font-bold text-foreground font-mono">
                      {(batteryData.voltage / 1000).toFixed(2)}V
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">TEMPERATURE</div>
                    <div className="text-2xl font-bold text-foreground font-mono">
                      {(batteryData.temperature / 10).toFixed(1)}°C
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">SOC</div>
                    <div className="text-2xl font-bold text-foreground font-mono">{batteryData.soc}%</div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">HEALTH</div>
                    <div className="text-2xl font-bold text-foreground font-mono">{batteryData.soh}%</div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground mb-1">IMPEDANCE</div>
                    <div className="text-2xl font-bold text-foreground font-mono">
                      {(batteryData.imp / 1000).toFixed(2)}Ω
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Statistics Section */}
            {stats && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground tracking-wider mb-3">STATISTICS (Min / Avg / Max)</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-2">VOLTAGE</div>
                      <div className="space-y-1">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Min:</span>
                          <span className="text-foreground font-mono ml-1">{stats.voltage.min}V</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Avg:</span>
                          <span className="text-orange-400 font-mono ml-1">{stats.voltage.avg}V</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Max:</span>
                          <span className="text-foreground font-mono ml-1">{stats.voltage.max}V</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-2">TEMPERATURE</div>
                      <div className="space-y-1">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Min:</span>
                          <span className="text-foreground font-mono ml-1">{stats.temperature.min}°C</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Avg:</span>
                          <span className="text-orange-400 font-mono ml-1">{stats.temperature.avg}°C</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Max:</span>
                          <span className="text-foreground font-mono ml-1">{stats.temperature.max}°C</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-2">SOC</div>
                      <div className="space-y-1">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Min:</span>
                          <span className="text-foreground font-mono ml-1">{stats.soc.min}%</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Avg:</span>
                          <span className="text-orange-400 font-mono ml-1">{stats.soc.avg}%</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Max:</span>
                          <span className="text-foreground font-mono ml-1">{stats.soc.max}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-2">HEALTH</div>
                      <div className="space-y-1">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Min:</span>
                          <span className="text-foreground font-mono ml-1">{stats.soh.min}%</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Avg:</span>
                          <span className="text-orange-400 font-mono ml-1">{stats.soh.avg}%</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Max:</span>
                          <span className="text-foreground font-mono ml-1">{stats.soh.max}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground mb-2">IMPEDANCE</div>
                      <div className="space-y-1">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Min:</span>
                          <span className="text-foreground font-mono ml-1">{stats.imp.min}Ω</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Avg:</span>
                          <span className="text-orange-400 font-mono ml-1">{stats.imp.avg}Ω</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Max:</span>
                          <span className="text-foreground font-mono ml-1">{stats.imp.max}Ω</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Charts Section */}
            {chartData.length > 0 && (
              <>
                {/* Voltage Chart */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-bold text-muted-foreground tracking-wider">VOLTAGE TREND</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="time"
                          stroke="#9CA3AF"
                          style={{ fontSize: "10px" }}
                          tick={{ fill: "#9CA3AF" }}
                        />
                        <YAxis stroke="#9CA3AF" style={{ fontSize: "10px" }} tick={{ fill: "#9CA3AF" }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #4B5563" }}
                          labelStyle={{ color: "#FFFFFF" }}
                        />
                        <Line type="monotone" dataKey="voltage" stroke="#F97316" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Temperature Chart */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-bold text-muted-foreground tracking-wider">
                      TEMPERATURE TREND
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="time"
                          stroke="#9CA3AF"
                          style={{ fontSize: "10px" }}
                          tick={{ fill: "#9CA3AF" }}
                        />
                        <YAxis stroke="#9CA3AF" style={{ fontSize: "10px" }} tick={{ fill: "#9CA3AF" }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #4B5563" }}
                          labelStyle={{ color: "#FFFFFF" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="temperature"
                          fill="#EF4444"
                          fillOpacity={0.2}
                          stroke="#EF4444"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* SOC & Health Chart */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-bold text-muted-foreground tracking-wider">
                      STATE OF CHARGE & HEALTH TREND
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="time"
                          stroke="#9CA3AF"
                          style={{ fontSize: "10px" }}
                          tick={{ fill: "#9CA3AF" }}
                        />
                        <YAxis stroke="#9CA3AF" style={{ fontSize: "10px" }} tick={{ fill: "#9CA3AF" }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #4B5563" }}
                          labelStyle={{ color: "#FFFFFF" }}
                        />
                        <Bar dataKey="soc" fill="#10B981" />
                        <Bar dataKey="soh" fill="#F97316" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}

            {/* No Data Message */}
            {chartData.length === 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    No historical data available yet. Data will be populated as it arrives.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
