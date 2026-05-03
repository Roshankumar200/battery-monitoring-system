"use client"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { deleteStation } from "@/hooks/use-batteries"
import { useState } from "react"

export function DeleteStationDialog({
  open,
  onOpenChange,
  stationId,
  name,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  stationId: string
  name?: string
  onDeleted?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    try {
      setLoading(true)
      setError(null)
      if (!stationId) throw new Error("Missing station id")
      await deleteStation(stationId)
      onOpenChange(false)
      onDeleted?.()
    } catch (e: any) {
      setError(e?.message || "Failed to delete station")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-card border border-border text-card-foreground sm:rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete station</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            This will permanently remove station {name || stationId}. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <div className="text-xs text-destructive">{error}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {loading ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
