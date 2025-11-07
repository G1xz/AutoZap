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

    // Busca estatísticas de mensagens
    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })

    const instanceIds = instances.map(i => i.id)

    const totalMessages = await prisma.message.count({
      where: { instanceId: { in: instanceIds } },
    })

    // Busca estatísticas de conversas
    const conversationStatuses = await prisma.conversationStatus.findMany({
      where: { instanceId: { in: instanceIds } },
    })

    const totalConversations = conversationStatuses.length
    const activeConversations = conversationStatuses.filter(cs => cs.status === 'active').length
    const waitingHumanConversations = conversationStatuses.filter(cs => cs.status === 'waiting_human').length
    const closedConversations = conversationStatuses.filter(cs => cs.status === 'closed').length

    // Busca estatísticas de agendamentos
    const appointments = await prisma.appointment.findMany({
      where: { userId: session.user.id },
    })

    const totalAppointments = appointments.length
    const pendingAppointments = appointments.filter(a => a.status === 'pending').length
    const confirmedAppointments = appointments.filter(a => a.status === 'confirmed').length
    const completedAppointments = appointments.filter(a => a.status === 'completed').length

    // Mensagens por dia (últimos 7 dias)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentMessages = await prisma.message.findMany({
      where: {
        instanceId: { in: instanceIds },
        timestamp: { gte: sevenDaysAgo },
      },
      select: {
        timestamp: true,
      },
    })

    // Agrupa por dia
    const messagesByDayMap = new Map<string, number>()
    recentMessages.forEach(msg => {
      const dateStr = msg.timestamp.toISOString().split('T')[0]
      messagesByDayMap.set(dateStr, (messagesByDayMap.get(dateStr) || 0) + 1)
    })

    // Preenche os últimos 7 dias mesmo se não houver mensagens
    const messagesByDayArray: Array<{ date: string; count: number }> = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      messagesByDayArray.push({
        date: dateStr,
        count: messagesByDayMap.get(dateStr) || 0,
      })
    }

    return NextResponse.json({
      totalMessages,
      totalConversations,
      activeConversations,
      waitingHumanConversations,
      closedConversations,
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      messagesByDay: messagesByDayArray,
    })
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar relatórios' },
      { status: 500 }
    )
  }
}

