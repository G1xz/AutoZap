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
    console.log('📅 createAppointment chamado com params:', {
      userId: params.userId,
      instanceId: params.instanceId,
      contactNumber: params.contactNumber,
      contactName: params.contactName,
      date: params.date,
      dateISO: params.date.toISOString(),
      description: params.description,
    })

    // Validações
    if (!params.userId) {
      console.error('❌ userId é obrigatório')
      return {
        success: false,
        error: 'userId é obrigatório',
      }
    }

    if (!params.instanceId) {
      console.error('❌ instanceId é obrigatório')
      return {
        success: false,
        error: 'instanceId é obrigatório',
      }
    }

    if (!params.contactNumber) {
      console.error('❌ contactNumber é obrigatório')
      return {
        success: false,
        error: 'contactNumber é obrigatório',
      }
    }

    if (!params.date || isNaN(params.date.getTime())) {
      console.error('❌ date é inválida:', params.date)
      return {
        success: false,
        error: 'date é inválida',
      }
    }

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

    console.log('✅ Agendamento criado com sucesso no banco:', {
      id: appointment.id,
      date: appointment.date,
      description: appointment.description,
      status: appointment.status,
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
    console.error('❌ Erro ao criar agendamento:', error)
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A')
    console.error('❌ Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar agendamento',
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

/**
 * Lista horários disponíveis em uma data específica
 * Retorna horários livres considerando agendamentos existentes
 */
export async function getAvailableTimes(
  userId: string,
  date: Date,
  durationMinutes: number = 60,
  startHour: number = 8,
  endHour: number = 18
) {
  try {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Busca agendamentos do dia
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

    // Gera todos os horários possíveis do dia
    const allSlots: string[] = []
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        allSlots.push(timeStr)
      }
    }

    // Marca horários ocupados
    const occupiedSlots = new Set<string>()
    appointments.forEach((apt) => {
      const aptDate = new Date(apt.date)
      const aptHour = aptDate.getHours()
      const aptMinute = aptDate.getMinutes()
      const aptTimeStr = `${aptHour.toString().padStart(2, '0')}:${aptMinute.toString().padStart(2, '0')}`
      
      // Marca o horário e próximos slots baseado na duração (assume 1 hora padrão)
      const slotsToMark = Math.ceil(60 / 30) // Quantos slots de 30min ocupar
      for (let i = 0; i < slotsToMark; i++) {
        const slotHour = aptHour + Math.floor((aptMinute + i * 30) / 60)
        const slotMinute = (aptMinute + i * 30) % 60
        if (slotHour < endHour) {
          const slotStr = `${slotHour.toString().padStart(2, '0')}:${slotMinute.toString().padStart(2, '0')}`
          occupiedSlots.add(slotStr)
        }
      }
    })

    // Filtra horários disponíveis
    const availableSlots = allSlots.filter((slot) => !occupiedSlots.has(slot))

    return {
      success: true,
      date: date.toLocaleDateString('pt-BR'),
      availableTimes: availableSlots,
      occupiedTimes: Array.from(occupiedSlots).sort(),
    }
  } catch (error) {
    console.error('Erro ao buscar horários disponíveis:', error)
    return {
      success: false,
      error: 'Erro ao buscar horários disponíveis',
    }
  }
}

/**
 * Busca agendamentos de um contato específico
 */
export async function getUserAppointments(
  userId: string,
  instanceId: string,
  contactNumber: string,
  includePast: boolean = false
) {
  try {
    const normalizedNumber = contactNumber.replace(/\D/g, '')
    
    const where: any = {
      userId,
      instanceId,
      contactNumber: normalizedNumber,
    }

    if (!includePast) {
      where.date = {
        gte: new Date(),
      }
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: {
        date: 'asc',
      },
    })

    return {
      success: true,
      appointments: appointments.map((apt) => ({
        id: apt.id,
        date: apt.date,
        description: apt.description,
        status: apt.status,
        formattedDate: apt.date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        formattedTime: apt.date.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    }
  } catch (error) {
    console.error('Erro ao buscar agendamentos do usuário:', error)
    return {
      success: false,
      error: 'Erro ao buscar agendamentos',
    }
  }
}

/**
 * Atualiza um agendamento existente (muda data/hora)
 */
export async function updateAppointment(
  appointmentId: string,
  userId: string,
  newDate: Date
) {
  try {
    // Verifica se o agendamento existe e pertence ao usuário
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        userId,
      },
    })

    if (!appointment) {
      return {
        success: false,
        error: 'Agendamento não encontrado',
      }
    }

    // Atualiza o agendamento
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        date: newDate,
      },
    })

    return {
      success: true,
      appointment: {
        id: updated.id,
        date: updated.date,
        description: updated.description,
        status: updated.status,
      },
    }
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao atualizar agendamento',
    }
  }
}

/**
 * Cancela um agendamento específico
 */
export async function cancelAppointment(appointmentId: string, userId: string) {
  try {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        userId,
      },
    })

    if (!appointment) {
      return {
        success: false,
        error: 'Agendamento não encontrado',
      }
    }

    const cancelled = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'cancelled' },
    })

    return {
      success: true,
      appointment: {
        id: cancelled.id,
        date: cancelled.date,
        description: cancelled.description,
        status: cancelled.status,
      },
    }
  } catch (error) {
    console.error('Erro ao cancelar agendamento:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao cancelar agendamento',
    }
  }
}

