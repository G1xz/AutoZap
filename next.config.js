/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configurações para produção
  images: {
    domains: ['localhost'],
  },
}

module.exports = nextConfig

