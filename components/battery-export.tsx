"use client"

import { Download } from "lucide-react"
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

interface BatteryExportProps {
  batteries: BatteryData[]
  fileName?: string
}

export function BatteryExport({ batteries, fileName = "battery-data.csv" }: BatteryExportProps) {
  const exportToCSV = () => {
    if (batteries.length === 0) return

    // CSV Header
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

    // CSV Rows
    const rows = batteries.map((b) => [
      new Date(b.timestamp).toISOString(),
      b.stationId,
      b.batteryId,
      (b.voltage / 1000).toFixed(3),
      (b.temperature / 10).toFixed(2),
      b.soc,
      b.soh,
      (b.imp / 1000).toFixed(3),
    ])

    // Create CSV content
    const csvContent = [headers.join(","), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n")

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute("download", fileName)
    link.style.visibility = "hidden"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Button
      onClick={exportToCSV}
      disabled={batteries.length === 0}
      className="gap-2 bg-orange-600 hover:bg-orange-700 text-white font-mono text-xs tracking-wide"
    >
      <Download className="w-4 h-4" />
      EXPORT CSV ({batteries.length})
    </Button>
  )
}
