/**
 * Sistema de agendamentos pendentes de confirmação
 */

import { prisma } from './prisma'

export interface PendingAppointmentData {
  date: string // Data formatada (DD/MM/YYYY)
  time: string // Hora formatada (HH:MM)
  duration?: number // Duração em minutos
  service: string // Nome do serviço
  description?: string
}

/**
 * Armazena um agendamento pendente de confirmação
 */
export async function storePendingAppointment(
  instanceId: string,
  contactNumber: string,
  data: PendingAppointmentData
): Promise<void> {
  try {
    console.log(`📅 [storePendingAppointment] Armazenando agendamento pendente para ${instanceId}-${contactNumber}`)
    console.log(`📅 [storePendingAppointment] Dados:`, JSON.stringify(data, null, 2))
    
    // Usa o ConversationStatus para armazenar dados temporários
    // Armazena no campo status como JSON (temporário até criar schema próprio)
    const result = await prisma.conversationStatus.upsert({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
      update: {
        status: `pending_appointment:${JSON.stringify(data)}`,
        updatedAt: new Date(),
      },
      create: {
        instanceId,
        contactNumber,
        status: `pending_appointment:${JSON.stringify(data)}`,
      },
    })
    
    console.log(`✅ [storePendingAppointment] Agendamento pendente armazenado com SUCESSO`)
    console.log(`✅ [storePendingAppointment] Status salvo: "${result.status?.substring(0, 100)}..."`)
    
    // Verifica se foi salvo corretamente (importa a função aqui para evitar dependência circular)
    const { getPendingAppointment: verifyGetPending } = await import('./pending-appointments')
    const verification = await verifyGetPending(instanceId, contactNumber)
    if (verification) {
      console.log(`✅ [storePendingAppointment] VERIFICAÇÃO: Agendamento pendente confirmado no banco`)
    } else {
      console.error(`❌ [storePendingAppointment] ERRO: Agendamento pendente NÃO encontrado após salvar!`)
    }
  } catch (error) {
    console.error('❌ [storePendingAppointment] Erro ao armazenar agendamento pendente:', error)
    console.error('❌ [storePendingAppointment] Stack trace:', error instanceof Error ? error.stack : 'N/A')
  }
}

/**
 * Obtém um agendamento pendente
 */
export async function getPendingAppointment(
  instanceId: string,
  contactNumber: string
): Promise<PendingAppointmentData | null> {
  try {
    console.log(`🔍 [getPendingAppointment] Buscando agendamento pendente para ${instanceId}-${contactNumber}`)
    const status = await prisma.conversationStatus.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
    })

    console.log(`🔍 [getPendingAppointment] Status encontrado:`, status ? `status="${status.status?.substring(0, 50)}..."` : 'NÃO ENCONTRADO')

    if (status?.status?.startsWith('pending_appointment:')) {
      const dataStr = status.status.replace('pending_appointment:', '')
      const data = JSON.parse(dataStr) as PendingAppointmentData
      console.log(`✅ [getPendingAppointment] Agendamento pendente encontrado:`, data)
      return data
    }

    console.log(`❌ [getPendingAppointment] Status não é agendamento pendente ou não existe`)
    return null
  } catch (error) {
    console.error('❌ [getPendingAppointment] Erro ao buscar agendamento pendente:', error)
    return null
  }
}

/**
 * Remove um agendamento pendente (após confirmar ou cancelar)
 */
export async function clearPendingAppointment(
  instanceId: string,
  contactNumber: string
): Promise<void> {
  try {
    console.log(`🗑️ [clearPendingAppointment] Removendo agendamento pendente para ${instanceId}-${contactNumber}`)
    
    // Verifica se existe antes de remover (usa função local para evitar dependência circular)
    const statusBefore = await prisma.conversationStatus.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
    })
    
    if (statusBefore?.status?.startsWith('pending_appointment:')) {
      const dataStr = statusBefore.status.replace('pending_appointment:', '')
      const before = JSON.parse(dataStr) as PendingAppointmentData
      console.log(`🗑️ [clearPendingAppointment] Agendamento pendente encontrado antes de remover:`, before)
    } else {
      console.log(`⚠️ [clearPendingAppointment] Nenhum agendamento pendente encontrado antes de remover`)
    }
    
    await prisma.conversationStatus.update({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
      data: {
        status: 'active',
      },
    })
    
    // Verifica se foi removido corretamente
    const statusAfter = await prisma.conversationStatus.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
    })
    
    if (!statusAfter?.status?.startsWith('pending_appointment:')) {
      console.log(`✅ [clearPendingAppointment] Agendamento pendente removido com SUCESSO`)
    } else {
      console.error(`❌ [clearPendingAppointment] ERRO: Agendamento pendente ainda existe após remover!`)
    }
  } catch (error) {
    console.error('❌ [clearPendingAppointment] Erro ao remover agendamento pendente:', error)
    console.error('❌ [clearPendingAppointment] Stack trace:', error instanceof Error ? error.stack : 'N/A')
  }
}

