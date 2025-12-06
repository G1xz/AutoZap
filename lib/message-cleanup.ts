/**
 * Funções para limpeza automática de mensagens antigas
 */

import { prisma } from './prisma'
import { log } from './logger'

interface CleanupResult {
  deletedCount: number
  error?: string
}

/**
 * Limpa mensagens antigas baseado na configuração de retenção do usuário
 * @param userId ID do usuário
 * @param retentionDays Número de dias para manter mensagens (padrão: 90 dias)
 * @returns Resultado da limpeza
 */
export async function cleanupOldMessages(
  userId: string,
  retentionDays: number = 90
): Promise<CleanupResult> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    console.log(`🧹 [cleanup] Iniciando limpeza de mensagens antigas...`)
    console.log(`   Usuário: ${userId}`)
    console.log(`   Retenção: ${retentionDays} dias`)
    console.log(`   Data de corte: ${cutoffDate.toISOString()}`)

    // Busca todas as instâncias do usuário
    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId },
      select: { id: true },
    })

    if (instances.length === 0) {
      console.log(`🧹 [cleanup] Nenhuma instância encontrada para o usuário`)
      return { deletedCount: 0 }
    }

    const instanceIds = instances.map(i => i.id)

    // Conta quantas mensagens serão deletadas (para log)
    const countToDelete = await prisma.message.count({
      where: {
        instanceId: { in: instanceIds },
        timestamp: { lt: cutoffDate },
      },
    })

    console.log(`🧹 [cleanup] Encontradas ${countToDelete} mensagens para deletar`)

    if (countToDelete === 0) {
      return { deletedCount: 0 }
    }

    // Deleta mensagens antigas
    const result = await prisma.message.deleteMany({
      where: {
        instanceId: { in: instanceIds },
        timestamp: { lt: cutoffDate },
      },
    })

    console.log(`🧹 [cleanup] ✅ ${result.count} mensagens deletadas com sucesso`)

    log.event('messages_cleaned', {
      userId,
      deletedCount: result.count,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    })

    return { deletedCount: result.count }
  } catch (error) {
    console.error('🧹 [cleanup] ❌ Erro ao limpar mensagens:', error)
    log.error('Erro ao limpar mensagens antigas', error)
    
    return {
      deletedCount: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

/**
 * Limpa mensagens antigas para todos os usuários (útil para cron job)
 * @param defaultRetentionDays Retenção padrão se o usuário não tiver configurado (padrão: 90 dias)
 * @returns Resultado da limpeza por usuário
 */
export async function cleanupAllUsersMessages(
  defaultRetentionDays: number = 90
): Promise<Record<string, CleanupResult>> {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        messageRetentionDays: true,
      },
    })

    const results: Record<string, CleanupResult> = {}

    for (const user of users) {
      const retentionDays = user.messageRetentionDays || defaultRetentionDays
      results[user.id] = await cleanupOldMessages(user.id, retentionDays)
    }

    return results
  } catch (error) {
    console.error('🧹 [cleanup] ❌ Erro ao limpar mensagens de todos os usuários:', error)
    log.error('Erro ao limpar mensagens de todos os usuários', error)
    return {}
  }
}

/**
 * Obtém estatísticas de mensagens do usuário
 */
export async function getMessageStats(userId: string): Promise<{
  totalMessages: number
  messagesByAge: {
    last7Days: number
    last30Days: number
    last90Days: number
    older: number
  }
}> {
  try {
    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId },
      select: { id: true },
    })

    if (instances.length === 0) {
      return {
        totalMessages: 0,
        messagesByAge: {
          last7Days: 0,
          last30Days: 0,
          last90Days: 0,
          older: 0,
        },
      }
    }

    const instanceIds = instances.map(i => i.id)
    const now = new Date()
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const [total, last7, last30, last90, older] = await Promise.all([
      prisma.message.count({
        where: { instanceId: { in: instanceIds } },
      }),
      prisma.message.count({
        where: {
          instanceId: { in: instanceIds },
          timestamp: { gte: last7Days },
        },
      }),
      prisma.message.count({
        where: {
          instanceId: { in: instanceIds },
          timestamp: { gte: last30Days },
        },
      }),
      prisma.message.count({
        where: {
          instanceId: { in: instanceIds },
          timestamp: { gte: last90Days },
        },
      }),
      prisma.message.count({
        where: {
          instanceId: { in: instanceIds },
          timestamp: { lt: last90Days },
        },
      }),
    ])

    return {
      totalMessages: total,
      messagesByAge: {
        last7Days: last7,
        last30Days: last30 - last7,
        last90Days: last90 - last30,
        older,
      },
    }
  } catch (error) {
    console.error('Erro ao obter estatísticas de mensagens:', error)
    return {
      totalMessages: 0,
      messagesByAge: {
        last7Days: 0,
        last30Days: 0,
        last90Days: 0,
        older: 0,
      },
    }
  }
}

