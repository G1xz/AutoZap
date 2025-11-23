/**
 * Funções para gerenciar agendamentos diretamente (usado pela IA)
 */

import { prisma } from './prisma'

export interface CreateAppointmentParams {
  userId: string
  instanceId: string
  contactNumber: string
  contactName?: string
  date: Date
  description?: string
}

/**
 * Cria um agendamento diretamente no banco de dados
 * Usado pela IA para criar agendamentos automaticamente
 */
export async function createAppointment(params: CreateAppointmentParams) {
  try {
    const appointment = await prisma.appointment.create({
      data: {
        userId: params.userId,
        instanceId: params.instanceId,
        contactNumber: params.contactNumber,
        contactName: params.contactName,
        date: params.date,
        description: params.description,
        status: 'pending',
      },
    })

    return {
      success: true,
      appointment: {
        id: appointment.id,
        date: appointment.date,
        description: appointment.description,
        status: appointment.status,
      },
    }
  } catch (error) {
    console.error('Erro ao criar agendamento:', error)
    return {
      success: false,
      error: 'Erro ao criar agendamento',
    }
  }
}

/**
 * Verifica disponibilidade de horários em uma data específica
 */
export async function checkAvailability(userId: string, date: Date) {
  try {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const appointments = await prisma.appointment.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['pending', 'confirmed'],
        },
      },
      orderBy: {
        date: 'asc',
      },
    })

    return {
      success: true,
      appointments: appointments.map((apt) => ({
        date: apt.date,
        description: apt.description,
      })),
    }
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error)
    return {
      success: false,
      error: 'Erro ao verificar disponibilidade',
    }
  }
}

