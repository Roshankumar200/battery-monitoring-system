"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AgentNetworkPage() {
  return (
    <div className="p-6 space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground tracking-wider">AGENT NETWORK</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-foreground">This section is not part of the battery monitoring workflow.</p>
          <p className="text-xs text-muted-foreground">
            The page is kept minimal so the frontend can build cleanly for the packaged launcher.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
