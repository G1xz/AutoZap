/**
 * Funções para gerenciar agendamentos diretamente (usado pela IA)
 */

import { prisma } from './prisma'
import { canFitAppointment, WorkingHoursConfig, formatTime24h } from './working-hours'
import { getUserWorkingHours } from './user-working-hours'
import { findAvailableSlots, roundToNextSlot, convertToValidSlot } from './appointment-slots'
import { getUserSlotConfig } from './user-slot-config'
import type { SlotConfig } from './appointment-slots'

/**
 * Agrupa horários consecutivos em intervalos
 * Ex: ["08:00", "08:15", "08:30", "09:00", "09:15"] → ["das 08:00 às 08:45", "das 09:00 às 09:45"]
 * Se houver poucos horários, retorna individualmente
 */
export function groupConsecutiveTimes(times: string[], durationMinutes: number = 15): string[] {
  if (times.length === 0) return []
  if (times.length <= 5) return times // Se houver poucos horários, retorna individualmente
  
  // Converte horários para minutos desde meia-noite para facilitar comparação
  const timeToMinutes = (time: string): number => {
    const [hour, minute] = time.split(':').map(Number)
    return hour * 60 + minute
  }
  
  const minutesToTime = (minutes: number): string => {
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  }
  
  // Ordena os horários
  const sortedTimes = [...times].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
  
  const intervals: string[] = []
  let intervalStart = sortedTimes[0]
  let intervalEndTime = sortedTimes[0]
  
  for (let i = 1; i < sortedTimes.length; i++) {
    const currentTime = sortedTimes[i]
    const currentMinutes = timeToMinutes(currentTime)
    const intervalEndMinutes = timeToMinutes(intervalEndTime) + durationMinutes
    
    // Se o próximo horário está dentro do intervalo atual (considerando a duração), continua o intervalo
    // Se não está, fecha o intervalo atual e abre um novo
    if (currentMinutes <= intervalEndMinutes + durationMinutes) {
      // Continua o intervalo: atualiza o fim do intervalo para o último horário + duração
      intervalEndTime = currentTime
    } else {
      // Fecha o intervalo atual
      const intervalEnd = minutesToTime(timeToMinutes(intervalEndTime) + durationMinutes)
      
      if (intervalStart === intervalEndTime) {
        // Intervalo de um único horário
        intervals.push(intervalStart)
      } else {
        // Intervalo com múltiplos horários
        intervals.push(`das ${intervalStart} às ${intervalEnd}`)
      }
      
      // Abre novo intervalo
      intervalStart = currentTime
      intervalEndTime = currentTime
    }
  }
  
  // Adiciona o último intervalo
  const finalIntervalEnd = minutesToTime(timeToMinutes(intervalEndTime) + durationMinutes)
  
  if (intervalStart === intervalEndTime) {
    intervals.push(intervalStart)
  } else {
    intervals.push(`das ${intervalStart} às ${finalIntervalEnd}`)
  }
  
  return intervals
}

export interface CreateAppointmentParams {
  userId: string
  instanceId: string | null
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
export async function createAppointment(
  params: CreateAppointmentParams,
  workingHours?: WorkingHoursConfig | null
) {
  try {
    // Busca configuração de slots do usuário
    const slotConfig = await getUserSlotConfig(params.userId)
    
    // Converte o horário para o slot mais próximo se necessário
    const originalTime = formatTime24h(params.date)
    const roundedTime = roundToNextSlot(params.date, slotConfig.slotSizeMinutes)
    
    // Se o horário foi ajustado, atualiza a data
    if (originalTime !== roundedTime) {
      const [hours, minutes] = roundedTime.split(':').map(Number)
      params.date.setHours(hours, minutes, 0, 0)
      console.log(`📅 [createAppointment] Horário ajustado para slot: ${originalTime} → ${roundedTime}`)
    }
    
    console.log('📅 createAppointment chamado com params:', {
      userId: params.userId,
      instanceId: params.instanceId,
      contactNumber: params.contactNumber,
      contactName: params.contactName,
      date: params.date,
      dateISO: params.date.toISOString(),
      description: params.description,
      slotConfig: slotConfig,
    })

    // Validações robustas
    if (!params.userId || typeof params.userId !== 'string' || params.userId.trim().length === 0) {
      console.error('❌ userId é obrigatório e deve ser uma string válida')
      return {
        success: false,
        error: 'userId é obrigatório e deve ser uma string válida',
      }
    }

    if (!params.instanceId) {
      console.warn('⚠️ instanceId não informado - criando agendamento sem vincular a uma instância específica')
    } else if (typeof params.instanceId !== 'string' || params.instanceId.trim().length === 0) {
      console.warn('⚠️ instanceId inválido, criando sem vincular')
      params.instanceId = null
    }

    if (!params.contactNumber || typeof params.contactNumber !== 'string' || params.contactNumber.trim().length === 0) {
      console.error('❌ contactNumber é obrigatório e deve ser uma string válida')
      return {
        success: false,
        error: 'contactNumber é obrigatório e deve ser uma string válida',
      }
    }

    if (!params.date || !(params.date instanceof Date) || isNaN(params.date.getTime())) {
      console.error('❌ date é inválida:', params.date)
      return {
        success: false,
        error: 'date deve ser uma data válida',
      }
    }
    
    // Valida que a data não é muito antiga (mais de 1 ano atrás)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    if (params.date < oneYearAgo) {
      console.error('❌ date é muito antiga:', params.date)
      return {
        success: false,
        error: 'Não é possível agendar para uma data há mais de 1 ano',
      }
    }
    
    // Valida que a data não é muito futura (mais de 2 anos)
    const twoYearsFromNow = new Date()
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2)
    if (params.date > twoYearsFromNow) {
      console.error('❌ date é muito futura:', params.date)
      return {
        success: false,
        error: 'Não é possível agendar para mais de 2 anos no futuro',
      }
    }

    // Busca horários globais do usuário se não foram fornecidos
    let finalWorkingHours = workingHours
    if (!finalWorkingHours) {
      finalWorkingHours = await getUserWorkingHours(params.userId)
    }

    // Valida horário de funcionamento ANTES de criar o agendamento
    if (finalWorkingHours) {
      const duration = params.duration || 60
      const validation = canFitAppointment(params.date, duration, finalWorkingHours)
      if (!validation.valid) {
        console.warn('⚠️ Agendamento fora do horário de funcionamento:', validation.reason)
        
        // Busca horários alternativos disponíveis no mesmo dia
        let errorMessage = validation.reason || 'Agendamento fora do horário de funcionamento'
        try {
          const availableTimesResult = await getAvailableTimes(
            params.userId,
            params.date,
            duration,
            undefined,
            undefined,
            params.instanceId || undefined,
            finalWorkingHours
          )

          if (availableTimesResult.success && availableTimesResult.availableTimes && availableTimesResult.availableTimes.length > 0) {
            // Pega os primeiros 5 horários disponíveis
            const suggestions = availableTimesResult.availableTimes.slice(0, 5)
            const suggestionsText = suggestions.map(t => `• ${t}`).join('\n')
            
            errorMessage += `\n\n💡 Horários disponíveis no mesmo dia:\n${suggestionsText}`
          }
        } catch (error) {
          console.error('Erro ao buscar horários alternativos:', error)
          // Continua mesmo se houver erro ao buscar horários alternativos
        }
        
        return {
          success: false,
          error: errorMessage,
        }
      }
    }

    // CRÍTICO: Calcula horário de término baseado no início + duração
    // A duração DEVE vir do serviço agendado (não usar padrão fixo)
    if (!params.duration || typeof params.duration !== 'number' || params.duration <= 0) {
      console.error('❌ Duração não especificada ou inválida:', params.duration)
      console.error('❌ A duração deve vir do serviço agendado. Verifique se o serviço tem duração configurada.')
      return {
        success: false,
        error: 'Duração do serviço é obrigatória para criar o agendamento. Verifique se o serviço tem duração configurada.',
      }
    }
    
    // Valida limites razoáveis de duração
    if (params.duration > 1440) { // 24 horas
      console.error('❌ Duração muito longa:', params.duration)
      return {
        success: false,
        error: 'Duração máxima permitida é 24 horas (1440 minutos)',
      }
    }
    
    if (params.duration < 5) { // Mínimo 5 minutos
      console.error('❌ Duração muito curta:', params.duration)
      return {
        success: false,
        error: 'Duração mínima permitida é 5 minutos',
      }
    }
    
    const duration = Math.round(params.duration) // Garante que é inteiro
    const endDate = new Date(params.date.getTime() + duration * 60000) // Adiciona minutos em milissegundos
    
    // Valida que o horário de término é válido
    if (isNaN(endDate.getTime())) {
      console.error('❌ Horário de término inválido calculado')
      return {
        success: false,
        error: 'Erro ao calcular horário de término do agendamento',
      }
    }

    console.log('📅 Calculando horário de término:', {
      inicio: params.date.toISOString(),
      duracao: duration,
      termino: endDate.toISOString(),
    })

    // CRÍTICO: Tenta criar com endDate e duration primeiro
    // Se falhar porque a coluna não existe, usa SQL raw para criar sem endDate
    let appointment
    try {
      appointment = await prisma.appointment.create({
      data: {
        userId: params.userId,
        instanceId: params.instanceId || null,
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
      // Se falhar porque endDate não existe no banco, cria usando SQL raw sem endDate
      if (error.code === 'P2022' || error.message?.includes('endDate') || error.message?.includes('does not exist')) {
        console.warn('⚠️ [createAppointment] Coluna endDate não existe no banco, criando sem esse campo')
        
        try {
          // Usa SQL raw para criar sem endDate (compatibilidade com banco antigo)
          // Gera ID usando função similar ao cuid() do Prisma
          const generateId = () => {
            const timestamp = Date.now().toString(36)
            const random = Math.random().toString(36).substring(2, 15)
            return `${timestamp}${random}`
          }
          
          const appointmentId = generateId()
          const now = new Date()
          
          // Insere diretamente no banco sem passar pelo Prisma Client (que valida o schema)
          await prisma.$executeRawUnsafe(`
            INSERT INTO "Appointment" (
              id, "userId", "instanceId", "contactNumber", "contactName", 
              date, description, status, "createdAt", "updatedAt"
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )
          `, 
            appointmentId,
            params.userId,
            params.instanceId || null,
            params.contactNumber,
            params.contactName || null,
            params.date,
            params.description || null,
            'pending',
            now,
            now
          )
          
          // Busca o agendamento criado usando query raw (evita validação do Prisma Client)
          const result = await prisma.$queryRawUnsafe<Array<{
            id: string
            userId: string
            instanceId: string | null
            contactNumber: string
            contactName: string | null
            date: Date
            description: string | null
            status: string
            createdAt: Date
            updatedAt: Date
          }>>(`
            SELECT id, "userId", "instanceId", "contactNumber", "contactName", 
                   date, description, status, "createdAt", "updatedAt"
            FROM "Appointment"
            WHERE id = $1
          `, appointmentId)
          
          if (!result || result.length === 0) {
            throw new Error('Agendamento criado mas não encontrado após criação')
          }
          
          const created = result[0]
          
          // Converte para o formato esperado pelo Prisma (sem endDate)
          appointment = {
            id: created.id,
            userId: created.userId,
            instanceId: created.instanceId,
            contactNumber: created.contactNumber,
            contactName: created.contactName,
            date: created.date,
            description: created.description,
            status: created.status as any,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
          } as any
          
          console.log('✅ [createAppointment] Agendamento criado sem endDate (compatibilidade com banco antigo)')
          console.warn('⚠️ [createAppointment] IMPORTANTE: Aplique a migration para adicionar campos endDate e duration')
        } catch (fallbackError: any) {
          console.error('❌ [createAppointment] Erro ao criar sem endDate:', fallbackError)
          return {
            success: false,
            error: `Erro ao criar agendamento: ${fallbackError.message || 'Erro desconhecido'}. Por favor, verifique se a migration foi aplicada ou entre em contato com o suporte.`,
          }
        }
      } else {
        // Outro tipo de erro, propaga
        console.error('❌ [createAppointment] Erro ao criar agendamento:', error)
        return {
          success: false,
          error: `Erro ao criar agendamento: ${error.message || 'Erro desconhecido'}`,
        }
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

    // CRÍTICO: Busca agendamentos CONFIRMADOS E também PENDENTES de confirmação
    // Ambos devem ser considerados para evitar contradições entre checkAvailability e getAvailableTimes
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

    // CRÍTICO: Busca também agendamentos PENDENTES (não confirmados ainda)
    // Isso garante consistência com getAvailableTimes e evita contradições
    const pendingAppointments: Array<{ date: Date; endDate: Date; duration: number; description?: string }> = []
    if (instanceId) {
      try {
        const targetDateStr = date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        
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
          const [hour, minute] = pending.time.split(':').map(Number)
          const pendingDuration = pending.duration || 60
          
          // Cria data de início e término para o agendamento pendente
          const pendingStart = new Date(date)
          pendingStart.setHours(hour, minute, 0, 0)
          const pendingEnd = new Date(pendingStart.getTime() + pendingDuration * 60000)
          
          pendingAppointments.push({
            date: pendingStart,
            endDate: pendingEnd,
            duration: pendingDuration,
            description: pending.service || pending.description || undefined,
          })
        })
        
        console.log(`📅 [checkAvailability] Encontrados ${allPending.length} agendamentos pendentes para ${targetDateStr}`)
      } catch (error) {
        console.error('❌ Erro ao buscar agendamentos pendentes em checkAvailability:', error)
        // Continua mesmo se houver erro
      }
    }

    console.log(`📅 [checkAvailability] Data: ${date.toLocaleDateString('pt-BR')}`)
    console.log(`📅 [checkAvailability] Agendamentos confirmados encontrados: ${appointments.length}`)
    console.log(`📅 [checkAvailability] Agendamentos pendentes encontrados: ${pendingAppointments.length}`)

    // Combina agendamentos confirmados e pendentes
    const allAppointments = [
      ...appointments.map((apt) => {
        // CRÍTICO: Calcula endDate se não existir (para compatibilidade com registros antigos)
        const endDate = apt.endDate || new Date(apt.date.getTime() + (apt.duration || 60) * 60000)
        return {
          date: apt.date, // Início
          endDate: endDate, // Término
          duration: apt.duration || 60,
          description: apt.description || undefined,
        }
      }),
      ...pendingAppointments,
    ]

    return {
      success: true,
      appointments: allAppointments,
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
  instanceId?: string, // Opcional: para considerar agendamentos pendentes de uma instância específica
  workingHours?: WorkingHoursConfig | null // Opcional: horários de funcionamento estruturados (se não fornecido, busca do usuário)
) {
  // Busca horários globais do usuário se não foram fornecidos
  let finalWorkingHours = workingHours
  if (!finalWorkingHours) {
    finalWorkingHours = await getUserWorkingHours(userId)
  }

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
    // CRÍTICO: Tenta buscar com endDate e duration, mas se falhar, busca sem esses campos
    let appointments: Array<{
      date: Date
      endDate?: Date | null
      duration?: number | null
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
        },
        orderBy: {
          date: 'asc',
        },
      })
    } catch (error: any) {
      // Se falhar (provavelmente porque endDate/duration não existem ainda), busca sem esses campos
      console.warn('⚠️ [getAvailableTimes] Erro ao buscar com endDate/duration, tentando sem esses campos:', error.message)
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
        }))
        console.log('✅ [getAvailableTimes] Busca sem endDate/duration bem-sucedida')
      } catch (fallbackError) {
        console.error('❌ [getAvailableTimes] Erro também na busca sem endDate/duration:', fallbackError)
        throw fallbackError
      }
    }

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

    // CRÍTICO: Coleta todos os intervalos ocupados (início e fim) de agendamentos confirmados e pendentes
    const occupiedIntervals: Array<{ start: Date; end: Date }> = []
    
    // Processa agendamentos CONFIRMADOS
    appointments.forEach((apt) => {
      try {
        const aptStart = new Date(apt.date) // Horário de início
        
        // CRÍTICO: Calcula horário de término de forma segura
        let aptEnd: Date
        if (apt.endDate && apt.endDate instanceof Date && !isNaN(apt.endDate.getTime())) {
          aptEnd = new Date(apt.endDate)
        } else {
          const duration = apt.duration && apt.duration > 0 ? apt.duration : 60
          aptEnd = new Date(aptStart.getTime() + duration * 60000)
        }
        
        // Apenas adiciona se estiver dentro do horário de funcionamento
        if (aptStart.getHours() < endHour && aptEnd.getHours() >= startHour) {
          occupiedIntervals.push({ start: aptStart, end: aptEnd })
        }
      } catch (error) {
        console.error('❌ Erro ao processar agendamento:', error, apt)
      }
    })
    
    // Processa agendamentos PENDENTES
    pendingAppointments.forEach((pending) => {
      const [hour, minute] = pending.time.split(':').map(Number)
      const pendingDuration = pending.duration || 60
      
      const pendingStart = new Date(date)
      pendingStart.setHours(hour, minute, 0, 0)
      const pendingEnd = new Date(pendingStart.getTime() + pendingDuration * 60000)
      
      // CRÍTICO: Adiciona se o agendamento pendente se sobrepõe com o horário de funcionamento
      // Verifica se o agendamento começa antes do fim do horário E termina depois do início
      const overlapsWithBusinessHours = pendingStart.getHours() < endHour && 
        (pendingEnd.getHours() > startHour || (pendingEnd.getHours() === startHour && pendingEnd.getMinutes() > 0))
      
      if (overlapsWithBusinessHours) {
        occupiedIntervals.push({ start: pendingStart, end: pendingEnd })
        console.log(`📅 [getAvailableTimes] Agendamento pendente adicionado aos ocupados: ${pending.time} (${pendingDuration}min) → ${formatTime24h(pendingStart)} até ${formatTime24h(pendingEnd)}`)
      } else {
        console.log(`⚠️ [getAvailableTimes] Agendamento pendente fora do horário de funcionamento: ${pending.time} (${pendingDuration}min)`)
      }
    })

    // NOVO: Sistema baseado em slots fixos
    // Busca configuração de slots do usuário
    const slotConfig = await getUserSlotConfig(userId)
    
    // Combina agendamentos confirmados e pendentes
    const allAppointments = [
      ...appointments,
      ...pendingAppointments.map(pending => {
        const [hour, minute] = pending.time.split(':').map(Number)
        const pendingStart = new Date(date)
        pendingStart.setHours(hour, minute, 0, 0)
        const pendingDuration = pending.duration || 60
        const pendingEnd = new Date(pendingStart.getTime() + pendingDuration * 60000)
        
        return {
          date: pendingStart,
          endDate: pendingEnd,
          duration: pendingDuration,
        }
      })
    ]
    
    // Usa o sistema de slots para encontrar horários disponíveis
    const { availableTimes: availableSlots } = findAvailableSlots(
      date,
      durationMinutes,
      finalWorkingHours,
      allAppointments,
      slotConfig
    )
    
    console.log(`📅 [getAvailableTimes] Sistema de slots: slotSize=${slotConfig.slotSizeMinutes}min, buffer=${slotConfig.bufferMinutes}min`)
    console.log(`📅 [getAvailableTimes] Horários disponíveis encontrados: ${availableSlots.length}`)

    console.log(`📅 [getAvailableTimes] Data: ${targetDateStr}`)
    console.log(`📅 [getAvailableTimes] Agendamentos confirmados: ${appointments.length}`)
    console.log(`📅 [getAvailableTimes] Agendamentos pendentes: ${pendingAppointments.length}`)
    console.log(`📅 [getAvailableTimes] Intervalos ocupados: ${occupiedIntervals.length}`)
    console.log(`📅 [getAvailableTimes] Horários disponíveis: ${availableSlots.length}`)

    // Converte intervalos ocupados para lista de horários para compatibilidade
    const occupiedTimes: string[] = []
    occupiedIntervals.forEach((interval) => {
      const startTime = `${interval.start.getHours().toString().padStart(2, '0')}:${interval.start.getMinutes().toString().padStart(2, '0')}`
      const endTime = `${interval.end.getHours().toString().padStart(2, '0')}:${interval.end.getMinutes().toString().padStart(2, '0')}`
      occupiedTimes.push(`${startTime}-${endTime}`)
    })
    
    return {
      success: true,
      date: targetDateStr,
      availableTimes: availableSlots,
      occupiedTimes: occupiedTimes.sort(),
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
 * Busca horários disponíveis próximos ao horário solicitado (3 antes e 3 depois)
 * Respeita a duração do serviço e os turnos de funcionamento
 * CRÍTICO: Verifica se o agendamento completo (início + duração) cabe dentro do turno
 */
export async function getAvailableTimesNear(
  userId: string,
  requestedDate: Date,
  durationMinutes: number,
  instanceId?: string,
  workingHours?: WorkingHoursConfig | null
): Promise<string[]> {
  try {
    // Busca todos os horários disponíveis do dia
    const allAvailable = await getAvailableTimes(
      userId,
      requestedDate,
      durationMinutes,
      undefined,
      undefined,
      instanceId,
      workingHours
    )
    
    if (!allAvailable.success || !allAvailable.availableTimes || allAvailable.availableTimes.length === 0) {
      return []
    }
    
    // Busca horários de funcionamento se não foram fornecidos
    let finalWorkingHours = workingHours
    if (!finalWorkingHours) {
      const { getUserWorkingHours } = await import('./user-working-hours')
      finalWorkingHours = await getUserWorkingHours(userId)
    }
    
    // Converte horário solicitado para minutos totais do dia
    const requestedHour = requestedDate.getHours()
    const requestedMinute = requestedDate.getMinutes()
    const requestedTotalMinutes = requestedHour * 60 + requestedMinute
    
    // Converte todos os horários disponíveis para minutos e ordena
    const availableMinutes = allAvailable.availableTimes
      .map(time => {
        const [h, m] = time.split(':').map(Number)
        return h * 60 + m
      })
      .sort((a, b) => a - b)
    
    // CRÍTICO: Filtra apenas horários onde o agendamento completo cabe no turno
    const validMinutes: number[] = []
    
    for (const startMinutes of availableMinutes) {
      // Calcula horário de término do agendamento
      const endMinutes = startMinutes + durationMinutes
      
      // Cria uma data de teste para validar
      const testDate = new Date(requestedDate)
      testDate.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0)
      
      // Verifica se o agendamento cabe no horário de funcionamento
      if (finalWorkingHours) {
        const { canFitAppointment } = await import('./working-hours')
        const validation = canFitAppointment(testDate, durationMinutes, finalWorkingHours)
        if (validation.valid) {
          validMinutes.push(startMinutes)
        } else {
          // Log para debug
          const timeStr = `${Math.floor(startMinutes / 60).toString().padStart(2, '0')}:${(startMinutes % 60).toString().padStart(2, '0')}`
          console.log(`⚠️ [getAvailableTimesNear] Horário ${timeStr} rejeitado: ${validation.reason}`)
        }
      } else {
        // Se não há horários configurados, aceita todos
        validMinutes.push(startMinutes)
      }
    }
    
    console.log(`📅 [getAvailableTimesNear] Horários disponíveis: ${availableMinutes.length}, Válidos após validação: ${validMinutes.length}`)
    
    // Encontra o índice do horário solicitado (ou o mais próximo) nos horários válidos
    let requestedIndex = validMinutes.findIndex(m => m >= requestedTotalMinutes)
    if (requestedIndex === -1) {
      // Se não encontrou nenhum depois, pega o último
      requestedIndex = validMinutes.length
    }
    
    // Pega 3 antes e 3 depois
    const startIndex = Math.max(0, requestedIndex - 3)
    const endIndex = Math.min(validMinutes.length, requestedIndex + 3)
    const nearbyMinutes = validMinutes.slice(startIndex, endIndex)
    
    // Converte de volta para formato HH:mm
    const nearbyTimes = nearbyMinutes.map(minutes => {
      const h = Math.floor(minutes / 60)
      const m = minutes % 60
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    })
    
    return nearbyTimes
  } catch (error) {
    console.error('❌ Erro ao buscar horários próximos:', error)
    return []
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

    // CRÍTICO: Usa select explícito para evitar erro se endDate não existir no banco
    let appointments: Array<{
      id: string
      date: Date
      description: string | null
      status: string
      endDate?: Date | null
      duration?: number | null
    }>
    
    try {
      appointments = await prisma.appointment.findMany({
        where,
        select: {
          id: true,
          date: true,
          description: true,
          status: true,
          endDate: true,
          duration: true,
        },
        orderBy: {
          date: 'asc',
        },
      })
    } catch (error: any) {
      // Se falhar (provavelmente porque endDate/duration não existem ainda), busca sem esses campos
      console.warn('⚠️ [getUserAppointments] Erro ao buscar com endDate/duration, tentando sem esses campos:', error.message)
      try {
        const appointmentsWithoutNewFields = await prisma.appointment.findMany({
          where,
          select: {
            id: true,
            date: true,
            description: true,
            status: true,
          },
          orderBy: {
            date: 'asc',
          },
        })
        
        // Converte para o formato esperado
        appointments = appointmentsWithoutNewFields.map(apt => ({
          ...apt,
          endDate: null,
          duration: null,
        }))
        console.log('✅ [getUserAppointments] Busca sem endDate/duration bem-sucedida')
      } catch (fallbackError) {
        console.error('❌ [getUserAppointments] Erro também na busca sem endDate/duration:', fallbackError)
        throw fallbackError
      }
    }

    return {
      success: true,
      appointments: appointments.map((apt) => {
        // Calcula endDate e formattedEndTime se não existir
        const endDate = apt.endDate || (apt.duration ? new Date(apt.date.getTime() + apt.duration * 60000) : null)
        
        return {
          id: apt.id,
          date: apt.date,
          description: apt.description,
          status: apt.status,
          formattedDate: apt.date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
          formattedTime: formatTime24h(apt.date),
          formattedEndTime: endDate ? formatTime24h(endDate) : undefined,
        }
      }),
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
    // CRÍTICO: Usa select explícito para evitar erro se endDate não existir no banco
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        userId,
      },
      select: {
        id: true,
        date: true,
        description: true,
        status: true,
        duration: true,
        // endDate pode não existir no banco ainda
      },
    })

    if (!appointment) {
      return {
        success: false,
        error: 'Agendamento não encontrado',
      }
    }

    // Atualiza o agendamento
    // CRÍTICO: Tenta atualizar com endDate, mas se falhar, atualiza sem esse campo
    let updated: any
    try {
      // Calcula novo endDate baseado na duração existente
      const newEndDate = appointment.duration 
        ? new Date(newDate.getTime() + appointment.duration * 60000)
        : new Date(newDate.getTime() + 60 * 60000) // Padrão 60min se não tiver duração
      
      updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          date: newDate,
          endDate: newEndDate,
        },
        select: {
          id: true,
          date: true,
          description: true,
          status: true,
        },
      })
    } catch (error: any) {
      // Se falhar porque endDate não existe, atualiza sem esse campo
      if (error.code === 'P2022' || error.message?.includes('endDate') || error.message?.includes('does not exist')) {
        console.warn('⚠️ [updateAppointment] Coluna endDate não existe, atualizando sem esse campo')
        updated = await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            date: newDate,
          },
          select: {
            id: true,
            date: true,
            description: true,
            status: true,
          },
        })
      } else {
        throw error
      }
    }

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
    // CRÍTICO: Usa select explícito para evitar erro se endDate não existir no banco
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        userId,
      },
      select: {
        id: true,
        date: true,
        description: true,
        status: true,
        duration: true,
        // endDate pode não existir no banco ainda
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

