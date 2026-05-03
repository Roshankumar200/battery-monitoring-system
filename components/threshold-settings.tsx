"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useThresholds, type BatteryThresholds, DEFAULTS, backendToFrontendThresholds, frontendToBackendThresholds } from "@/hooks/use-thresholds"
import { useStationThresholds, updateStationThresholds } from "@/hooks/use-batteries"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** When provided, thresholds are loaded from / saved to backend for this station. */
  stationId?: string
}

export function ThresholdSettings({ open, onOpenChange, stationId }: Props) {
  // Global (localStorage) fallback
  const globalCtx = useThresholds()
  // Station-specific from backend (only when stationId provided)
  const { thresholds: stationThresholds, mutate } = useStationThresholds(stationId)

  const [form, setForm] = useState<BatteryThresholds>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When dialog opens, seed the form from the correct source
  useEffect(() => {
    if (!open) return
    if (stationId && stationThresholds) {
      setForm(backendToFrontendThresholds(stationThresholds))
    } else {
      setForm(globalCtx.thresholds)
    }
    setError(null)
  }, [open, stationId, stationThresholds, globalCtx.thresholds])

  if (!globalCtx.ready) return null

  const handleSave = async () => {
    if (stationId) {
      try {
        setSaving(true)
        setError(null)
        await updateStationThresholds(stationId, frontendToBackendThresholds(form))
        await mutate()
        onOpenChange(false)
      } catch (e: any) {
        setError(e?.message || "Failed to save")
      } finally {
        setSaving(false)
      }
    } else {
      // Save globally (localStorage)
      globalCtx.set(form)
      onOpenChange(false)
    }
  }

  const handleReset = () => {
    setForm(DEFAULTS)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {stationId ? `Threshold Settings — ${stationId}` : "Global Threshold Settings"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1 tracking-wider">VOLTAGE MIN (V)</div>
            <Input
              type="number"
              step="0.1"
              value={form.voltageMin}
              onChange={(e) => setForm({ ...form, voltageMin: Number(e.target.value) })}
              className="bg-background border-border text-foreground"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1 tracking-wider">VOLTAGE MAX (V)</div>
            <Input
              type="number"
              step="0.1"
              value={form.voltageMax}
              onChange={(e) => setForm({ ...form, voltageMax: Number(e.target.value) })}
              className="bg-background border-border text-foreground"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1 tracking-wider">TEMP MIN (°C)</div>
            <Input
              type="number"
              step="0.5"
              value={form.temperatureMin}
              onChange={(e) => setForm({ ...form, temperatureMin: Number(e.target.value) })}
              className="bg-background border-border text-foreground"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1 tracking-wider">TEMP MAX (°C)</div>
            <Input
              type="number"
              step="0.5"
              value={form.temperatureMax}
              onChange={(e) => setForm({ ...form, temperatureMax: Number(e.target.value) })}
              className="bg-background border-border text-foreground"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1 tracking-wider">SOC MIN (%)</div>
            <Input
              type="number"
              step="1"
              value={form.socMin}
              onChange={(e) => setForm({ ...form, socMin: Number(e.target.value) })}
              className="bg-background border-border text-foreground"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1 tracking-wider">SOH MIN (%)</div>
            <Input
              type="number"
              step="1"
              value={form.sohMin}
              onChange={(e) => setForm({ ...form, sohMin: Number(e.target.value) })}
              className="bg-background border-border text-foreground"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1 tracking-wider">IMPEDANCE MAX (Ω)</div>
            <Input
              type="number"
              step="0.001"
              value={form.impMax}
              onChange={(e) => setForm({ ...form, impMax: Number(e.target.value) })}
              className="bg-background border-border text-foreground"
            />
          </div>
        </div>

        {error && <div className="text-xs text-destructive mt-2">{error}</div>}

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            className="border-border text-muted-foreground hover:bg-muted"
            onClick={handleReset}
          >
            Reset Defaults
          </Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700 text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
