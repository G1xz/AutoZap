import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST - Limpa mensagens antigas do banco de dados
 * Query params: days (número de dias para manter, padrão: 90)
 * 
 * ATENÇÃO: Esta operação é irreversível!
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const daysToKeep = parseInt(searchParams.get('days') || '90') // Padrão: manter 90 dias

    // Calcula a data limite
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // Busca instâncias do usuário
    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (instances.length === 0) {
      return NextResponse.json({ 
        deleted: 0,
        message: 'Nenhuma instância encontrada'
      })
    }

    const instanceIds = instances.map(i => i.id)

    // Conta quantas mensagens serão deletadas
    const countToDelete = await prisma.message.count({
      where: {
        instanceId: { in: instanceIds },
        timestamp: { lt: cutoffDate },
      },
    })

    // Deleta mensagens antigas
    const result = await prisma.message.deleteMany({
      where: {
        instanceId: { in: instanceIds },
        timestamp: { lt: cutoffDate },
      },
    })

    return NextResponse.json({
      deleted: result.count,
      totalToDelete: countToDelete,
      cutoffDate: cutoffDate.toISOString(),
      message: `${result.count} mensagens antigas foram deletadas (mantendo apenas as últimas ${daysToKeep} dias)`,
    })
  } catch (error) {
    console.error('Erro ao limpar mensagens:', error)
    return NextResponse.json(
      { error: 'Erro ao limpar mensagens' },
      { status: 500 }
    )
  }
}

/**
 * GET - Retorna estatísticas de mensagens
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Busca instâncias do usuário
    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (instances.length === 0) {
      return NextResponse.json({
        totalMessages: 0,
        oldestMessage: null,
        newestMessage: null,
      })
    }

    const instanceIds = instances.map(i => i.id)

    // Estatísticas gerais
    const totalMessages = await prisma.message.count({
      where: { instanceId: { in: instanceIds } },
    })

    const oldestMessage = await prisma.message.findFirst({
      where: { instanceId: { in: instanceIds } },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    })

    const newestMessage = await prisma.message.findFirst({
      where: { instanceId: { in: instanceIds } },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    })

    // Mensagens por idade
    const now = new Date()
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const messagesLast7Days = await prisma.message.count({
      where: {
        instanceId: { in: instanceIds },
        timestamp: { gte: last7Days },
      },
    })

    const messagesLast30Days = await prisma.message.count({
      where: {
        instanceId: { in: instanceIds },
        timestamp: { gte: last30Days },
      },
    })

    const messagesLast90Days = await prisma.message.count({
      where: {
        instanceId: { in: instanceIds },
        timestamp: { gte: last90Days },
      },
    })

    return NextResponse.json({
      totalMessages,
      oldestMessage: oldestMessage?.timestamp || null,
      newestMessage: newestMessage?.timestamp || null,
      byAge: {
        last7Days: messagesLast7Days,
        last30Days: messagesLast30Days,
        last90Days: messagesLast90Days,
        olderThan90Days: totalMessages - messagesLast90Days,
      },
    })
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas' },
      { status: 500 }
    )
  }
}

