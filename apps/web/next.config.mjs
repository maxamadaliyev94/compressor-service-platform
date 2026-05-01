/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  transpilePackages: ['@csp/shared'],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default config