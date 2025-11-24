import { prisma } from './prisma'

export type ConversationStatusType = 'active' | 'waiting_human' | 'closed'

/**
 * Atualiza ou cria o status de uma conversa
 * ⚠️ CRÍTICO: NÃO sobrescreve se já existe um agendamento pendente (a menos que seja explicitamente 'active')
 */
export async function updateConversationStatus(
  instanceId: string,
  contactNumber: string,
  status: ConversationStatusType
): Promise<void> {
  try {
    // Verifica se existe um agendamento pendente antes de atualizar
    const existing = await prisma.conversationStatus.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
    })

    // ⚠️ CRÍTICO: Se há agendamento pendente, NUNCA sobrescreve, independente do status solicitado
    // O agendamento pendente só pode ser removido explicitamente por clearPendingAppointment
    if (existing?.status?.startsWith('pending_appointment:')) {
      console.log(`⚠️⚠️⚠️ [updateConversationStatus] Agendamento pendente encontrado, NÃO sobrescrevendo com status "${status}"!`)
      console.log(`⚠️⚠️⚠️ [updateConversationStatus] Mantendo agendamento pendente intacto. Use clearPendingAppointment para remover.`)
      return // Mantém o agendamento pendente intacto - SEMPRE
    }

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
    console.log(`✅ [updateConversationStatus] Status da conversa atualizado: ${instanceId}-${contactNumber} -> ${status}`)
  } catch (error) {
    console.error('❌ [updateConversationStatus] Erro ao atualizar status da conversa:', error)
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
 * ⚠️ CRÍTICO: NÃO sobrescreve se já existe um agendamento pendente
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

    // ⚠️ CRÍTICO: Se já existe um agendamento pendente, NÃO sobrescreve!
    if (existing?.status?.startsWith('pending_appointment:')) {
      console.log(`⚠️ [ensureConversationStatus] Agendamento pendente encontrado, NÃO sobrescrevendo!`)
      return // Mantém o agendamento pendente intacto
    }

    if (!existing) {
      await prisma.conversationStatus.create({
        data: {
          instanceId,
          contactNumber,
          status: 'active',
        },
      })
      console.log(`✅ [ensureConversationStatus] Status criado: active`)
    } else {
      console.log(`✅ [ensureConversationStatus] Status já existe: ${existing.status}`)
    }
  } catch (error) {
    console.error('❌ [ensureConversationStatus] Erro ao garantir status da conversa:', error)
  }
}

