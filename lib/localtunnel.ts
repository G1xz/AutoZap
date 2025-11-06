// Armazena a URL do localtunnel por usuário (em produção, usar Redis ou banco)
const localtunnelUrls = new Map<string, string>()

export function getLocaltunnelUrl(userId: string): string | null {
  return localtunnelUrls.get(userId) || null
}

export function setLocaltunnelUrl(userId: string, url: string): void {
  localtunnelUrls.set(userId, url)
}

