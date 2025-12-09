import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userId = session.user.id

    // Busca todas as instâncias do usuário
    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId },
      select: { id: true },
    })

    const instanceIds = instances.map(i => i.id)

    // Busca todos os pedidos do usuário
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
      },
    })

    // Calcula lucro de serviços
    const serviceOrders = orders.filter(order => 
      order.items.some(item => item.productType === 'service')
    )
    
    const serviceProfit = serviceOrders.reduce((total, order) => {
      const serviceItems = order.items.filter(item => item.productType === 'service')
      const orderServiceTotal = serviceItems.reduce((sum, item) => sum + item.totalPrice, 0)
      return total + orderServiceTotal
    }, 0)

    // Calcula lucro de produtos
    const productOrders = orders.filter(order => 
      order.items.some(item => item.productType === 'catalog')
    )
    
    const productProfit = productOrders.reduce((total, order) => {
      const productItems = order.items.filter(item => item.productType === 'catalog')
      const orderProductTotal = productItems.reduce((sum, item) => sum + item.totalPrice, 0)
      return total + orderProductTotal
    }, 0)

    // Total de vendas (todos os pedidos confirmados/completos)
    const completedOrders = orders.filter(order => 
      ['confirmed', 'preparing', 'ready', 'delivered', 'picked_up'].includes(order.status)
    )
    
    const totalSales = completedOrders.reduce((total, order) => total + order.totalAmount, 0)

    // Total de pedidos
    const totalOrders = orders.length
    const pendingOrders = orders.filter(o => o.status === 'pending').length
    const confirmedOrders = orders.filter(o => o.status === 'confirmed').length
    const completedOrdersCount = completedOrders.length

    // Busca conversas para calcular taxa de conversão
    const conversationStatuses = await prisma.conversationStatus.findMany({
      where: { instanceId: { in: instanceIds } },
    })

    const totalConversations = conversationStatuses.length
    const conversionRate = totalConversations > 0 
      ? (completedOrdersCount / totalConversations) * 100 
      : 0

    // Vendas por período (últimos 30 dias)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentOrders = orders.filter(order => 
      new Date(order.createdAt) >= thirtyDaysAgo &&
      ['confirmed', 'preparing', 'ready', 'delivered', 'picked_up'].includes(order.status)
    )

    const salesLast30Days = recentOrders.reduce((total, order) => total + order.totalAmount, 0)

    // Vendas por dia (últimos 7 dias)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const salesByDay: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      salesByDay[dateStr] = 0
    }

    recentOrders.forEach(order => {
      const orderDate = new Date(order.createdAt).toISOString().split('T')[0]
      if (salesByDay[orderDate] !== undefined) {
        salesByDay[orderDate] += order.totalAmount
      }
    })

    // Busca métricas de IA para calcular média de pontos por requisição
    const aiMetrics = await prisma.aIMetric.findMany({
      where: { userId },
      select: {
        totalTokens: true,
        cost: true,
        cached: true,
      },
    })

    // Calcula pontos consumidos (1 dólar = 1000 pontos)
    const nonCachedMetrics = aiMetrics.filter(m => !m.cached)
    const totalPointsConsumed = nonCachedMetrics.reduce((sum, m) => {
      return sum + Math.ceil((m.cost || 0) * 1000)
    }, 0)

    // Média de pontos por requisição (apenas requisições não em cache)
    const averagePointsPerRequest = nonCachedMetrics.length > 0
      ? totalPointsConsumed / nonCachedMetrics.length
      : 0

    // Busca pontos disponíveis do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pointsAvailable: true },
    })

    const pointsAvailable = user?.pointsAvailable || 0

    // Quantas requisições ainda podem ser feitas
    const remainingRequests = averagePointsPerRequest > 0
      ? Math.floor(pointsAvailable / averagePointsPerRequest)
      : 0

    return NextResponse.json({
      serviceProfit,
      productProfit,
      totalSales,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      completedOrders: completedOrdersCount,
      conversionRate: Number(conversionRate.toFixed(2)),
      totalConversations,
      salesLast30Days,
      salesByDay,
      averagePointsPerRequest: Number(averagePointsPerRequest.toFixed(2)),
      remainingRequests,
    })
  } catch (error) {
    console.error('Erro ao buscar métricas de negócio:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar métricas de negócio' },
      { status: 500 }
    )
  }
}

