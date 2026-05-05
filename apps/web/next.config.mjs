/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@csp/shared'],
  experimental: {
    instrumentationHook: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default config