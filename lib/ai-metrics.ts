/**
 * Sistema de métricas para uso da IA
 * Rastreia tokens, custos e performance
 */

import { log } from './logger'

interface AIMetric {
  timestamp: number
  userId?: string
  instanceId?: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  duration: number
  cached: boolean
}

// Armazena métricas em memória (em produção, salvar no banco)
const metrics: AIMetric[] = []

// Limite de métricas em memória (últimas 1000)
const MAX_METRICS = 1000

// Custos por token (USD) - atualizar conforme preços da OpenAI
const COST_PER_TOKEN = {
  'gpt-3.5-turbo': {
    prompt: 0.0005 / 1000, // $0.0005 por 1K tokens
    completion: 0.0015 / 1000, // $0.0015 por 1K tokens
  },
  'gpt-4': {
    prompt: 0.03 / 1000,
    completion: 0.06 / 1000,
  },
  'gpt-4-turbo': {
    prompt: 0.01 / 1000,
    completion: 0.03 / 1000,
  },
  default: {
    prompt: 0.0005 / 1000,
    completion: 0.0015 / 1000,
  },
}

/**
 * Calcula custo baseado no modelo e tokens
 */
function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const costs = COST_PER_TOKEN[model as keyof typeof COST_PER_TOKEN] || COST_PER_TOKEN.default
  
  const promptCost = promptTokens * costs.prompt
  const completionCost = completionTokens * costs.completion
  
  return promptCost + completionCost
}

/**
 * Registra métrica de uso da IA
 */
export function recordAIMetric(params: {
  userId?: string
  instanceId?: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  duration: number
  cached?: boolean
}): void {
  const cost = calculateCost(
    params.model,
    params.promptTokens,
    params.completionTokens
  )

  const metric: AIMetric = {
    timestamp: Date.now(),
    userId: params.userId,
    instanceId: params.instanceId,
    model: params.model,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    totalTokens: params.totalTokens,
    cost,
    duration: params.duration,
    cached: params.cached || false,
  }

  metrics.push(metric)

  // Mantém apenas as últimas MAX_METRICS
  if (metrics.length > MAX_METRICS) {
    metrics.shift()
  }

  // Log da métrica
  log.metric('ai_usage', params.totalTokens, {
    model: params.model,
    cached: params.cached ? 'true' : 'false',
    userId: params.userId || 'unknown',
  })

  log.debug('Métrica de IA registrada', {
    model: params.model,
    tokens: params.totalTokens,
    cost: cost.toFixed(4),
    duration: params.duration,
    cached: params.cached,
  })
}

/**
 * Obtém estatísticas de uso da IA
 */
export function getAIStats(params?: {
  userId?: string
  instanceId?: string
  startDate?: Date
  endDate?: Date
}): {
  totalRequests: number
  totalTokens: number
  totalCost: number
  averageTokens: number
  averageCost: number
  cachedRequests: number
  averageDuration: number
  byModel: Record<string, { requests: number; tokens: number; cost: number }>
} {
  let filtered = [...metrics]

  // Filtra por usuário
  if (params?.userId) {
    filtered = filtered.filter((m) => m.userId === params.userId)
  }

  // Filtra por instância
  if (params?.instanceId) {
    filtered = filtered.filter((m) => m.instanceId === params.instanceId)
  }

  // Filtra por data
  if (params?.startDate) {
    filtered = filtered.filter((m) => m.timestamp >= params.startDate!.getTime())
  }

  if (params?.endDate) {
    filtered = filtered.filter((m) => m.timestamp <= params.endDate!.getTime())
  }

  const totalRequests = filtered.length
  const totalTokens = filtered.reduce((sum, m) => sum + m.totalTokens, 0)
  const totalCost = filtered.reduce((sum, m) => sum + m.cost, 0)
  const cachedRequests = filtered.filter((m) => m.cached).length
  const totalDuration = filtered.reduce((sum, m) => sum + m.duration, 0)

  // Agrupa por modelo
  const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {}
  filtered.forEach((m) => {
    if (!byModel[m.model]) {
      byModel[m.model] = { requests: 0, tokens: 0, cost: 0 }
    }
    byModel[m.model].requests++
    byModel[m.model].tokens += m.totalTokens
    byModel[m.model].cost += m.cost
  })

  return {
    totalRequests,
    totalTokens,
    totalCost,
    averageTokens: totalRequests > 0 ? totalTokens / totalRequests : 0,
    averageCost: totalRequests > 0 ? totalCost / totalRequests : 0,
    cachedRequests,
    averageDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
    byModel,
  }
}

/**
 * Limpa métricas antigas
 */
export function cleanOldMetrics(olderThanDays: number = 30): number {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  const initialLength = metrics.length
  
  // Remove métricas antigas
  const filtered = metrics.filter((m) => m.timestamp >= cutoff)
  metrics.length = 0
  metrics.push(...filtered)

  const removed = initialLength - metrics.length
  if (removed > 0) {
    log.info(`Métricas antigas removidas: ${removed} entradas`)
  }

  return removed
}

