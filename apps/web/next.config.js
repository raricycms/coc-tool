/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@coc-tools/coc-rules', '@coc-tools/db', '@coc-tools/shared'],
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
};

module.exports = nextConfig;