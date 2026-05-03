"use client"

import { useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Bell, RefreshCw } from "lucide-react"

export function GlobalTopbar() {
  const pathname = usePathname()
  const router = useRouter()
  
  const sectionLabel = useMemo(() => {
    if (!pathname) return "BMS"
    if (pathname === "/") return "COMMAND CENTER"
    if (pathname.startsWith("/battery-stations")) return "STATION"
    if (pathname.startsWith("/activity") || pathname.startsWith("/intelligence")) return "ACTIVITY"
    return "BMS"
  }, [pathname])

  const handleRefresh = () => {
    router.refresh()
    window.location.reload()
  }

  return (
    <div className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground">
          BMS / <span className="text-orange-500">{sectionLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label="Notifications">
          <Bell className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground" 
          aria-label="Refresh"
          onClick={handleRefresh}
          title="Refresh page"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
