/**
 * Sistema de Rate Limiting
 * Protege APIs contra abuso usando rate-limiter-flexible
 */

import { RateLimiterMemory } from 'rate-limiter-flexible'
import { RateLimitError } from './errors'
import { log } from './logger'

// Rate limiters por tipo de endpoint
const rateLimiters = {
  // API geral: 100 requisições por minuto por IP
  api: new RateLimiterMemory({
    points: 100,
    duration: 60, // 60 segundos
  }),

  // Webhook: 1000 requisições por minuto por IP
  webhook: new RateLimiterMemory({
    points: 1000,
    duration: 60,
  }),

  // Autenticação: 5 tentativas por 15 minutos por IP
  auth: new RateLimiterMemory({
    points: 5,
    duration: 15 * 60, // 15 minutos
    blockDuration: 15 * 60, // Bloqueia por 15 minutos
  }),

  // Upload: 10 uploads por hora por usuário
  upload: new RateLimiterMemory({
    points: 10,
    duration: 60 * 60, // 1 hora
  }),

  // Envio de mensagens WhatsApp: 100 mensagens por minuto por instância
  whatsapp: new RateLimiterMemory({
    points: 100,
    duration: 60,
  }),

  // IA: 50 requisições por minuto por usuário
  ai: new RateLimiterMemory({
    points: 50,
    duration: 60,
  }),
}

/**
 * Obtém o IP do cliente da requisição
 */
export function getClientIP(request: Request | { headers: Headers }): string {
  const headers = request instanceof Request ? request.headers : request.headers
  
  // Tenta obter IP real (considera proxies)
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Fallback para localhost em desenvolvimento
  return '127.0.0.1'
}

/**
 * Aplica rate limiting
 */
export async function rateLimit(
  type: keyof typeof rateLimiters,
  identifier: string,
  points: number = 1
): Promise<void> {
  try {
    const limiter = rateLimiters[type]
    await limiter.consume(identifier, points)
  } catch (rejRes: any) {
    const remainingTime = Math.round(rejRes.msBeforeNext / 1000) || 1
    
    log.warn('Rate limit excedido', {
      type,
      identifier,
      remainingTime,
    })

    throw new RateLimitError(
      `Muitas requisições. Tente novamente em ${remainingTime} segundo(s).`
    )
  }
}

/**
 * Middleware de rate limiting para Next.js API routes
 */
export async function rateLimitMiddleware(
  request: Request,
  type: keyof typeof rateLimiters = 'api',
  identifier?: string
): Promise<void> {
  const ip = identifier || getClientIP(request)
  await rateLimit(type, ip)
}

/**
 * Rate limiting por usuário (requer autenticação)
 */
export async function rateLimitByUser(
  userId: string,
  type: keyof typeof rateLimiters = 'api'
): Promise<void> {
  await rateLimit(type, `user:${userId}`)
}

/**
 * Obtém informações sobre rate limit atual
 */
export async function getRateLimitInfo(
  type: keyof typeof rateLimiters,
  identifier: string
): Promise<{
  remaining: number
  resetTime: number
  total: number
}> {
  const limiter = rateLimiters[type]
  const rateLimiterRes = await limiter.get(identifier)

  if (!rateLimiterRes) {
    const opts = limiter.getOptions()
    return {
      remaining: opts.points,
      resetTime: Date.now() + opts.duration * 1000,
      total: opts.points,
    }
  }

  return {
    remaining: rateLimiterRes.remainingPoints,
    resetTime: Date.now() + rateLimiterRes.msBeforeNext,
    total: rateLimiterRes.totalHits,
  }
}

