"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronRight, Monitor, Shield, Settings } from "lucide-react"

export function GlobalSidebar() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const nav = [
    { href: "/", id: "overview", icon: Monitor, label: "COMMAND CENTER" },
    { href: "/activity", id: "intelligence", icon: Shield, label: "ACTIVITY" },
    { href: "/settings", id: "settings", icon: Settings, label: "NOTIFICATIONS" },
  ]

  return (
    <>
      <div className={`${sidebarCollapsed ? "w-16" : "w-70"} bg-sidebar border-r border-sidebar-border transition-all duration-300 fixed md:relative z-50 md:z-auto h-full md:h-auto`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            <div className={`${sidebarCollapsed ? "hidden" : "block"}`}>
              <h1 className="text-orange-500 font-bold text-lg tracking-wider">BMS</h1>
              <p className="text-muted-foreground text-xs">v2.1.7 CLASSIFIED</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`} />
            </Button>
          </div>
          <nav className="space-y-2">
            {nav.map((item) => (
              <Link key={item.id} href={item.href} className="block">
                <div className={`w-full flex items-center gap-3 p-3 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-sidebar-accent`}>
                  <item.icon className="w-5 h-5" />
                  {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                </div>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {!sidebarCollapsed && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarCollapsed(true)} />
      )}
    </>
  )
}
