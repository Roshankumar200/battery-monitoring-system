"use client"

import { Activity, AlertTriangle, CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type StationStatus = "online" | "warning" | "offline"

export interface StationSummaryData {
	stationId: string
	stationName?: string
	location?: string
	batteryCount: number
	totalVoltage: number
	avgVoltage: number
	avgTemperature: number
	avgSoc: number
	avgSoh: number
	avgImp: number
	criticalCount: number
	warningCount: number
	status: StationStatus
	lastUpdated?: string
}

function statusStyles(status: StationStatus) {
	switch (status) {
		case "online":
			return "bg-foreground/20 text-foreground"
		case "warning":
			return "bg-orange-500/20 text-orange-500"
		case "offline":
		default:
			return "bg-red-500/20 text-red-500"
	}
}

function statusIcon(status: StationStatus) {
	switch (status) {
		case "online":
			return <CheckCircle className="w-4 h-4" />
		case "warning":
			return <AlertTriangle className="w-4 h-4" />
		case "offline":
		default:
			return <Activity className="w-4 h-4" />
	}
}

function MetricCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
	return (
		<div className="rounded border border-border bg-muted p-3">
			<div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
			<div className="mt-1 font-mono text-lg font-bold text-foreground">
				{value}
				{unit ? <span className="ml-1 text-xs text-muted-foreground">{unit}</span> : null}
			</div>
		</div>
	)
}

export function StationSummaryCard({ data }: { data: StationSummaryData }) {
	const hasData = data.batteryCount > 0

	return (
		<Card className="bg-card border-border">
			<CardHeader className="pb-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<CardTitle className="text-sm font-bold text-muted-foreground tracking-wider">LIVE STATION SNAPSHOT</CardTitle>
						<div className="mt-2 flex items-center gap-2">
							<span className="text-lg font-bold text-foreground tracking-wider">{data.stationId}</span>
							<Badge className={statusStyles(data.status)}>
								<span className="mr-1 inline-flex">{statusIcon(data.status)}</span>
								{data.status.toUpperCase()}
							</Badge>
						</div>
						{data.stationName ? <p className="mt-1 text-xs text-muted-foreground">{data.stationName}</p> : null}
						{data.location ? <p className="text-xs text-muted-foreground">{data.location}</p> : null}
					</div>

					<div className="text-xs text-muted-foreground font-mono sm:text-right">
						<div>BATTERIES {data.batteryCount}</div>
						<div>CRITICAL {data.criticalCount}</div>
						<div>WARNINGS {data.warningCount}</div>
						{data.lastUpdated ? <div className="mt-1 text-foreground">UPDATED {data.lastUpdated}</div> : null}
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				{!hasData ? (
					<div className="rounded border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
						No live battery readings yet. The station view is ready and will populate as soon as MQTT data is stored in the backend.
					</div>
				) : null}

				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					<MetricCard label="Total Voltage" value={(data.totalVoltage / 1000).toFixed(1)} unit="V" />
					<MetricCard label="Avg Voltage" value={data.avgVoltage.toFixed(2)} unit="V" />
					<MetricCard label="Avg Temp" value={data.avgTemperature.toFixed(1)} unit="°C" />
					<MetricCard label="Avg SOC / SOH" value={`${data.avgSoc.toFixed(0)} / ${data.avgSoh.toFixed(0)}`} unit="%" />
				</div>

				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					<MetricCard label="Avg Impedance" value={data.avgImp.toFixed(2)} unit="Ω" />
					<MetricCard label="Critical" value={String(data.criticalCount)} />
					<MetricCard label="Warnings" value={String(data.warningCount)} />
					<MetricCard label="Station Health" value={hasData ? (data.avgSoh >= 85 ? "GOOD" : data.avgSoh >= 70 ? "WARN" : "CRIT") : "N/A"} />
				</div>
			</CardContent>
		</Card>
	)
}

export default StationSummaryCard
