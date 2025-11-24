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
    // Usa o ConversationStatus para armazenar dados temporários
    // Armazena no campo status como JSON (temporário até criar schema próprio)
    await prisma.conversationStatus.upsert({
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
    console.log(`📅 Agendamento pendente armazenado para ${instanceId}-${contactNumber}`)
  } catch (error) {
    console.error('Erro ao armazenar agendamento pendente:', error)
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
    const status = await prisma.conversationStatus.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
    })

    if (status?.status?.startsWith('pending_appointment:')) {
      const dataStr = status.status.replace('pending_appointment:', '')
      return JSON.parse(dataStr) as PendingAppointmentData
    }

    return null
  } catch (error) {
    console.error('Erro ao buscar agendamento pendente:', error)
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
    console.log(`📅 Agendamento pendente removido para ${instanceId}-${contactNumber}`)
  } catch (error) {
    console.error('Erro ao remover agendamento pendente:', error)
  }
}

