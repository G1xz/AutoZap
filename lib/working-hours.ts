/**
 * Utilitários para gerenciar horários de funcionamento
 */

export interface TimeSlot {
  openTime: string // Formato HH:mm (ex: "09:00")
  closeTime: string // Formato HH:mm (ex: "18:00")
}

export interface DayWorkingHours {
  day: number // 0 = domingo, 1 = segunda, ..., 6 = sábado
  isOpen: boolean
  slots?: TimeSlot[] // Array de turnos (permite múltiplos períodos no mesmo dia)
  // Compatibilidade com versão antiga (um único turno)
  openTime?: string // Formato HH:mm (ex: "09:00")
  closeTime?: string // Formato HH:mm (ex: "18:00")
}

export interface WorkingHoursConfig {
  monday?: DayWorkingHours
  tuesday?: DayWorkingHours
  wednesday?: DayWorkingHours
  thursday?: DayWorkingHours
  friday?: DayWorkingHours
  saturday?: DayWorkingHours
  sunday?: DayWorkingHours
}

/**
 * Converte horário HH:mm para minutos desde meia-noite
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Verifica se um horário está dentro do horário de funcionamento
 */
export function isWithinWorkingHours(
  date: Date,
  workingHours: WorkingHoursConfig | null | undefined
): { valid: boolean; reason?: string } {
  if (!workingHours) {
    // Se não há configuração de horários, permite qualquer horário
    return { valid: true }
  }

  const dayOfWeek = date.getDay() // 0 = domingo, 1 = segunda, ..., 6 = sábado
  
  // Mapeia dia da semana para chave do objeto
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

  if (!dayConfig) {
    // Se não há configuração para este dia, permite
    return { valid: true }
  }

  if (!dayConfig.isOpen) {
    const dayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
    return {
      valid: false,
      reason: `Não funcionamos aos ${dayNames[dayOfWeek]}s.`,
    }
  }

  const appointmentTime = date.getHours() * 60 + date.getMinutes()
  
  // Suporta múltiplos turnos (slots) ou formato antigo (openTime/closeTime)
  let slots: TimeSlot[] = []
  
  if (dayConfig.slots && dayConfig.slots.length > 0) {
    // Novo formato: múltiplos turnos
    slots = dayConfig.slots
  } else if (dayConfig.openTime && dayConfig.closeTime) {
    // Formato antigo: um único turno (compatibilidade)
    slots = [{ openTime: dayConfig.openTime, closeTime: dayConfig.closeTime }]
  } else {
    // Se está aberto mas não tem horários definidos, permite
    return { valid: true }
  }

  // Verifica se o horário está dentro de algum turno
  for (const slot of slots) {
    const openMinutes = timeToMinutes(slot.openTime)
    const closeMinutes = timeToMinutes(slot.closeTime)
    
    // CRÍTICO: Horário deve estar dentro do turno (>= abertura e < fechamento)
    // Não permite horário exatamente no fechamento (ex: 12:00 quando turno termina às 12:00)
    if (appointmentTime >= openMinutes && appointmentTime < closeMinutes) {
      return { valid: true }
    }
  }

  // Se não está em nenhum turno, retorna erro com mensagem mais específica
  const firstSlot = slots[0]
  const lastSlot = slots[slots.length - 1]
  
  if (appointmentTime < timeToMinutes(firstSlot.openTime)) {
    return {
      valid: false,
      reason: `Nosso horário de funcionamento começa às ${formatTimeString24h(firstSlot.openTime)}.`,
    }
  }
  
  // Verifica se está entre turnos (ex: 12:00 quando há turno 9h-12h e 13h-19h)
  // Procura se há um turno seguinte que começa depois
  let nextSlot: TimeSlot | null = null
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const slotCloseMinutes = timeToMinutes(slot.closeTime)
    if (appointmentTime >= slotCloseMinutes) {
      // Encontrou um turno que já fechou, procura o próximo
      if (i + 1 < slots.length) {
        nextSlot = slots[i + 1]
        break
      }
    }
  }
  
  if (nextSlot) {
    // nextSlot.openTime já é uma string no formato "HH:mm", não precisa converter
    return {
      valid: false,
      reason: `Este horário está entre nossos turnos de funcionamento. O próximo turno começa às ${formatTimeString24h(nextSlot.openTime)}.`,
    }
  }
  
  // Se não há próximo turno, está após o último turno
  return {
    valid: false,
    reason: `Nosso horário de funcionamento termina às ${formatTimeString24h(lastSlot.closeTime)}.`,
  }
}

/**
 * Verifica se um agendamento (com duração) cabe dentro do horário de funcionamento
 */
export function canFitAppointment(
  startDate: Date,
  durationMinutes: number,
  workingHours: WorkingHoursConfig | null | undefined
): { valid: boolean; reason?: string } {
  // Primeiro verifica se o início está dentro do horário
  const startCheck = isWithinWorkingHours(startDate, workingHours)
  if (!startCheck.valid) {
    return startCheck
  }

  if (!workingHours) {
    return { valid: true }
  }

  const dayOfWeek = startDate.getDay()
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
    return { valid: true }
  }

  // Suporta múltiplos turnos (slots) ou formato antigo (openTime/closeTime)
  let slots: TimeSlot[] = []
  
  if (dayConfig.slots && dayConfig.slots.length > 0) {
    slots = dayConfig.slots
  } else if (dayConfig.openTime && dayConfig.closeTime) {
    slots = [{ openTime: dayConfig.openTime, closeTime: dayConfig.closeTime }]
  } else {
    return { valid: true }
  }

  // Calcula horário de término do agendamento
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000)
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes()
  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes()

  // Verifica se o agendamento cabe em algum turno
  for (const slot of slots) {
    const openMinutes = timeToMinutes(slot.openTime)
    const closeMinutes = timeToMinutes(slot.closeTime)
    
    // Se o início está dentro deste turno (>= abertura e < fechamento)
    // E o fim está dentro ou no máximo no fechamento (<= fechamento)
    // CRÍTICO: Não permite começar exatamente no fechamento (ex: 12:00 quando turno termina às 12:00)
    if (startMinutes >= openMinutes && startMinutes < closeMinutes && endMinutes <= closeMinutes) {
      return { valid: true }
    }
    
    // CRÍTICO: NÃO permite agendamentos que ultrapassam o fechamento do turno
    // Um agendamento deve estar COMPLETAMENTE dentro do turno
    // Exemplo: turno 9h-12h, agendamento de 30min começando às 11:45 → termina às 12:15 → INVÁLIDO
    // A regra de "50% dentro" foi removida porque causa problemas práticos
  }

  // Se não cabe em nenhum turno, retorna erro
  const lastSlot = slots[slots.length - 1]
  return {
    valid: false,
    reason: `O agendamento terminaria após nosso horário de fechamento (${formatTimeString24h(lastSlot.closeTime)}). Por favor, escolha um horário mais cedo.`,
  }
}

/**
 * Formata um horário para exibição em formato 24 horas (HH:mm)
 * Garante consistência em todo o sistema
 */
export function formatTime24h(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Formata um horário string (HH:mm) para exibição consistente
 */
export function formatTimeString24h(time: string): string {
  // Se já está no formato HH:mm, retorna como está
  if (/^\d{2}:\d{2}$/.test(time)) {
    return time
  }
  // Tenta parsear e formatar
  const [hours, minutes] = time.split(':').map(Number)
  if (!isNaN(hours) && !isNaN(minutes)) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }
  return time
}

/**
 * Formata horários de funcionamento para exibição
 */
export function formatWorkingHours(workingHours: WorkingHoursConfig | null | undefined): string {
  if (!workingHours) {
    return 'Horários não configurados'
  }

  const dayNames = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
  const dayKeys: (keyof WorkingHoursConfig)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  
  const lines: string[] = []
  
  dayKeys.forEach((key, index) => {
    const config = workingHours[key]
    if (config) {
      if (config.isOpen) {
        let slots: TimeSlot[] = []
        
        if (config.slots && config.slots.length > 0) {
          slots = config.slots
        } else if (config.openTime && config.closeTime) {
          slots = [{ openTime: config.openTime, closeTime: config.closeTime }]
        }
        
        if (slots.length > 0) {
          const slotsStr = slots.map(slot => 
            `${formatTimeString24h(slot.openTime)} às ${formatTimeString24h(slot.closeTime)}`
          ).join(', ')
          lines.push(`${dayNames[index]}: ${slotsStr}`)
        } else {
          lines.push(`${dayNames[index]}: Aberto (horários não especificados)`)
        }
      } else {
        lines.push(`${dayNames[index]}: Fechado`)
      }
    }
  })

  return lines.length > 0 ? lines.join('\n') : 'Horários não configurados'
}

