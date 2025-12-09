import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [admin/metrics] Iniciando busca de métricas...')
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('❌ [admin/metrics] Sessão não encontrada')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log(`🔍 [admin/metrics] Verificando se usuário ${session.user.id} é administrador...`)
    // Verifica se o usuário é administrador
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    })

    console.log(`🔍 [admin/metrics] isAdmin: ${user?.isAdmin}`)
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 })
    }
    
    console.log('✅ [admin/metrics] Usuário é administrador, buscando dados...')

    // Busca todos os usuários
    console.log('📊 [admin/metrics] Buscando usuários...')
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        planName: true,
        pointsAvailable: true,
        pointsConsumedThisMonth: true,
        createdAt: true,
      },
    })

    // Busca todas as métricas de IA
    console.log('📊 [admin/metrics] Buscando métricas de IA...')
    const allAIMetricsRaw = await prisma.aIMetric.findMany({
      select: {
        id: true,
        userId: true,
        instanceId: true,
        totalTokens: true,
        cost: true,
        cached: true,
        createdAt: true,
      },
    })
    
    // Calcula pontos consumidos baseado nos tokens (1 ponto = 100 tokens, cache = 0 pontos)
    const allAIMetrics = allAIMetricsRaw.map(m => ({
      id: m.id,
      userId: m.userId,
      instanceId: m.instanceId,
      totalTokens: m.totalTokens,
      cost: m.cost || 0,
      pointsConsumed: m.cached ? 0 : Math.ceil(m.totalTokens / 100),
      cached: m.cached,
      createdAt: m.createdAt,
    }))

    // Busca todos os pedidos
    console.log('📊 [admin/metrics] Buscando pedidos...')
    const allOrders = await prisma.order.findMany({
      include: {
        items: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Calcula métricas agregadas
    const totalUsers = allUsers.length
    const totalAIMetrics = allAIMetrics.length
    const nonCachedMetrics = allAIMetrics.filter(m => !m.cached)
    const totalCost = allAIMetrics.reduce((sum, m) => sum + (m.cost || 0), 0)
    const totalPointsConsumed = allAIMetrics.reduce((sum, m) => sum + (m.pointsConsumed || 0), 0)
    const totalCachedRequests = allAIMetrics.filter(m => m.cached).length

    // Custo médio por requisição (apenas requisições não em cache)
    const averageCostPerRequest = nonCachedMetrics.length > 0 
      ? totalCost / nonCachedMetrics.length 
      : 0

    // Total de vendas
    const completedOrders = allOrders.filter(order => 
      ['confirmed', 'preparing', 'ready', 'delivered', 'picked_up'].includes(order.status)
    )
    const totalSales = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0)

    // Busca todas as conversas para relacionar com requisições de IA
    console.log('📊 [admin/metrics] Buscando conversas...')
    const allConversations = await prisma.conversationStatus.findMany({
      select: {
        id: true,
        instanceId: true,
        contactNumber: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Busca todas as instâncias
    const allInstances = await prisma.whatsAppInstance.findMany({
      select: { id: true },
    })
    const allInstanceIds = allInstances.map(i => i.id)

    // Busca todas as mensagens para relacionar com requisições de IA
    const allMessages = await prisma.message.findMany({
      where: {
        instanceId: { in: allInstanceIds },
      },
      select: {
        id: true,
        instanceId: true,
        from: true,
        to: true,
        isFromMe: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // Agrupa mensagens por conversa (instanceId + número do contato)
    // O número do contato é `from` quando a mensagem não é do sistema, ou `to` quando é do sistema
    const messagesByConversation = new Map<string, typeof allMessages>()
    allMessages.forEach(msg => {
      // O número do contato é o remetente quando não é do sistema, ou o destinatário quando é do sistema
      const contactNumber = msg.isFromMe ? msg.to : msg.from
      const key = `${msg.instanceId}-${contactNumber}`
      if (!messagesByConversation.has(key)) {
        messagesByConversation.set(key, [])
      }
      messagesByConversation.get(key)!.push(msg)
    })

    // Calcula requisições de IA por conversa
    // Relaciona métricas de IA com conversas baseado em instanceId e período de tempo
    const conversationMetrics: Array<{
      conversationKey: string
      aiRequests: number
      hasOrder: boolean
    }> = []

    allConversations.forEach(conv => {
      const conversationKey = `${conv.instanceId}-${conv.contactNumber}`
      
      // Busca métricas de IA relacionadas a esta conversa
      // Considera métricas no período da conversa (entre createdAt e updatedAt)
      const conversationStart = new Date(conv.createdAt)
      const conversationEnd = new Date(conv.updatedAt)
      
      // Adiciona margem de 1 hora antes e depois para capturar requisições relacionadas
      const searchStart = new Date(conversationStart.getTime() - 60 * 60 * 1000)
      const searchEnd = new Date(conversationEnd.getTime() + 60 * 60 * 1000)
      
      const relatedMetrics = allAIMetrics.filter(m => 
        m.instanceId === conv.instanceId &&
        new Date(m.createdAt) >= searchStart &&
        new Date(m.createdAt) <= searchEnd
      )

      // Verifica se esta conversa resultou em um pedido
      // Normaliza o número do contato para comparação
      const normalizedContactNumber = conv.contactNumber.replace(/\D/g, '')
      const hasOrder = allOrders.some(order => {
        const normalizedOrderContact = order.contactNumber.replace(/\D/g, '')
        return order.instanceId === conv.instanceId &&
          normalizedOrderContact === normalizedContactNumber &&
          new Date(order.createdAt) >= conversationStart &&
          new Date(order.createdAt) <= searchEnd
      })

      conversationMetrics.push({
        conversationKey,
        aiRequests: relatedMetrics.length,
        hasOrder,
      })
    })

    // Calcula médias
    const conversationsWithSales = conversationMetrics.filter(c => c.hasOrder)
    const averageRequestsPerSaleConversation = conversationsWithSales.length > 0
      ? conversationsWithSales.reduce((sum, c) => sum + c.aiRequests, 0) / conversationsWithSales.length
      : 0

    const averageRequestsPerConversation = conversationMetrics.length > 0
      ? conversationMetrics.reduce((sum, c) => sum + c.aiRequests, 0) / conversationMetrics.length
      : 0

    // Métricas por usuário
    const metricsByUser = allUsers.map(user => {
      const userMetrics = allAIMetrics.filter(m => m.userId === user.id)
      const userOrders = allOrders.filter(o => o.userId === user.id)
      const userCompletedOrders = userOrders.filter(o => 
        ['confirmed', 'preparing', 'ready', 'delivered', 'picked_up'].includes(o.status)
      )
      const userSales = userCompletedOrders.reduce((sum, o) => sum + o.totalAmount, 0)

      return {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        planName: user.planName,
        pointsAvailable: user.pointsAvailable,
        pointsConsumedThisMonth: user.pointsConsumedThisMonth,
        aiRequests: userMetrics.length,
        aiCost: userMetrics.reduce((sum, m) => sum + (m.cost || 0), 0),
        aiPointsConsumed: userMetrics.reduce((sum, m) => sum + (m.pointsConsumed || 0), 0),
        totalSales: userSales,
        totalOrders: userOrders.length,
        createdAt: user.createdAt,
      }
    })

    return NextResponse.json({
      totalUsers,
      totalAIMetrics,
      totalCost,
      totalPointsConsumed,
      totalCachedRequests,
      averageCostPerRequest,
      averageRequestsPerSaleConversation: Number(averageRequestsPerSaleConversation.toFixed(2)),
      averageRequestsPerConversation: Number(averageRequestsPerConversation.toFixed(2)),
      totalSales,
      totalOrders: allOrders.length,
      completedOrders: completedOrders.length,
      totalConversations: allConversations.length,
      conversationsWithSales: conversationsWithSales.length,
      metricsByUser,
    })
    
    console.log('✅ [admin/metrics] Métricas calculadas com sucesso')
  } catch (error: any) {
    console.error('Erro ao buscar métricas de administrador:', error)
    console.error('Stack trace:', error?.stack)
    return NextResponse.json(
      { 
        error: 'Erro ao buscar métricas de administrador',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    )
  }
}

