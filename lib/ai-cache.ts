/**
 * Sistema de cache para respostas da IA
 * Reduz custos e melhora performance
 */

import { log } from './logger'

// Cache em memória (em produção, usar Redis)
// Formato: { key: { response: string, timestamp: number, ttl: number } }
const cache = new Map<string, { response: string; timestamp: number; ttl: number }>()

// TTL padrão: 1 hora
const DEFAULT_TTL = 60 * 60 * 1000

// Limpeza periódica de cache expirado (a cada 10 minutos)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    let cleaned = 0

    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      log.debug(`Cache limpo: ${cleaned} entradas expiradas removidas`)
    }
  }, 10 * 60 * 1000)
}

/**
 * Gera chave de cache baseada no conteúdo
 */
function generateCacheKey(
  userMessage: string,
  systemPrompt?: string,
  context?: Record<string, any>
): string {
  // Normaliza a mensagem (remove espaços extras, lowercase)
  const normalizedMessage = userMessage.toLowerCase().trim().replace(/\s+/g, ' ')
  
  // Cria hash simples (em produção, usar crypto.createHash)
  const contextStr = context ? JSON.stringify(context) : ''
  const promptStr = systemPrompt || ''
  
  // Hash simples baseado em string (em produção usar algo mais robusto)
  const hash = `${normalizedMessage}:${promptStr}:${contextStr}`
    .split('')
    .reduce((acc, char) => {
      const hash = ((acc << 5) - acc) + char.charCodeAt(0)
      return hash & hash
    }, 0)
    .toString(36)

  return `ai:${hash}`
}

/**
 * Obtém resposta do cache se disponível
 */
export function getCachedResponse(
  userMessage: string,
  systemPrompt?: string,
  context?: Record<string, any>
): string | null {
  const key = generateCacheKey(userMessage, systemPrompt, context)
  const cached = cache.get(key)

  if (!cached) {
    return null
  }

  // Verifica se expirou
  const now = Date.now()
  if (now - cached.timestamp > cached.ttl) {
    cache.delete(key)
    return null
  }

  log.debug('Resposta da IA obtida do cache', { key })
  return cached.response
}

/**
 * Armazena resposta no cache
 */
export function setCachedResponse(
  userMessage: string,
  response: string,
  systemPrompt?: string,
  context?: Record<string, any>,
  ttl: number = DEFAULT_TTL
): void {
  const key = generateCacheKey(userMessage, systemPrompt, context)
  
  cache.set(key, {
    response,
    timestamp: Date.now(),
    ttl,
  })

  log.debug('Resposta da IA armazenada no cache', { key, ttl })
}

/**
 * Limpa o cache completamente
 */
export function clearCache(): void {
  const size = cache.size
  cache.clear()
  log.info(`Cache limpo: ${size} entradas removidas`)
}

/**
 * Limpa entradas expiradas do cache
 */
export function cleanExpiredCache(): number {
  const now = Date.now()
  let cleaned = 0

  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > value.ttl) {
      cache.delete(key)
      cleaned++
    }
  }

  if (cleaned > 0) {
    log.debug(`Cache limpo: ${cleaned} entradas expiradas removidas`)
  }

  return cleaned
}

/**
 * Obtém estatísticas do cache
 */
export function getCacheStats(): {
  size: number
  keys: string[]
} {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  }
}

/**
 * Configuração de cache por tipo de requisição
 */
export const cacheConfig = {
  // Cache por 1 hora para conversas gerais
  general: DEFAULT_TTL,
  
  // Cache por 24 horas para informações estáticas (horários, serviços)
  static: 24 * 60 * 60 * 1000,
  
  // Cache por 5 minutos para informações dinâmicas (agendamentos)
  dynamic: 5 * 60 * 1000,
  
  // Sem cache para ações críticas
  none: 0,
}

