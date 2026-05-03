"use client"

import { AlertCircle, CheckCircle, Zap, Check } from "lucide-react"

interface ActivityNotificationProps {
  id: string
  timestamp: string
  type: "critical" | "warning" | "info" | "success"
  title: string
  description: string
  station?: string
  battery?: string
  actionable?: boolean
  acknowledged?: boolean
  onClick?: () => void
  onAcknowledge?: () => void
}

export function ActivityNotification({
  timestamp,
  type,
  title,
  description,
  station,
  battery,
  acknowledged,
  onClick,
  onAcknowledge,
}: ActivityNotificationProps) {
  const getTypeStyles = () => {
    switch (type) {
      case "critical":
        return {
          bg: "bg-red-500/10",
          border: "border-red-500/50",
          title: "text-red-400",
          icon: AlertCircle,
          accent: "bg-red-500",
        }
      case "warning":
        return {
          bg: "bg-yellow-500/10",
          border: "border-yellow-500/50",
          title: "text-yellow-400",
          icon: AlertCircle,
          accent: "bg-yellow-500",
        }
      case "success":
        return {
          bg: "bg-green-500/10",
          border: "border-green-500/50",
          title: "text-green-400",
          icon: CheckCircle,
          accent: "bg-green-500",
        }
      default:
        return {
          bg: "bg-blue-500/10",
          border: "border-blue-500/50",
          title: "text-blue-400",
          icon: Zap,
          accent: "bg-blue-500",
        }
    }
  }

  const styles = getTypeStyles()
  const IconComponent = styles.icon

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`${styles.bg} border ${styles.border} rounded-lg p-3 hover:bg-opacity-70 transition-all ${
        onClick ? "cursor-pointer" : ""
      } group ${acknowledged ? "opacity-60" : ""}`}
    >
      <div className="flex gap-3">
        <div className={`w-2 h-2 rounded-full ${acknowledged ? "bg-muted-foreground" : styles.accent} flex-shrink-0 mt-1.5`}></div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={`text-sm font-semibold ${acknowledged ? "text-muted-foreground line-through" : styles.title} truncate`}>{title}</h4>
            <div className="flex items-center gap-2 flex-shrink-0">
              {acknowledged && (
                <span className="text-[10px] text-green-400 font-mono">ACK</span>
              )}
              <span className="text-xs text-muted-foreground font-mono">{timestamp}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{description}</p>

          <div className="flex items-center justify-between">
            <div className="flex gap-2 text-xs">
              {station && (
                <span className="px-2 py-1 bg-muted/60 rounded text-muted-foreground font-mono">{station}</span>
              )}
              {battery && (
                <span className="px-2 py-1 bg-muted/60 rounded text-muted-foreground font-mono">{battery}</span>
              )}
            </div>

            {onAcknowledge && !acknowledged && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAcknowledge()
                }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded bg-green-600/20 text-green-400 hover:bg-green-600/40 transition-colors border border-green-500/30"
                title="Acknowledge this alert"
              >
                <Check className="w-3 h-3" />
                ACK
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
