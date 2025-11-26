/**
 * Funções para gerenciar agendamentos diretamente (usado pela IA)
 */

import { prisma } from './prisma'

export interface CreateAppointmentParams {
  userId: string
  instanceId: string
  contactNumber: string
  contactName?: string
  date: Date // Horário de INÍCIO
  duration?: number // Duração em minutos (padrão: 60)
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

    // CRÍTICO: Calcula horário de término baseado no início + duração
    // A duração DEVE vir do serviço agendado (não usar padrão fixo)
    if (!params.duration || params.duration <= 0) {
      console.error('❌ Duração não especificada ou inválida:', params.duration)
      console.error('❌ A duração deve vir do serviço agendado. Verifique se o serviço tem duração configurada.')
      return {
        success: false,
        error: 'Duração do serviço é obrigatória para criar o agendamento. Verifique se o serviço tem duração configurada.',
      }
    }
    
    const duration = params.duration // Duração do serviço em minutos
    const endDate = new Date(params.date.getTime() + duration * 60000) // Adiciona minutos em milissegundos

    console.log('📅 Calculando horário de término:', {
      inicio: params.date.toISOString(),
      duracao: duration,
      termino: endDate.toISOString(),
    })

    // CRÍTICO: Tenta criar com endDate e duration, mas se falhar, cria sem esses campos
    let appointment
    try {
      appointment = await prisma.appointment.create({
        data: {
          userId: params.userId,
          instanceId: params.instanceId,
          contactNumber: params.contactNumber,
          contactName: params.contactName,
          date: params.date, // Horário de início
          endDate: endDate, // Horário de término calculado
          duration: duration, // Duração em minutos
          description: params.description,
          status: 'pending',
        },
      })
      console.log('✅ [createAppointment] Agendamento criado com endDate e duration')
    } catch (error: any) {
      // Se falhar (provavelmente porque endDate/duration não existem ainda), cria sem esses campos
      console.warn('⚠️ [createAppointment] Erro ao criar com endDate/duration, tentando sem esses campos:', error.message)
      
      try {
        appointment = await prisma.appointment.create({
          data: {
            userId: params.userId,
            instanceId: params.instanceId,
            contactNumber: params.contactNumber,
            contactName: params.contactName,
            date: params.date, // Horário de início
            description: params.description,
            status: 'pending',
          },
        })
        console.log('✅ [createAppointment] Agendamento criado sem endDate/duration (compatibilidade)')
        console.warn('⚠️ [createAppointment] IMPORTANTE: Aplique a migration para adicionar campos endDate e duration')
      } catch (fallbackError) {
        console.error('❌ [createAppointment] Erro também na criação sem endDate/duration:', fallbackError)
        throw fallbackError
      }
    }

    console.log('✅ [createAppointment] Agendamento criado com sucesso no banco:', {
      id: appointment.id,
      date: appointment.date,
      endDate: (appointment as any).endDate || 'não disponível',
      duration: (appointment as any).duration || 'não disponível',
      description: appointment.description,
      status: appointment.status,
    })

    return {
      success: true,
      appointment: {
        id: appointment.id,
        date: appointment.date, // Início
        endDate: (appointment as any).endDate || undefined, // Término (pode não existir)
        duration: (appointment as any).duration || undefined, // Duração (pode não existir)
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
 * Retorna agendamentos CONFIRMADOS (não inclui pendentes, pois eles podem ser cancelados)
 */
export async function checkAvailability(
  userId: string, 
  date: Date,
  instanceId?: string // Opcional: para contexto adicional
) {
  try {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Busca apenas agendamentos CONFIRMADOS (status: 'confirmed' ou 'pending' na tabela Appointment)
    // Não inclui agendamentos pendentes de confirmação (PendingAppointment) pois eles podem ser cancelados
    // CRÍTICO: Tenta buscar com endDate e duration, mas se falhar, busca sem esses campos
    let appointments: Array<{
      date: Date
      endDate?: Date | null
      duration?: number | null
      description?: string | null
    }>
    
    try {
      appointments = await prisma.appointment.findMany({
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
        select: {
          date: true,
          endDate: true,
          duration: true,
          description: true,
        },
        orderBy: {
          date: 'asc',
        },
      })
    } catch (error: any) {
      // Se falhar (provavelmente porque endDate/duration não existem ainda), busca sem esses campos
      console.warn('⚠️ [checkAvailability] Erro ao buscar com endDate/duration, tentando sem esses campos:', error.message)
      try {
        const appointmentsWithoutNewFields = await prisma.appointment.findMany({
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
          select: {
            date: true,
            description: true,
          },
          orderBy: {
            date: 'asc',
          },
        })
        
        // Converte para o formato esperado
        appointments = appointmentsWithoutNewFields.map(apt => ({
          date: apt.date,
          endDate: null,
          duration: null,
          description: apt.description,
        }))
        console.log('✅ [checkAvailability] Busca sem endDate/duration bem-sucedida')
      } catch (fallbackError) {
        console.error('❌ [checkAvailability] Erro também na busca sem endDate/duration:', fallbackError)
        throw fallbackError
      }
    }

    console.log(`📅 [checkAvailability] Data: ${date.toLocaleDateString('pt-BR')}`)
    console.log(`📅 [checkAvailability] Agendamentos encontrados: ${appointments.length}`)

    return {
      success: true,
      appointments: appointments.map((apt) => {
        // CRÍTICO: Calcula endDate se não existir (para compatibilidade com registros antigos)
        const endDate = apt.endDate || new Date(apt.date.getTime() + (apt.duration || 60) * 60000)
        return {
          date: apt.date, // Início
          endDate: endDate, // Término
          duration: apt.duration || 60,
          description: apt.description,
        }
      }),
    }
  } catch (error) {
    console.error('❌ [checkAvailability] Erro ao verificar disponibilidade:', error)
    console.error('❌ [checkAvailability] Stack trace:', error instanceof Error ? error.stack : 'N/A')
    console.error('❌ [checkAvailability] Parâmetros:', { userId, date: date.toISOString(), instanceId })
    
    // Retorna erro mais detalhado para debug
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: `Erro ao verificar disponibilidade: ${errorMessage}`,
    }
  }
}

/**
 * Lista horários disponíveis em uma data específica
 * Retorna horários livres considerando agendamentos existentes E pendentes
 */
export async function getAvailableTimes(
  userId: string,
  date: Date,
  durationMinutes: number = 60,
  startHour: number = 8,
  endHour: number = 18,
  instanceId?: string // Opcional: para considerar agendamentos pendentes de uma instância específica
) {
  try {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Formata a data para comparar com agendamentos pendentes (DD/MM/YYYY)
    const targetDateStr = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    // Busca agendamentos CONFIRMADOS do dia
    // CRÍTICO: Seleciona apenas campos necessários para evitar erros se endDate/duration não existirem
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
      select: {
        date: true,
        endDate: true,
        duration: true,
      },
      orderBy: {
        date: 'asc',
      },
    })

    // CRÍTICO: Busca também agendamentos PENDENTES (não confirmados ainda)
    // Isso evita mostrar horários que já estão reservados mas ainda não confirmados
    const pendingAppointments: Array<{ time: string; duration: number }> = []
    if (instanceId) {
      try {
        const allPending = await prisma.pendingAppointment.findMany({
          where: {
            userId,
            instanceId,
            date: targetDateStr,
            expiresAt: {
              gt: new Date(), // Apenas pendentes que não expiraram
            },
          },
        })
        
        allPending.forEach((pending) => {
          pendingAppointments.push({
            time: pending.time,
            duration: pending.duration || 60, // Usa duração do pendente ou 60min padrão
          })
        })
        
        console.log(`📅 [getAvailableTimes] Encontrados ${allPending.length} agendamentos pendentes para ${targetDateStr}`)
      } catch (error) {
        console.error('❌ Erro ao buscar agendamentos pendentes:', error)
        // Continua mesmo se houver erro
      }
    }

    // Gera todos os horários possíveis do dia (slots de 30 minutos)
    const allSlots: string[] = []
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        allSlots.push(timeStr)
      }
    }

    // Marca horários ocupados por agendamentos CONFIRMADOS
    // CRÍTICO: Usa horário de término real (endDate) em vez de assumir duração
    const occupiedSlots = new Set<string>()
    
    appointments.forEach((apt) => {
      try {
        const aptStart = new Date(apt.date) // Horário de início
        
        // CRÍTICO: Calcula horário de término de forma segura
        // Se endDate existe e é válido, usa ele. Senão, calcula baseado na duração
        let aptEnd: Date
        if (apt.endDate && apt.endDate instanceof Date && !isNaN(apt.endDate.getTime())) {
          aptEnd = new Date(apt.endDate)
        } else {
          // Calcula baseado na duração (usa 60min como fallback apenas para compatibilidade)
          const duration = apt.duration && apt.duration > 0 ? apt.duration : 60
          aptEnd = new Date(aptStart.getTime() + duration * 60000)
        }
        
        // Calcula todos os slots de 30min entre início e término
        let currentTime = new Date(aptStart)
        
        while (currentTime < aptEnd) {
          const slotHour = currentTime.getHours()
          const slotMinute = currentTime.getMinutes()
          
          // Arredonda para o slot de 30min mais próximo (00 ou 30)
          const roundedMinute = slotMinute < 30 ? 0 : 30
          
          if (slotHour < endHour && slotHour >= startHour) {
            const slotStr = `${slotHour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`
            occupiedSlots.add(slotStr)
          }
          
          // Avança 30 minutos
          currentTime = new Date(currentTime.getTime() + 30 * 60000)
        }
      } catch (error) {
        console.error('❌ Erro ao processar agendamento:', error, apt)
        // Continua com o próximo agendamento mesmo se houver erro
      }
    })
    
    // CRÍTICO: Marca também horários ocupados por agendamentos PENDENTES
    // Usa duração real do agendamento pendente
    pendingAppointments.forEach((pending) => {
      const [hour, minute] = pending.time.split(':').map(Number)
      const pendingDuration = pending.duration || 60
      
      // Cria data de início e término para o agendamento pendente
      const pendingStart = new Date(date)
      pendingStart.setHours(hour, minute, 0, 0)
      const pendingEnd = new Date(pendingStart.getTime() + pendingDuration * 60000)
      
      // Marca todos os slots de 30min entre início e término
      let currentTime = new Date(pendingStart)
      
      while (currentTime < pendingEnd) {
        const slotHour = currentTime.getHours()
        const slotMinute = currentTime.getMinutes()
        const roundedMinute = slotMinute < 30 ? 0 : 30
        
        if (slotHour < endHour && slotHour >= startHour) {
          const slotStr = `${slotHour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`
          occupiedSlots.add(slotStr)
        }
        
        // Avança 30 minutos
        currentTime = new Date(currentTime.getTime() + 30 * 60000)
      }
    })

    // Filtra horários disponíveis (que não estão ocupados)
    const availableSlots = allSlots.filter((slot) => !occupiedSlots.has(slot))

    console.log(`📅 [getAvailableTimes] Data: ${targetDateStr}`)
    console.log(`📅 [getAvailableTimes] Agendamentos confirmados: ${appointments.length}`)
    console.log(`📅 [getAvailableTimes] Agendamentos pendentes: ${pendingAppointments.length}`)
    console.log(`📅 [getAvailableTimes] Horários ocupados: ${occupiedSlots.size}`)
    console.log(`📅 [getAvailableTimes] Horários disponíveis: ${availableSlots.length}`)

    return {
      success: true,
      date: targetDateStr,
      availableTimes: availableSlots,
      occupiedTimes: Array.from(occupiedSlots).sort(),
    }
  } catch (error) {
    console.error('❌ Erro ao buscar horários disponíveis:', error)
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A')
    
    // Retorna erro mais detalhado para debug
    return {
      success: false,
      error: `Erro ao buscar horários disponíveis: ${error instanceof Error ? error.message : String(error)}`,
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

