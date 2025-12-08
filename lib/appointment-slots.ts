/**
 * Sistema de Agendamento Baseado em Slots Fixos
 * 
 * Este sistema usa blocos fixos de tempo (slots) para garantir consistência e evitar conflitos.
 * Exemplo: com slot de 15 minutos, os horários possíveis são sempre 07:00, 07:15, 07:30, etc.
 */

import { WorkingHoursConfig, TimeSlot, timeToMinutes } from './working-hours'

export interface SlotConfig {
  slotSizeMinutes: number // Tamanho do slot em minutos (ex: 15, 20, 30)
  bufferMinutes?: number // Buffer entre agendamentos (ex: 5 minutos para limpeza)
}

/**
 * Converte um horário para o próximo slot válido
 * Exemplo: 17:40 com slot de 15min → 17:45
 */
export function roundToNextSlot(
  time: string | Date,
  slotSizeMinutes: number
): string {
  let minutes: number
  
  if (time instanceof Date) {
    minutes = time.getHours() * 60 + time.getMinutes()
  } else {
    const [hours, mins] = time.split(':').map(Number)
    minutes = hours * 60 + mins
  }
  
  // Arredonda para o próximo slot
  const roundedMinutes = Math.ceil(minutes / slotSizeMinutes) * slotSizeMinutes
  
  const hours = Math.floor(roundedMinutes / 60)
  const mins = roundedMinutes % 60
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Converte um horário para o slot mais próximo (para cima ou para baixo)
 */
export function roundToNearestSlot(
  time: string | Date,
  slotSizeMinutes: number
): string {
  let minutes: number
  
  if (time instanceof Date) {
    minutes = time.getHours() * 60 + time.getMinutes()
  } else {
    const [hours, mins] = time.split(':').map(Number)
    minutes = hours * 60 + mins
  }
  
  // Arredonda para o slot mais próximo
  const roundedMinutes = Math.round(minutes / slotSizeMinutes) * slotSizeMinutes
  
  const hours = Math.floor(roundedMinutes / 60)
  const mins = roundedMinutes % 60
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Calcula quantos slots um serviço precisa
 * número_de_slots = ceil(duração_do_serviço / slot)
 */
export function calculateRequiredSlots(
  serviceDurationMinutes: number,
  slotSizeMinutes: number
): number {
  return Math.ceil(serviceDurationMinutes / slotSizeMinutes)
}

/**
 * Gera todos os slots possíveis de um turno
 * Exemplo: turno 07:00-12:00 com slot de 15min → [07:00, 07:15, 07:30, ..., 11:45]
 */
export function generateSlotsForShift(
  shift: TimeSlot,
  slotSizeMinutes: number
): string[] {
  const slots: string[] = []
  const openMinutes = timeToMinutes(shift.openTime)
  const closeMinutes = timeToMinutes(shift.closeTime)
  
  // Gera slots do início ao fim do turno (sem incluir o horário de fechamento)
  for (let minutes = openMinutes; minutes < closeMinutes; minutes += slotSizeMinutes) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`)
  }
  
  return slots
}

/**
 * Gera todos os slots do dia baseado nos turnos de trabalho
 */
export function generateDaySlots(
  date: Date,
  workingHours: WorkingHoursConfig | null | undefined,
  slotSizeMinutes: number
): string[] {
  if (!workingHours) {
    return []
  }
  
  const dayOfWeek = date.getDay()
  const dayMap: Record<number, keyof WorkingHoursConfig> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  }
  
  const dayKey = dayMap[dayOfWeek]
  const dayConfig = workingHours[dayKey]
  
  if (!dayConfig || !dayConfig.isOpen) {
    return []
  }
  
  // Suporta múltiplos turnos ou formato antigo
  let shifts: TimeSlot[] = []
  
  if (dayConfig.slots && dayConfig.slots.length > 0) {
    shifts = dayConfig.slots
  } else if (dayConfig.openTime && dayConfig.closeTime) {
    shifts = [{ openTime: dayConfig.openTime, closeTime: dayConfig.closeTime }]
  } else {
    return []
  }
  
  // Gera slots para todos os turnos do dia
  const allSlots: string[] = []
  shifts.forEach(shift => {
    const shiftSlots = generateSlotsForShift(shift, slotSizeMinutes)
    allSlots.push(...shiftSlots)
  })
  
  return allSlots.sort()
}

/**
 * Marca quais slots estão ocupados baseado nos agendamentos existentes
 * Retorna um Set com os horários (strings HH:mm) que estão ocupados
 */
export function markOccupiedSlots(
  appointments: Array<{ date: Date; endDate?: Date | null; duration?: number | null }>,
  slotSizeMinutes: number,
  bufferMinutes: number = 0
): Set<string> {
  const occupiedSlots = new Set<string>()
  
  appointments.forEach(apt => {
    const start = new Date(apt.date)
    let end: Date
    
    if (apt.endDate && apt.endDate instanceof Date && !isNaN(apt.endDate.getTime())) {
      end = new Date(apt.endDate)
    } else {
      const duration = apt.duration && apt.duration > 0 ? apt.duration : 60
      end = new Date(start.getTime() + duration * 60000)
    }
    
    // Adiciona buffer ao final
    if (bufferMinutes > 0) {
      end = new Date(end.getTime() + bufferMinutes * 60000)
    }
    
    // Marca todos os slots que o agendamento atravessa
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const endMinutes = end.getHours() * 60 + end.getMinutes()
    
    for (let minutes = startMinutes; minutes < endMinutes; minutes += slotSizeMinutes) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      const slotTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
      occupiedSlots.add(slotTime)
    }
  })
  
  return occupiedSlots
}

/**
 * Encontra horários válidos de início para um serviço
 * Um horário é válido se existem N slots consecutivos livres (N = número de slots do serviço)
 */
export function findValidStartTimes(
  allSlots: string[],
  occupiedSlots: Set<string>,
  requiredSlots: number
): string[] {
  const validTimes: string[] = []
  
  // Verifica cada slot como possível início
  for (let i = 0; i <= allSlots.length - requiredSlots; i++) {
    // Verifica se há N slots consecutivos livres
    let allFree = true
    for (let j = 0; j < requiredSlots; j++) {
      if (i + j >= allSlots.length) {
        // Não há slots suficientes restantes
        allFree = false
        break
      }
      if (occupiedSlots.has(allSlots[i + j])) {
        allFree = false
        break
      }
    }
    
    if (allFree) {
      // CRÍTICO: Verifica se o último slot necessário ainda existe na lista
      // Se requiredSlots = 2 e o último slot do turno é 11:45, então 11:45 não pode ser início
      // porque precisaria de 12:00 que não existe na lista
      const lastSlotIndex = i + requiredSlots - 1
      if (lastSlotIndex < allSlots.length) {
        validTimes.push(allSlots[i])
      }
    }
  }
  
  return validTimes
}

/**
 * Converte um horário solicitado pelo cliente para o próximo slot válido
 * Se o horário não estiver disponível, sugere os 3 horários válidos mais próximos
 */
export function convertToValidSlot(
  requestedTime: string | Date,
  validStartTimes: string[],
  slotSizeMinutes: number
): {
  convertedTime: string | null
  suggestions: string[]
} {
  // Converte para o próximo slot
  const roundedTime = roundToNextSlot(requestedTime, slotSizeMinutes)
  
  // Verifica se o horário convertido está disponível
  if (validStartTimes.includes(roundedTime)) {
    return {
      convertedTime: roundedTime,
      suggestions: []
    }
  }
  
  // Se não está disponível, encontra os 3 mais próximos
  const suggestions: string[] = []
  const requestedMinutes = timeToMinutes(roundedTime)
  
  // Ordena horários válidos por proximidade
  const sortedByProximity = [...validStartTimes].sort((a, b) => {
    const diffA = Math.abs(timeToMinutes(a) - requestedMinutes)
    const diffB = Math.abs(timeToMinutes(b) - requestedMinutes)
    return diffA - diffB
  })
  
  // Pega os 3 mais próximos
  suggestions.push(...sortedByProximity.slice(0, 3))
  
  return {
    convertedTime: null,
    suggestions
  }
}

/**
 * Função principal: encontra horários disponíveis usando o sistema de slots
 */
export function findAvailableSlots(
  date: Date,
  serviceDurationMinutes: number,
  workingHours: WorkingHoursConfig | null | undefined,
  existingAppointments: Array<{ date: Date; endDate?: Date | null; duration?: number | null }>,
  slotConfig: SlotConfig
): {
  availableTimes: string[]
  allSlots: string[]
  occupiedSlots: Set<string>
} {
  const { slotSizeMinutes, bufferMinutes = 0 } = slotConfig
  
  // 1. Gera todos os slots do dia
  const allSlots = generateDaySlots(date, workingHours, slotSizeMinutes)
  
  if (allSlots.length === 0) {
    return {
      availableTimes: [],
      allSlots: [],
      occupiedSlots: new Set()
    }
  }
  
  // 2. Calcula quantos slots o serviço precisa
  const requiredSlots = calculateRequiredSlots(serviceDurationMinutes, slotSizeMinutes)
  
  // 3. Marca slots ocupados
  const occupiedSlots = markOccupiedSlots(existingAppointments, slotSizeMinutes, bufferMinutes)
  
  // 4. Encontra horários válidos de início
  const availableTimes = findValidStartTimes(allSlots, occupiedSlots, requiredSlots)
  
  return {
    availableTimes,
    allSlots,
    occupiedSlots
  }
}

