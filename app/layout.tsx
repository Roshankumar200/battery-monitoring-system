import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { ThemeProvider } from "@/components/theme-provider"
import { GlobalSidebar } from "../components/global-sidebar"
import { GlobalTopbar } from "../components/global-topbar"
import "./globals.css"

export const metadata: Metadata = {
  title: "Battery Management System (BMS)",
  description: "Battery monitoring and management dashboard",
    generator: 'v0.app'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const runtimeConfig = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "",
  }

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${GeistMono.className} ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__BMS_ENV__ = ${JSON.stringify(runtimeConfig)};`,
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="flex h-screen">
            <GlobalSidebar />

            {/* Main */}
            <div className={`flex-1 flex flex-col`}>
              <GlobalTopbar />
              <div className="flex-1 overflow-auto">{children}</div>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
