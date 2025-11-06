// Armazena a URL do localtunnel por usuário (em produção, usar Redis ou banco)
const localtunnelUrls = new Map<string, string>()

export function getLocaltunnelUrl(userId: string): string | null {
  return localtunnelUrls.get(userId) || null
}

export function setLocaltunnelUrl(userId: string, url: string): void {
  localtunnelUrls.set(userId, url)
}

/**
 * Retorna a URL base da aplicação
 * Em produção (Vercel): usa VERCEL_URL ou NEXT_PUBLIC_BASE_URL
 * Em desenvolvimento: usa localtunnel se configurado, senão localhost
 */
export function getBaseUrl(userId?: string): string {
  // Em produção na Vercel
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // URL customizada configurada
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  
  // Em desenvolvimento, usa localtunnel se configurado
  if (userId) {
    const tunnelUrl = getLocaltunnelUrl(userId)
    if (tunnelUrl) {
      return tunnelUrl
    }
  }
  
  // Fallback para desenvolvimento local
  return process.env.NODE_ENV === 'production' 
    ? 'https://your-app.vercel.app' // Substitua pela sua URL quando fizer deploy
    : 'http://localhost:3000'
}

/**
 * Retorna a URL base para uso no cliente (browser)
 */
export function getPublicBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Se estiver rodando no browser, usa a URL atual
    return window.location.origin
  }
  
  // Fallback para server-side
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  return 'http://localhost:3000'
}


