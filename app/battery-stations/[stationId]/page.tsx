import { Suspense } from "react"
import ClientPage from "./client"

export function generateStaticParams() {
  return Array.from({ length: 50 }, (_, i) => ({
    stationId: `STN-${(i + 1).toString().padStart(2, "0")}`,
  }))
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading station...</div>}>
      <ClientPage />
    </Suspense>
  )
}
