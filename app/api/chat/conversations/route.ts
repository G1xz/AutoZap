import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContactName } from '@/lib/contacts'

/**
 * GET - Lista todas as conversas do usuário
 * Agrupa mensagens por contato (número de telefone)
 * Query params: status (active, waiting_human, closed) - opcional
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') // active, waiting_human, closed ou null (todos)

    // Busca todas as instâncias do usuário
    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true },
    })

    if (instances.length === 0) {
      return NextResponse.json([])
    }

    const instanceIds = instances.map(i => i.id)

    // Busca status das conversas
    const conversationStatuses = await prisma.conversationStatus.findMany({
      where: {
        instanceId: { in: instanceIds },
        ...(statusFilter ? { status: statusFilter } : {}),
      },
    })

    // Cria um Map para acesso rápido ao status
    const statusMap = new Map<string, string>()
    conversationStatuses.forEach((cs) => {
      const key = `${cs.instanceId}-${cs.contactNumber}`
      statusMap.set(key, cs.status)
    })

    // Busca todas as mensagens das instâncias do usuário
    // Inclui tanto mensagens recebidas quanto enviadas
    const messages = await prisma.message.findMany({
      where: {
        instanceId: { in: instanceIds },
      },
      orderBy: {
        timestamp: 'desc',
      },
    })

    // Agrupa mensagens por contato
    const conversationsMap = new Map<string, {
      contactNumber: string
      contactName: string | null
      lastMessage: string
      lastMessageTime: Date
      unreadCount: number
      instanceId: string
      instanceName: string
      status: string
    }>()

    // Conta mensagens não lidas por conversa (mensagens recebidas que não foram do usuário)
    const unreadCounts = new Map<string, number>()
    for (const message of messages) {
      // Identifica o número do contato (não o da instância)
      const contactNumber = message.isFromMe ? message.to : message.from
      const key = `${message.instanceId}-${contactNumber}`
      if (!message.isFromMe) {
        unreadCounts.set(key, (unreadCounts.get(key) || 0) + 1)
      }
    }

    for (const message of messages) {
      // Identifica o número do contato (não o da instância)
      const contactNumber = message.isFromMe ? message.to : message.from
      const key = `${message.instanceId}-${contactNumber}`
      
      if (!conversationsMap.has(key)) {
        const instance = instances.find(i => i.id === message.instanceId)
        // Busca nome do contato se disponível
        const contactName = getContactName(message.instanceId, contactNumber)
        // Busca status da conversa (padrão: active)
        const status = statusMap.get(key) || 'active'
        
        // Se há filtro de status, só inclui se corresponder
        if (statusFilter && status !== statusFilter) {
          continue
        }
        
        conversationsMap.set(key, {
          contactNumber: contactNumber,
          contactName: contactName,
          lastMessage: message.body,
          lastMessageTime: message.timestamp,
          unreadCount: unreadCounts.get(key) || 0,
          instanceId: message.instanceId,
          instanceName: instance?.name || 'Instância desconhecida',
          status: status,
        })
      } else {
        const conv = conversationsMap.get(key)!
        // Busca nome do contato se ainda não tiver
        if (!conv.contactName) {
          const contactName = getContactName(message.instanceId, contactNumber)
          if (contactName) {
            conv.contactName = contactName
          }
        }
        // Atualiza status se necessário
        const status = statusMap.get(key) || 'active'
        conv.status = status
        
        // Se há filtro de status e o status não corresponde, remove da lista
        if (statusFilter && status !== statusFilter) {
          conversationsMap.delete(key)
          continue
        }
        
        // Atualiza se esta mensagem é mais recente
        if (message.timestamp > conv.lastMessageTime) {
          conv.lastMessage = message.body
          conv.lastMessageTime = message.timestamp
          conv.unreadCount = unreadCounts.get(key) || 0
        }
      }
    }

    // Converte Map para array e ordena por data da última mensagem
    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())

    return NextResponse.json(conversations)
  } catch (error) {
    console.error('Erro ao buscar conversas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar conversas' },
      { status: 500 }
    )
  }
}

