import { prisma } from './prisma'

export type ConversationStatusType = 'active' | 'waiting_human' | 'closed'

/**
 * Atualiza ou cria o status de uma conversa
 */
export async function updateConversationStatus(
  instanceId: string,
  contactNumber: string,
  status: ConversationStatusType
): Promise<void> {
  try {
    await prisma.conversationStatus.upsert({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
      update: {
        status,
        updatedAt: new Date(),
      },
      create: {
        instanceId,
        contactNumber,
        status,
      },
    })
    console.log(`✅ Status da conversa atualizado: ${instanceId}-${contactNumber} -> ${status}`)
  } catch (error) {
    console.error('Erro ao atualizar status da conversa:', error)
  }
}

/**
 * Obtém o status de uma conversa
 */
export async function getConversationStatus(
  instanceId: string,
  contactNumber: string
): Promise<ConversationStatusType> {
  try {
    const status = await prisma.conversationStatus.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
    })
    return (status?.status as ConversationStatusType) || 'active'
  } catch (error) {
    console.error('Erro ao buscar status da conversa:', error)
    return 'active'
  }
}

/**
 * Inicializa status como 'active' quando uma nova mensagem chega
 */
export async function ensureConversationStatus(
  instanceId: string,
  contactNumber: string
): Promise<void> {
  try {
    const existing = await prisma.conversationStatus.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
    })

    if (!existing) {
      await prisma.conversationStatus.create({
        data: {
          instanceId,
          contactNumber,
          status: 'active',
        },
      })
    }
  } catch (error) {
    console.error('Erro ao garantir status da conversa:', error)
  }
}

