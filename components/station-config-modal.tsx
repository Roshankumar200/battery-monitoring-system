"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useStation, updateStationConfig, StationConfig } from "@/hooks/use-batteries"

interface Props {
  stationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StationConfigModal({ stationId, open, onOpenChange }: Props) {
  const { station, isLoading, mutate } = useStation(stationId)
  const [form, setForm] = useState<Partial<StationConfig>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (station) {
      setForm({
        station_id: station.station_id,
        name: station.name || "",
        facility: station.facility || "",
        building: station.building || "",
        zone: station.zone || "",
        mqtt_broker: station.mqtt_broker || "",
        mqtt_port: station.mqtt_port || 1883,
        mqtt_topic: station.mqtt_topic || "",
        mqtt_username: station.mqtt_username || "",
        mqtt_password: station.mqtt_password || "",
      })
    }
  }, [station])

  async function onSave() {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      await updateStationConfig(stationId, form)
      await mutate()
      setSuccess("Saved")
      onOpenChange(false)
    } catch (e: any) {
      setError(e?.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  function onChange<K extends keyof StationConfig>(key: K, value: StationConfig[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border border-border text-card-foreground sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>Edit Station Configuration</DialogTitle>
        </DialogHeader>
        {isLoading && <div className="text-xs text-muted-foreground">Loading...</div>}
        {!isLoading && (
          <div className="space-y-6">
            {/* Identity & Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-xs text-muted-foreground">Station Name</Label>
                <Input id="name" placeholder="Station 01" value={form.name || ""} onChange={(e) => onChange("name", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="station_id" className="text-xs text-muted-foreground">Station ID</Label>
                <Input id="station_id" value={form.station_id || stationId} disabled />
              </div>
              <div>
                <Label htmlFor="facility" className="text-xs text-muted-foreground">Facility</Label>
                <Input id="facility" placeholder="HQ" value={form.facility || ""} onChange={(e) => onChange("facility", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="building" className="text-xs text-muted-foreground">Building</Label>
                <Input id="building" placeholder="A" value={form.building || ""} onChange={(e) => onChange("building", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="zone" className="text-xs text-muted-foreground">Zone</Label>
                <Input id="zone" placeholder="Floor 3" value={form.zone || ""} onChange={(e) => onChange("zone", e.target.value)} />
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* MQTT */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">MQTT</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mqtt_broker" className="text-xs text-muted-foreground">Broker Host</Label>
                  <Input id="mqtt_broker" placeholder="mqtt://broker.emqx.io" value={form.mqtt_broker || ""} onChange={(e) => onChange("mqtt_broker", e.target.value)} />
                  <p className="text-[10px] text-muted-foreground/60">Supports mqtt://, mqtts://, tcp:// or plain hostname</p>
                </div>
                <div>
                  <Label htmlFor="mqtt_port" className="text-xs text-muted-foreground">Port</Label>
                  <Input id="mqtt_port" type="number" value={form.mqtt_port ?? 1883} onChange={(e) => onChange("mqtt_port", Number(e.target.value))} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="mqtt_topic" className="text-xs text-muted-foreground">Topic</Label>
                  <Input id="mqtt_topic" placeholder="/batteries/STN-01/data" value={form.mqtt_topic || ""} onChange={(e) => onChange("mqtt_topic", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="mqtt_username" className="text-xs text-muted-foreground">Username</Label>
                  <Input id="mqtt_username" value={form.mqtt_username || ""} onChange={(e) => onChange("mqtt_username", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="mqtt_password" className="text-xs text-muted-foreground">Password</Label>
                  <Input id="mqtt_password" type="password" value={form.mqtt_password || ""} onChange={(e) => onChange("mqtt_password", e.target.value)} />
                </div>
              </div>
            </div>

            {error && <div className="text-xs text-destructive">{error}</div>}
            {success && <div className="text-xs text-emerald-500">{success}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
