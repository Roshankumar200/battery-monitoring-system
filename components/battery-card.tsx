"use client"
import { Zap, Thermometer } from "lucide-react"

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

interface BatteryCardProps {
  data: BatteryData
  onClick?: () => void
  isClickable?: boolean
}

export function BatteryCard({ data, onClick, isClickable = true }: BatteryCardProps) {
  const getBorderColor = () => {
    if (data.soc <= 33) return "border-red-500 bg-red-500/5"
    if (data.soc <= 66) return "border-yellow-500 bg-yellow-500/5"
    return "border-green-500 bg-green-500/5"
  }

  const getHealthColor = () => {
    if (data.soh <= 50) return "bg-red-500"
    if (data.soh <= 80) return "bg-yellow-500"
    return "bg-green-500"
  }

  const voltageV = (data.voltage / 1000).toFixed(1)
  const temperatureC = (data.temperature / 10).toFixed(1)
  const impedanceOhms = (data.imp / 1000).toFixed(2)

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`p-2.5 rounded border-2 transition-all ${getBorderColor()} ${
        isClickable ? "cursor-pointer hover:shadow-lg hover:shadow-orange-500/20" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-2">
  <div className="text-xs text-muted-foreground font-mono tracking-wide truncate flex-1 pr-1">
          {data.stationId}/{data.batteryId}
        </div>
        <div className={`w-2 h-2 rounded-full ${getHealthColor()} flex-shrink-0`}></div>
      </div>

      <div className="space-y-1.5">
        {/* Voltage */}
        <div className="flex items-center justify-between text-xs">
          <Zap className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground mx-1">V:</span>
          <span className="font-mono text-foreground font-bold truncate">{voltageV}V</span>
        </div>

        {/* Impedance */}
        <div className="flex items-center justify-between text-xs">
          <div className="w-3 h-3 flex-shrink-0" />
          <span className="text-muted-foreground mx-1">Ω:</span>
          <span className="font-mono text-foreground font-bold truncate">{impedanceOhms}Ω</span>
        </div>

        {/* Temperature */}
        <div className="flex items-center justify-between text-xs">
          <Thermometer className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground mx-1">T:</span>
          <span className="font-mono text-foreground font-bold truncate">{temperatureC}°C</span>
        </div>

        {/* SOC with progress */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">SOC:</span>
          <span className="font-mono text-foreground font-bold">{data.soc}%</span>
        </div>

        <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-1">
          <div
            className={`h-full transition-all ${
              data.soc <= 33 ? "bg-red-500" : data.soc <= 66 ? "bg-yellow-500" : "bg-green-500"
            }`}
            style={{ width: `${data.soc}%` }}
          ></div>
        </div>
      </div>
    </div>
  )
}
