"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { createStation, StationConfig, useStations } from "@/hooks/use-batteries"
import { useRouter } from "next/navigation"

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
}

export function CreateStationModal({ open, onOpenChange }: Props) {
  const router = useRouter()
  const { mutate } = useStations()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<StationConfig>({
    station_id: "",
    name: "",
    facility: "",
    building: "",
    zone: "",
    location: "",
    mqtt_broker: "localhost",
    mqtt_port: 1883,
    mqtt_topic: "/batteries/+/data",
    mqtt_username: "",
    mqtt_password: "",
  })

  useEffect(() => {
    if (open) {
      setError(null)
    }
  }, [open])

  async function onSave() {
    try {
      setSaving(true)
      setError(null)
      if (!form.station_id || !form.name) {
        setError("Station ID and Name are required")
        setSaving(false)
        return
      }
      const created = await createStation(form)
      await mutate()
      onOpenChange(false)
      // navigate to the newly created station
      router.push(`/battery-stations/${encodeURIComponent(created.station_id)}`)
    } catch (e: any) {
      setError(e?.message || "Failed to create station")
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
          <DialogTitle>Create New Station</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="station_id" className="text-xs text-muted-foreground">Station ID</Label>
              <Input id="station_id" placeholder="STN-03" value={form.station_id} onChange={(e) => onChange("station_id", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="name" className="text-xs text-muted-foreground">Station Name</Label>
              <Input id="name" placeholder="Station 03" value={form.name} onChange={(e) => onChange("name", e.target.value)} />
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
              <Input id="zone" placeholder="Floor 1" value={form.zone || ""} onChange={(e) => onChange("zone", e.target.value)} />
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">MQTT</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mqtt_broker" className="text-xs text-muted-foreground">Broker Host</Label>
                <Input id="mqtt_broker" placeholder="mqtt://broker.emqx.io" value={form.mqtt_broker} onChange={(e) => onChange("mqtt_broker", e.target.value)} />
                <p className="text-[10px] text-muted-foreground/60">Supports mqtt://, mqtts://, tcp:// or plain hostname</p>
              </div>
              <div>
                <Label htmlFor="mqtt_port" className="text-xs text-muted-foreground">Port</Label>
                <Input id="mqtt_port" type="number" value={form.mqtt_port} onChange={(e) => onChange("mqtt_port", Number(e.target.value))} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="mqtt_topic" className="text-xs text-muted-foreground">Topic</Label>
                <Input id="mqtt_topic" placeholder="/batteries/STN-03/data" value={form.mqtt_topic} onChange={(e) => onChange("mqtt_topic", e.target.value)} />
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

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Creating..." : "Create Station"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
