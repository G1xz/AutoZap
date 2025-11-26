/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configurações para produção
  images: {
    domains: ['localhost'],
  },
  // Excluir midas-exemplo do build (é apenas referência)
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/midas-exemplo/**'],
    }
    return config
  },
}

module.exports = nextConfig

