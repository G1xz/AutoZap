/**
 * Sistema de métricas para uso da IA
 * Rastreia tokens, custos e performance
 */

import { log } from './logger'
import { prisma } from './prisma'

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

// Custos por token (USD) - Preços atualizados da OpenAI (Dezembro 2024)
const COST_PER_TOKEN = {
  'gpt-3.5-turbo': {
    prompt: 0.0005 / 1000, // $0.0005 por 1K tokens (input)
    completion: 0.0015 / 1000, // $0.0015 por 1K tokens (output)
  },
  'gpt-3.5-turbo-1106': {
    prompt: 0.001 / 1000,
    completion: 0.002 / 1000,
  },
  'gpt-4': {
    prompt: 0.03 / 1000,
    completion: 0.06 / 1000,
  },
  'gpt-4-turbo': {
    prompt: 0.01 / 1000,
    completion: 0.03 / 1000,
  },
  'gpt-4o': {
    prompt: 0.0025 / 1000,
    completion: 0.01 / 1000,
  },
  'gpt-4o-mini': {
    prompt: 0.00015 / 1000,
    completion: 0.0006 / 1000,
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
 * Calcula pontos consumidos baseado no custo em dólares
 * Regra: 1 dólar (USD) = 1000 pontos
 * Respostas em cache consomem 0 pontos
 */
function calculatePoints(
  costInUSD: number,
  cached: boolean
): number {
  if (cached) {
    return 0 // Respostas em cache não consomem pontos
  }
  // 1 dólar = 1000 pontos, arredondado para cima
  return Math.ceil(costInUSD * 1000)
}

/**
 * Registra métrica de uso da IA
 * Salva no banco de dados para persistência
 */
export async function recordAIMetric(params: {
  userId?: string
  instanceId?: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  duration: number
  cached?: boolean
  endpoint?: string
}): Promise<void> {
  const cost = calculateCost(
    params.model,
    params.promptTokens,
    params.completionTokens
  )
  
  const pointsConsumed = calculatePoints(
    cost,
    params.cached || false
  )

  // Atualiza pontos consumidos do usuário se houver userId
  if (params.userId && pointsConsumed > 0) {
    try {
      await prisma.user.update({
        where: { id: params.userId },
        data: {
          pointsConsumedThisMonth: {
            increment: pointsConsumed,
          },
          pointsAvailable: {
            decrement: pointsConsumed,
          },
        },
      })
    } catch (error) {
      console.error('Erro ao atualizar pontos do usuário:', error)
    }
  }

  // Salva no banco de dados
  try {
    await prisma.aIMetric.create({
      data: {
        userId: params.userId || null,
        instanceId: params.instanceId || null,
        model: params.model,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.totalTokens,
        cost,
        pointsConsumed,
        duration: params.duration,
        cached: params.cached || false,
        endpoint: params.endpoint || null,
      },
    })
  } catch (error: any) {
    // Se der erro (ex: coluna não existe), tenta criar a coluna e salvar novamente
    if (error?.code === 'P2022' || error?.message?.includes('does not exist')) {
      console.error('⚠️ Erro ao salvar métrica de IA (coluna pode não existir):', error.message)
      // Mantém em memória como fallback
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
      if (metrics.length > MAX_METRICS) {
        metrics.shift()
      }
    } else {
      console.error('❌ Erro ao salvar métrica de IA:', error)
    }
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
 * Busca do banco de dados
 */
export async function getAIStats(params?: {
  userId?: string
  instanceId?: string
  startDate?: Date
  endDate?: Date
}): Promise<{
  totalRequests: number
  totalTokens: number
  totalCost: number
  totalPointsConsumed: number
  pointsAvailable?: number
  averageTokens: number
  averageCost: number
  cachedRequests: number
  averageDuration: number
  byModel: Record<string, { requests: number; tokens: number; cost: number }>
}> {
  try {
    // Monta filtros para o Prisma
    const where: any = {}
    
    if (params?.userId) {
      where.userId = params.userId
    }
    
    if (params?.instanceId) {
      where.instanceId = params.instanceId
    }
    
    if (params?.startDate || params?.endDate) {
      where.createdAt = {}
      if (params?.startDate) {
        where.createdAt.gte = params.startDate
      }
      if (params?.endDate) {
        where.createdAt.lte = params.endDate
      }
    }

    // Busca métricas do banco
    const dbMetrics = await prisma.aIMetric.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // Converte para formato compatível
    const filtered = dbMetrics.map((m) => ({
      timestamp: m.createdAt.getTime(),
      userId: m.userId || undefined,
      instanceId: m.instanceId || undefined,
      model: m.model,
      promptTokens: m.promptTokens,
      completionTokens: m.completionTokens,
      totalTokens: m.totalTokens,
      cost: m.cost,
      pointsConsumed: (m as any).pointsConsumed || 0,
      duration: m.duration,
      cached: m.cached,
    }))

    const totalRequests = filtered.length
    const totalTokens = filtered.reduce((sum, m) => sum + m.totalTokens, 0)
    const totalCost = filtered.reduce((sum, m) => sum + m.cost, 0)
    const totalPointsConsumed = filtered.reduce((sum, m) => sum + (m.pointsConsumed || 0), 0)
    const cachedRequests = filtered.filter((m) => m.cached).length
    const totalDuration = filtered.reduce((sum, m) => sum + m.duration, 0)

    // Busca pontos disponíveis do usuário se houver userId
    let pointsAvailable: number | undefined
    if (params?.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: params.userId },
          select: { pointsAvailable: true },
        })
        pointsAvailable = user?.pointsAvailable || 0
      } catch (error) {
        console.error('Erro ao buscar pontos do usuário:', error)
      }
    }

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
      totalPointsConsumed,
      pointsAvailable,
      averageTokens: totalRequests > 0 ? totalTokens / totalRequests : 0,
      averageCost: totalRequests > 0 ? totalCost / totalRequests : 0,
      cachedRequests,
      averageDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
      byModel,
    }
  } catch (error: any) {
    // Se der erro (ex: tabela não existe), usa métricas em memória como fallback
    console.error('⚠️ Erro ao buscar métricas do banco, usando memória:', error.message)
    
    let filtered = [...metrics]

    if (params?.userId) {
      filtered = filtered.filter((m) => m.userId === params.userId)
    }

    if (params?.instanceId) {
      filtered = filtered.filter((m) => m.instanceId === params.instanceId)
    }

    if (params?.startDate) {
      filtered = filtered.filter((m) => m.timestamp >= params.startDate!.getTime())
    }

    if (params?.endDate) {
      filtered = filtered.filter((m) => m.timestamp <= params.endDate!.getTime())
    }

    const totalRequests = filtered.length
    const totalTokens = filtered.reduce((sum, m) => sum + m.totalTokens, 0)
    const totalCost = filtered.reduce((sum, m) => sum + m.cost, 0)
    const totalPointsConsumed = filtered.reduce((sum, m) => {
      // Calcula pontos baseado no custo se não tiver pointsConsumed
      const points = calculatePoints(m.cost, m.cached)
      return sum + points
    }, 0)
    const cachedRequests = filtered.filter((m) => m.cached).length
    const totalDuration = filtered.reduce((sum, m) => sum + m.duration, 0)

    // Busca pontos disponíveis do usuário se houver userId
    let pointsAvailable: number | undefined
    if (params?.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: params.userId },
          select: { pointsAvailable: true },
        })
        pointsAvailable = user?.pointsAvailable || 0
      } catch (error) {
        // Ignora erro se não conseguir buscar
      }
    }

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
      totalPointsConsumed,
      pointsAvailable,
      averageTokens: totalRequests > 0 ? totalTokens / totalRequests : 0,
      averageCost: totalRequests > 0 ? totalCost / totalRequests : 0,
      cachedRequests,
      averageDuration: totalRequests > 0 ? totalDuration / totalRequests : 0,
      byModel,
    }
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

