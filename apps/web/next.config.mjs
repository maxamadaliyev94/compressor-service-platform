/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@csp/shared'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default config