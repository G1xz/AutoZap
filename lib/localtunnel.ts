// Armazena a URL do localtunnel por usuário (em produção, usar Redis ou banco)
const localtunnelUrls = new Map<string, string>()

// Cache global para fallback quando userId não está disponível
let globalLocaltunnelUrl: string | null = null

// Flag para indicar se já tentou carregar do ambiente
let hasTriedEnvLoad = false

/**
 * Inicializa o localtunnel a partir de variáveis de ambiente
 */
function initializeFromEnv() {
  if (hasTriedEnvLoad) return
  
  hasTriedEnvLoad = true
  
  // Tenta carregar da variável de ambiente
  if (process.env.LOCALTUNNEL_URL) {
    globalLocaltunnelUrl = process.env.LOCALTUNNEL_URL
    console.log(`✅ LocalTunnel carregado da variável de ambiente: ${globalLocaltunnelUrl}`)
  }
}

export function getLocaltunnelUrl(userId: string): string | null {
  // Tenta inicializar do ambiente se ainda não tentou
  initializeFromEnv()
  return localtunnelUrls.get(userId) || null
}

export function setLocaltunnelUrl(userId: string, url: string): void {
  localtunnelUrls.set(userId, url)
  // Também salva como fallback global
  if (url) {
    globalLocaltunnelUrl = url
    console.log(`✅ LocalTunnel salvo no cache para userId: ${userId} -> ${url}`)
  }
}

/**
 * Tenta carregar o localtunnel do usuário fazendo uma busca interna
 * Isso é útil quando o Map está vazio mas o localtunnel foi configurado via interface
 */
export async function ensureLocaltunnelLoaded(userId: string): Promise<void> {
  // Se já está no Map, não precisa carregar
  if (localtunnelUrls.has(userId)) {
    return
  }
  
  // Tenta carregar da variável de ambiente primeiro
  if (process.env.LOCALTUNNEL_URL) {
    setLocaltunnelUrl(userId, process.env.LOCALTUNNEL_URL)
    return
  }
  
  // Se já tem cache global, usa ele
  if (globalLocaltunnelUrl) {
    setLocaltunnelUrl(userId, globalLocaltunnelUrl)
    return
  }
  
  // Tenta fazer uma busca HTTP interna para a API de configuração
  // Isso funciona porque estamos no mesmo servidor
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    
    // Faz uma requisição interna para buscar o localtunnel
    // Mas isso requer autenticação, então não vai funcionar no contexto do webhook
    // Por enquanto, vamos confiar no cache global ou variável de ambiente
    console.log(`ℹ️ Tentando carregar localtunnel para userId: ${userId}`)
  } catch (error) {
    // Silenciosamente ignora erros
  }
}

/**
 * Busca qualquer URL de localtunnel configurada (útil quando userId não está disponível)
 */
export function getAnyLocaltunnelUrl(): string | null {
  // Primeiro tenta variável de ambiente
  if (process.env.LOCALTUNNEL_URL) {
    return process.env.LOCALTUNNEL_URL
  }
  
  // Depois tenta usar o cache global
  if (globalLocaltunnelUrl) {
    return globalLocaltunnelUrl
  }
  
  // Depois tenta buscar do Map (pega o primeiro disponível)
  if (localtunnelUrls.size > 0) {
    const firstUrl = Array.from(localtunnelUrls.values())[0]
    // Atualiza cache global
    globalLocaltunnelUrl = firstUrl
    return firstUrl
  }
  
  return null
}

/**
 * Retorna a URL base da aplicação
 * Em produção (Vercel): usa VERCEL_URL ou NEXT_PUBLIC_BASE_URL
 * Em desenvolvimento: usa localtunnel se configurado, senão localhost
 */
export function getBaseUrl(userId?: string): string {
  // Tenta inicializar do ambiente primeiro
  initializeFromEnv()
  
  // Em produção na Vercel
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // URL customizada configurada
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  
  // Em desenvolvimento, tenta usar localtunnel
  const isDevelopment = process.env.NODE_ENV !== 'production'
  
  if (isDevelopment) {
    // Primeiro tenta buscar do Map usando userId específico (se foi configurado via API)
    if (userId) {
      const tunnelUrl = getLocaltunnelUrl(userId)
      if (tunnelUrl) {
        // Atualiza cache global também
        globalLocaltunnelUrl = tunnelUrl
        return tunnelUrl
      }
    }
    
    // Se não encontrou com userId específico, tenta buscar qualquer localtunnel configurado
    // Isso inclui cache global, variável de ambiente, ou qualquer URL no Map
    const anyTunnelUrl = getAnyLocaltunnelUrl()
    if (anyTunnelUrl) {
      // Se encontrou um localtunnel de qualquer fonte, usa ele e atualiza o Map para este userId também
      if (userId && !localtunnelUrls.has(userId)) {
        setLocaltunnelUrl(userId, anyTunnelUrl)
      }
      return anyTunnelUrl
    }
    
    // Se não encontrou localtunnel, retorna localhost (mas isso causará erro no WhatsApp)
    // Em desenvolvimento, é necessário ter localtunnel configurado
    console.warn(`⚠️ LocalTunnel não configurado para userId: ${userId || 'não disponível'}. URLs de mídia podem falhar.`)
    console.warn(`   Configure via interface (campo "URL do Localtunnel") ou variável LOCALTUNNEL_URL no .env.local`)
    console.warn(`   Map size: ${localtunnelUrls.size}, Global cache: ${globalLocaltunnelUrl || 'null'}`)
    return 'http://localhost:3000'
  }
  
  // Fallback para produção
  return 'https://your-app.vercel.app' // Substitua pela sua URL quando fizer deploy
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


