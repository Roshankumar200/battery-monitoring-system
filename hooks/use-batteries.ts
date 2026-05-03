import useSWR from "swr"

type RuntimeWindow = Window & {
  ENV?: { NEXT_PUBLIC_API_URL?: string }
  __BMS_ENV__?: { NEXT_PUBLIC_API_URL?: string }
}

const API_BASE =
  (typeof window !== "undefined" && (window as RuntimeWindow).__BMS_ENV__?.NEXT_PUBLIC_API_URL) ||
  (typeof window !== "undefined" && (window as RuntimeWindow).ENV?.NEXT_PUBLIC_API_URL) ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
const IS_EXTERNAL_API = !!API_BASE

function buildUrl(path: string, params?: Record<string, string | number | undefined>) {
  const base = API_BASE ? API_BASE.replace(/\/$/, "") : ""
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`
  const usp = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue
      usp.append(k, String(v))
    }
  }
  const qs = usp.toString()
  return qs ? `${url}?${qs}` : url
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function unwrapArray<T = any>(raw: any): T[] {
  if (!raw) return []
  // DRF paginated response: { count, next, previous, results }
  if (raw.results && Array.isArray(raw.results)) return raw.results as T[]
  // DRF returns arrays directly for non-paginated endpoints
  if (Array.isArray(raw)) return raw as T[]
  // Legacy Next.js routes wrapper
  if (raw.data && Array.isArray(raw.data)) return raw.data as T[]
  return []
}

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

export function useBatteries(stationId?: string) {
  const { data, error, isLoading } = useSWR<any>(
    buildUrl("/api/batteries", stationId ? { station_id: stationId } : undefined),
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5000, // Refresh every 5 seconds
    },
  )

  const batteries = unwrapArray<any>(data).map((d: any) => ({
    stationId: d.station_id ?? d.stationId ?? d.station ?? stationId ?? "",
    batteryId: d.battery_id ?? d.batteryId ?? d.battery ?? "",
    voltage: Number(d.voltage ?? 0),
    temperature: Number(d.temperature ?? 0),
    soc: Number(d.soc ?? 0),
    soh: Number(d.soh ?? 0),
    imp: Number(d.imp ?? d.impedance ?? 0),
    timestamp: d.timestamp ?? d.created_at ?? new Date().toISOString(),
  })) as BatteryData[]

  return {
    batteries,
    isLoading,
    error,
  }
}

export function useBatteryHistory(stationId: string, batteryId: string, limit = 100) {
  const { data, error, isLoading } = useSWR<any>(
    buildUrl("/api/batteries/history", { station_id: stationId, battery_id: batteryId, limit }),
    fetcher,
    {
      revalidateOnFocus: false,
    },
  )

  return {
    history: unwrapArray<BatteryData>(data),
    isLoading,
    error,
  }
}

interface BatteryAlert {
  id: string
  stationId: string
  batteryId: string
  severity: "critical" | "warning" | "info"
  message: string
  timestamp: string
  acknowledged: boolean
  acknowledged_by?: string
  acknowledged_at?: string
}

export function useBatteryAlerts(stationId?: string, severity?: string) {
  const { data, error, isLoading, mutate } = useSWR<any>(
    buildUrl("/api/alerts", {
      ...(stationId ? { station_id: stationId } : {}),
      ...(severity ? { severity } : {}),
    }),
    fetcher,
    {
      revalidateOnFocus: false,
      refreshInterval: 5000,
    },
  )

  return {
    alerts: unwrapArray<any>(data).map((d: any) => ({
        id: d.id ?? "",
        stationId: d.station_id ?? d.stationId ?? d.station ?? "",
        batteryId: d.battery_id ?? d.batteryId ?? d.battery ?? "",
        severity: d.severity,
        message: d.message,
        timestamp: d.alert_time ?? d.timestamp ?? d.created_at,
        acknowledged: Boolean(d.acknowledged),
        acknowledged_by: d.acknowledged_by ?? "",
        acknowledged_at: d.acknowledged_at ?? "",
      })) as BatteryAlert[],
    isLoading,
    error,
    mutate,
  }
}

// ── Alert Acknowledgment ──────────────────────────────────────────────────────

export async function acknowledgeAlert(alertId: string, acknowledgedBy?: string) {
  const url = buildUrl(`/api/alerts/${alertId}/acknowledge/`)
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acknowledged_by: acknowledgedBy || "operator" }),
  })
  if (!res.ok) throw new Error(`Failed to acknowledge alert: ${res.status}`)
  return res.json()
}

export async function acknowledgeAlertsBulk(ids: string[], acknowledgedBy?: string) {
  const url = buildUrl(`/api/alerts/acknowledge_bulk/`)
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, acknowledged_by: acknowledgedBy || "operator" }),
  })
  if (!res.ok) throw new Error(`Failed to bulk-acknowledge: ${res.status}`)
  return res.json()
}

// ── Station Threshold API ─────────────────────────────────────────────────────

export interface StationThresholds {
  station_id: string
  voltage_min: number
  voltage_max: number
  temperature_min: number
  temperature_max: number
  soc_min: number
  soh_min: number
  imp_max: number
}

export interface GlobalNotificationSettings {
  id?: string
  scope?: string
  alert_email: string
  csv_email: string
  alert_phone: string
  email_enabled: boolean
  sms_enabled: boolean
  csv_enabled: boolean
  created_at?: string
  updated_at?: string
}

export interface StationNotificationSettings extends GlobalNotificationSettings {
  station?: string
  station_id?: string
}

export function useStationThresholds(stationId?: string) {
  const url = stationId ? buildUrl(`/api/stations/${encodeURIComponent(stationId)}/thresholds/`) : null
  const { data, error, isLoading, mutate } = useSWR<StationThresholds | null>(url, fetcher, {
    revalidateOnFocus: false,
  })
  return { thresholds: data || null, isLoading, error, mutate }
}

export async function updateStationThresholds(stationId: string, payload: Partial<StationThresholds>) {
  const url = buildUrl(`/api/stations/${encodeURIComponent(stationId)}/thresholds/`)
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to update thresholds: ${res.status}`)
  return res.json()
}

export function useGlobalNotificationSettings() {
  const { data, error, isLoading, mutate } = useSWR<GlobalNotificationSettings | null>(
    buildUrl("/api/notification-settings/global/"),
    fetcher,
    { revalidateOnFocus: false },
  )
  return { settings: data || null, isLoading, error, mutate }
}

export function useStationNotificationSettings(stationId?: string) {
  const url = stationId ? buildUrl(`/api/stations/${encodeURIComponent(stationId)}/notification-settings/`) : null
  const { data, error, isLoading, mutate } = useSWR<StationNotificationSettings | null>(url, fetcher, {
    revalidateOnFocus: false,
  })
  return { settings: data || null, isLoading, error, mutate }
}

export async function updateGlobalNotificationSettings(payload: Partial<GlobalNotificationSettings>) {
  const url = buildUrl("/api/notification-settings/global/")
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to update global notification settings: ${res.status}`)
  return res.json()
}

export async function updateStationNotificationSettings(
  stationId: string,
  payload: Partial<StationNotificationSettings>,
) {
  const url = buildUrl(`/api/stations/${encodeURIComponent(stationId)}/notification-settings/`)
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to update station notification settings: ${res.status}`)
  return res.json()
}

export async function sendNotificationDigest(payload?: { mode?: "hourly" | "all"; hours?: number; station_id?: string }) {
  const url = buildUrl("/api/notifications/digest/")
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || { mode: "all" }),
  })
  if (!res.ok) throw new Error(`Failed to send notification digest: ${res.status}`)
  return res.json()
}

// ── Station configuration types and hooks ─────────────────────────────────────

export interface StationConfig {
  id?: string
  station_id: string
  name: string
  facility?: string
  building?: string
  zone?: string
  location?: string
  mqtt_broker: string
  mqtt_port: number
  mqtt_topic: string
  mqtt_username?: string
  mqtt_password?: string
  voltage_min?: number
  voltage_max?: number
  temperature_min?: number
  temperature_max?: number
  soc_min?: number
  soh_min?: number
  imp_max?: number
}

export function useStations() {
  const { data, error, isLoading, mutate } = useSWR<any>(
    buildUrl("/api/stations/"),
    fetcher,
    {
    revalidateOnFocus: false,
    },
  )
  return { stations: unwrapArray<StationConfig>(data), isLoading, error, mutate }
}

export function useStation(stationId?: string) {
  const url = stationId ? buildUrl(`/api/stations/${encodeURIComponent(stationId)}/`) : null
  const { data, error, isLoading, mutate } = useSWR<StationConfig | null>(url, fetcher, {
    revalidateOnFocus: false,
  })
  return { station: data || null, isLoading, error, mutate }
}

export async function updateStationConfig(stationId: string, payload: Partial<StationConfig>) {
  const url = buildUrl(`/api/stations/${encodeURIComponent(stationId)}/`)
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to update station: ${res.status}`)
  return res.json()
}

export async function createStation(payload: StationConfig) {
  const url = buildUrl(`/api/stations/`)
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to create station: ${res.status}`)
  return res.json()
}

export async function deleteStation(stationId: string) {
  const url = buildUrl(`/api/stations/${encodeURIComponent(stationId)}/`)
  const res = await fetch(url, { method: "DELETE" })
  if (!res.ok && res.status !== 204) throw new Error(`Failed to delete station: ${res.status}`)
  return true
}
