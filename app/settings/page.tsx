"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  GlobalNotificationSettings,
  StationNotificationSettings,
  updateGlobalNotificationSettings,
  updateStationNotificationSettings,
  sendNotificationDigest,
  useGlobalNotificationSettings,
  useStationNotificationSettings,
  useStations,
} from "@/hooks/use-batteries"

type FieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function TextField({ label, value, onChange, placeholder }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function SettingsToggle({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-muted/40 px-3 py-2">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function NotificationEditorCard({
  title,
  subtitle,
  data,
  onSave,
  savingLabel,
}: {
  title: string
  subtitle?: string
  data: GlobalNotificationSettings | StationNotificationSettings | null
  onSave: (payload: Partial<GlobalNotificationSettings>) => Promise<void>
  savingLabel: string
}) {
  const [alertEmail, setAlertEmail] = useState("")
  const [csvEmail, setCsvEmail] = useState("")
  const [alertPhone, setAlertPhone] = useState("")
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [smsEnabled, setSmsEnabled] = useState(true)
  const [csvEnabled, setCsvEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setAlertEmail(data.alert_email || "")
    setCsvEmail(data.csv_email || "")
    setAlertPhone(data.alert_phone || "")
    setEmailEnabled(Boolean(data.email_enabled))
    setSmsEnabled(Boolean(data.sms_enabled))
    setCsvEnabled(Boolean(data.csv_enabled))
  }, [data])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await onSave({
        alert_email: alertEmail,
        csv_email: csvEmail,
        alert_phone: alertPhone,
        email_enabled: emailEnabled,
        sms_enabled: smsEnabled,
        csv_enabled: csvEnabled,
      })
      setMessage("Saved")
    } catch (error: any) {
      setMessage(error?.message || "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold text-muted-foreground tracking-wider">{title}</CardTitle>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Alert Email" value={alertEmail} onChange={setAlertEmail} placeholder="manager@example.com" />
          <TextField label="CSV Email" value={csvEmail} onChange={setCsvEmail} placeholder="reports@example.com" />
          <TextField label="Alert Phone" value={alertPhone} onChange={setAlertPhone} placeholder="+91xxxxxxxxxx" />
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <SettingsToggle label="Email Enabled" checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          <SettingsToggle label="SMS Enabled" checked={smsEnabled} onCheckedChange={setSmsEnabled} />
          <SettingsToggle label="CSV Enabled" checked={csvEnabled} onCheckedChange={setCsvEnabled} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">{message || `Use this form to control ${savingLabel}.`}</div>
          <Button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function StationNotificationSection({ stationId, stationName }: { stationId: string; stationName: string }) {
  const { settings, mutate } = useStationNotificationSettings(stationId)

  return (
    <NotificationEditorCard
      title={`${stationId} Notifications`}
      subtitle={stationName}
      data={settings}
      savingLabel={`notifications for ${stationId}`}
      onSave={async (payload) => {
        await updateStationNotificationSettings(stationId, payload)
        await mutate()
      }}
    />
  )
}

export default function NotificationSettingsPage() {
  const { stations } = useStations()
  const { settings: globalSettings, mutate: mutateGlobal } = useGlobalNotificationSettings()
  const [sendingDigest, setSendingDigest] = useState(false)
  const [digestMessage, setDigestMessage] = useState<string | null>(null)

  const orderedStations = useMemo(() => stations || [], [stations])

  const handleSendDigest = async () => {
    setSendingDigest(true)
    setDigestMessage(null)
    try {
      const result = await sendNotificationDigest({ mode: "all" })
      const emailStatus = result?.email_sent ? "sent" : "not sent"
      const smsStatus = result?.sms_sent ? "sent" : "not sent"
      setDigestMessage(`Combined digest processed. Gmail ${emailStatus}, SMS ${smsStatus}.`)
    } catch (error: any) {
      setDigestMessage(error?.message || "Failed to send digest")
    } finally {
      setSendingDigest(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wider text-foreground">NOTIFICATION SETTINGS</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage Gmail SMTP recipients, Twilio numbers, and digest delivery targets from one place.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Button onClick={handleSendDigest} disabled={sendingDigest} className="bg-orange-600 hover:bg-orange-700 text-white">
            {sendingDigest ? "SENDING..." : "SEND ALL NOW"}
          </Button>
          <p className="text-xs text-muted-foreground">Sends the current notification digest to Gmail and SMS for all active stations.</p>
        </div>
      </div>

      {digestMessage ? <div className="rounded border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{digestMessage}</div> : null}

      <NotificationEditorCard
        title="Global Defaults"
        subtitle="Used when a station does not define its own recipient values."
        data={globalSettings}
        savingLabel="global notification defaults"
        onSave={async (payload) => {
          await updateGlobalNotificationSettings(payload)
          await mutateGlobal()
        }}
      />

      <Separator />

      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-bold tracking-wider text-muted-foreground">STATION OVERRIDES</h2>
          <p className="text-xs text-muted-foreground mt-1">Each station can override the global recipients independently.</p>
        </div>

        <div className="space-y-4">
          {orderedStations.map((station: any) => (
            <StationNotificationSection key={station.station_id} stationId={station.station_id} stationName={station.name} />
          ))}
        </div>
      </div>
    </div>
  )
}