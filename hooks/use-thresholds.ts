"use client"

import { useEffect, useState } from "react"

export type BatteryThresholds = {
  voltageMin: number // V
  voltageMax: number // V
  temperatureMin: number // °C
  temperatureMax: number // °C
  socMin: number // %
  sohMin: number // %
  impMax: number // Ω
}

// Defaults matched with backend BatteryStation model defaults:
//   voltage_min=11000 mV → 11.0 V, voltage_max=13500 mV → 13.5 V
//   temperature_min=0 → 0°C, temperature_max=450 → 45°C
//   soc_min=20%, soh_min=80%, imp_max=160 mΩ → 0.160 Ω
export const DEFAULTS: BatteryThresholds = {
  voltageMin: 11.0,
  voltageMax: 13.5,
  temperatureMin: 0,
  temperatureMax: 45.0,
  socMin: 20,
  sohMin: 80,
  impMax: 0.160,
}

const LS_KEY = "bms.thresholds.v1"

/**
 * Global threshold hook (localStorage-backed).
 * Used as a fallback when no station-specific thresholds are available.
 */
export function useThresholds() {
  const [thresholds, setThresholds] = useState<BatteryThresholds>(DEFAULTS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        setThresholds({ ...DEFAULTS, ...parsed })
      }
    } catch {}
    setReady(true)
  }, [])

  const save = (next: BatteryThresholds) => {
    setThresholds(next)
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LS_KEY, JSON.stringify(next))
      }
    } catch {}
  }

  const reset = () => save(DEFAULTS)

  return { thresholds, set: save, reset, defaults: DEFAULTS, ready }
}

/**
 * Convert backend station threshold values (mV, 0.1°C, %, mΩ) to
 * human-friendly units (V, °C, %, Ω) used in the frontend.
 */
export function backendToFrontendThresholds(station: {
  voltage_min?: number
  voltage_max?: number
  temperature_min?: number
  temperature_max?: number
  soc_min?: number
  soh_min?: number
  imp_max?: number
}): BatteryThresholds {
  return {
    voltageMin: (station.voltage_min ?? 11000) / 1000,
    voltageMax: (station.voltage_max ?? 13500) / 1000,
    temperatureMin: (station.temperature_min ?? 0) / 10,
    temperatureMax: (station.temperature_max ?? 450) / 10,
    socMin: station.soc_min ?? 20,
    sohMin: station.soh_min ?? 80,
    impMax: (station.imp_max ?? 160) / 1000,
  }
}

/**
 * Convert frontend threshold values (V, °C, %, Ω) back to backend format
 * (mV, 0.1°C, %, mΩ).
 */
export function frontendToBackendThresholds(t: BatteryThresholds) {
  return {
    voltage_min: Math.round(t.voltageMin * 1000),
    voltage_max: Math.round(t.voltageMax * 1000),
    temperature_min: Math.round(t.temperatureMin * 10),
    temperature_max: Math.round(t.temperatureMax * 10),
    soc_min: Math.round(t.socMin),
    soh_min: Math.round(t.sohMin),
    imp_max: Math.round(t.impMax * 1000),
  }
}
