"use client"

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

interface BatteryStatisticsProps {
  batteries: BatteryData[]
  selectedBattery: BatteryData | null
}

export function BatteryStatistics({ batteries, selectedBattery }: BatteryStatisticsProps) {
  if (!selectedBattery) return null

  const batteryHistory = batteries.filter(
    (b) => b.stationId === selectedBattery.stationId && b.batteryId === selectedBattery.batteryId,
  )

  if (batteryHistory.length === 0) return null

  // Prepare chart data
  const chartData = batteryHistory.map((b, index) => ({
    idx: index,
    voltage: (b.voltage / 1000).toFixed(1),
    temperature: (b.temperature / 10).toFixed(1),
    soc: b.soc,
    soh: b.soh,
    timestamp: new Date(b.timestamp).toLocaleTimeString(),
  })).reverse() // Reverse to show oldest data on the left to newest on the right

  // Calculate statistics
  const voltages = batteryHistory.map((b) => b.voltage / 1000)
  const temps = batteryHistory.map((b) => b.temperature / 10)
  const socs = batteryHistory.map((b) => b.soc)
  const sohs = batteryHistory.map((b) => b.soh)

  const stats = {
    voltage: {
      min: Math.min(...voltages).toFixed(2),
      max: Math.max(...voltages).toFixed(2),
      avg: (voltages.reduce((a, b) => a + b, 0) / voltages.length).toFixed(2),
    },
    temperature: {
      min: Math.min(...temps).toFixed(1),
      max: Math.max(...temps).toFixed(1),
      avg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
    },
    soc: {
      min: Math.min(...socs),
      max: Math.max(...socs),
      avg: Math.round(socs.reduce((a, b) => a + b, 0) / socs.length),
    },
    soh: {
      min: Math.min(...sohs),
      max: Math.max(...sohs),
      avg: Math.round(sohs.reduce((a, b) => a + b, 0) / sohs.length),
    },
  }

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-2">VOLTAGE</div>
            <div className="text-lg font-bold text-foreground font-mono mb-1">{stats.voltage.avg}V</div>
            <div className="text-xs text-muted-foreground">
              Min: {stats.voltage.min}V | Max: {stats.voltage.max}V
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-2">TEMPERATURE</div>
            <div className="text-lg font-bold text-foreground font-mono mb-1">{stats.temperature.avg}°C</div>
            <div className="text-xs text-muted-foreground">
              Min: {stats.temperature.min}°C | Max: {stats.temperature.max}°C
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-2">SOC</div>
            <div className="text-lg font-bold text-foreground font-mono mb-1">{stats.soc.avg}%</div>
            <div className="text-xs text-muted-foreground">
              Min: {stats.soc.min}% | Max: {stats.soc.max}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-2">HEALTH</div>
            <div className="text-lg font-bold text-foreground font-mono mb-1">{stats.soh.avg}%</div>
            <div className="text-xs text-muted-foreground">
              Min: {stats.soh.min}% | Max: {stats.soh.max}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-muted-foreground tracking-wider">VOLTAGE TREND</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="timestamp" stroke="#9CA3AF" style={{ fontSize: "10px" }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: "10px" }} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #4B5563" }} />
              <Line type="monotone" dataKey="voltage" stroke="#F97316" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-muted-foreground tracking-wider">TEMPERATURE TREND</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="timestamp" stroke="#9CA3AF" style={{ fontSize: "10px" }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: "10px" }} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #4B5563" }} />
              <Area
                type="monotone"
                dataKey="temperature"
                fill="#EF4444"
                fillOpacity={0.2}
                stroke="#EF4444"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-muted-foreground tracking-wider">SOC & HEALTH STATUS</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="timestamp" stroke="#9CA3AF" style={{ fontSize: "10px" }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: "10px" }} />
              <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #4B5563" }} />
              <Bar dataKey="soc" fill="#10B981" />
              <Bar dataKey="soh" fill="#F97316" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
