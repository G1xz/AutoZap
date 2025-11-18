import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getContactName } from '@/lib/contacts'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Busca todas as conversas agrupadas por contato
    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId: session.user.id },
      include: {
        messages: {
          select: {
            from: true,
            to: true,
            timestamp: true,
            isFromMe: true,
          },
          orderBy: {
            timestamp: 'desc',
          },
        },
        conversationStatuses: true,
      },
    })

    // Agrupa por contato
    const clientsMap = new Map<string, {
      contactNumber: string
      contactName: string | null
      instanceId: string
      instanceName: string
      lastMessageDate: string
      messageCount: number
      status?: string
    }>()

    // Processa cada instância e aguarda todas as buscas de nomes
    for (const instance of instances) {
      // Agrupa mensagens por contato
      const contactMessages = new Map<string, any[]>()
      
      instance.messages.forEach(msg => {
        const contactNumber = msg.isFromMe ? msg.to : msg.from
        if (!contactMessages.has(contactNumber)) {
          contactMessages.set(contactNumber, [])
        }
        contactMessages.get(contactNumber)!.push(msg)
      })

      // Cria entrada para cada contato
      // Usa Promise.all para aguardar todas as buscas de nomes
      const contactPromises = Array.from(contactMessages.entries()).map(async ([contactNumber, messages]) => {
        const key = `${instance.id}-${contactNumber}`
        const status = instance.conversationStatuses.find(
          cs => cs.contactNumber === contactNumber
        )

        // Busca o nome do contato (agora é async)
        const contactName = await getContactName(instance.id, contactNumber)

        return {
          key,
          data: {
            contactNumber,
            contactName,
            instanceId: instance.id,
            instanceName: instance.name,
            lastMessageDate: messages[0]?.timestamp.toISOString() || new Date().toISOString(),
            messageCount: messages.length,
            status: status?.status,
          }
        }
      })

      const contactResults = await Promise.all(contactPromises)
      contactResults.forEach(({ key, data }) => {
        clientsMap.set(key, data)
      })
    }

    const clients = Array.from(clientsMap.values())
      .sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime())

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Erro ao buscar clientes:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar clientes' },
      { status: 500 }
    )
  }
}

