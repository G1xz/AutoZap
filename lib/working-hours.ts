/**
 * Utilitários para gerenciar horários de funcionamento
 */

export interface DayWorkingHours {
  day: number // 0 = domingo, 1 = segunda, ..., 6 = sábado
  isOpen: boolean
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
function timeToMinutes(time: string): number {
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

  if (!dayConfig.openTime || !dayConfig.closeTime) {
    // Se está aberto mas não tem horários definidos, permite
    return { valid: true }
  }

  const appointmentTime = date.getHours() * 60 + date.getMinutes()
  const openMinutes = timeToMinutes(dayConfig.openTime)
  const closeMinutes = timeToMinutes(dayConfig.closeTime)

  if (appointmentTime < openMinutes) {
    return {
      valid: false,
      reason: `Nosso horário de funcionamento começa às ${formatTimeString24h(dayConfig.openTime)}.`,
    }
  }

  if (appointmentTime >= closeMinutes) {
    return {
      valid: false,
      reason: `Nosso horário de funcionamento termina às ${formatTimeString24h(dayConfig.closeTime)}.`,
    }
  }

  return { valid: true }
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

  if (!dayConfig || !dayConfig.isOpen || !dayConfig.closeTime) {
    return { valid: true }
  }

  // Calcula horário de término do agendamento
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000)
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes()
  const closeMinutes = timeToMinutes(dayConfig.closeTime)

  // Se o agendamento termina depois do fechamento, não é válido
  if (endMinutes > closeMinutes) {
    return {
      valid: false,
      reason: `O agendamento terminaria após nosso horário de fechamento (${formatTimeString24h(dayConfig.closeTime)}). Por favor, escolha um horário mais cedo.`,
    }
  }

  return { valid: true }
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
      if (config.isOpen && config.openTime && config.closeTime) {
        // Garante formato 24h na exibição
        const openTime = formatTimeString24h(config.openTime)
        const closeTime = formatTimeString24h(config.closeTime)
        lines.push(`${dayNames[index]}: ${openTime} às ${closeTime}`)
      } else {
        lines.push(`${dayNames[index]}: Fechado`)
      }
    }
  })

  return lines.length > 0 ? lines.join('\n') : 'Horários não configurados'
}

