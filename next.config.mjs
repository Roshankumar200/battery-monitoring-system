/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/battery-monitoring-system",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
