"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function OperationsPage() {
  return (
    <div className="p-6 space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground tracking-wider">OPERATIONS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-foreground">Operational summaries can be restored later if needed.</p>
          <p className="text-xs text-muted-foreground">
            For now, this route stays lightweight so the production frontend can compile for the single-file package.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
