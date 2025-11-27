export function getBrazilDate(baseDate: Date = new Date()): Date {
  const utc = baseDate.getTime() + baseDate.getTimezoneOffset() * 60000
  const brazilOffsetMinutes = -3 * 60 // UTC-3
  const brazilTime = new Date(utc + brazilOffsetMinutes * 60000)

  // Normaliza para 12h (evita problemas de virada de dia)
  return new Date(
    brazilTime.getFullYear(),
    brazilTime.getMonth(),
    brazilTime.getDate(),
    12,
    0,
    0,
    0
  )
}

function normalize(date: Date): Date {
  date.setHours(12, 0, 0, 0)
  return date
}

function cloneAndAddDays(base: Date, days: number): Date {
  const result = new Date(base)
  result.setDate(result.getDate() + days)
  return normalize(result)
}

function getUpcomingWeekday(base: Date, targetDay: number): Date {
  const result = new Date(base)
  result.setHours(12, 0, 0, 0)

  let days = (targetDay - result.getDay() + 7) % 7
  if (days === 0) {
    days = 7 // nunca retorna hoje; pega a próxima ocorrência
  }

  result.setDate(result.getDate() + days)
  return result
}

const weekdayMap: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  'segunda feira': 1,
  terca: 2,
  terça: 2,
  'terca-feira': 2,
  'terca feira': 2,
  'terça-feira': 2,
  'terça feira': 2,
  quarta: 3,
  'quarta-feira': 3,
  'quarta feira': 3,
  quinta: 4,
  'quinta-feira': 4,
  'quinta feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  'sexta feira': 5,
  sabado: 6,
  sábado: 6,
}

function includesAny(message: string, terms: string[]): boolean {
  return terms.some((term) => message.includes(term))
}

export function parseRelativeDate(message: string): Date | null {
  const lowerMessage = message.toLowerCase()
  const today = getBrazilDate()

  if (!lowerMessage) {
    return null
  }

  // Palavras-chave simples
  if (includesAny(lowerMessage, ['hoje'])) {
    return today
  }

  if (includesAny(lowerMessage, ['amanhã', 'amanha'])) {
    return cloneAndAddDays(today, 1)
  }

  if (includesAny(lowerMessage, ['depois de amanhã', 'depois de amanha'])) {
    return cloneAndAddDays(today, 2)
  }

  if (includesAny(lowerMessage, ['ontem'])) {
    return cloneAndAddDays(today, -1)
  }

  if (includesAny(lowerMessage, ['semana que vem', 'próxima semana', 'proxima semana'])) {
    return cloneAndAddDays(today, 7)
  }

  if (includesAny(lowerMessage, ['semana passada', 'sem passada'])) {
    return cloneAndAddDays(today, -7)
  }

  if (includesAny(lowerMessage, ['mês que vem', 'mes que vem', 'próximo mês', 'proximo mes'])) {
    const nextMonth = new Date(today)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    return normalize(nextMonth)
  }

  if (includesAny(lowerMessage, ['mês passado', 'mes passado'])) {
    const lastMonth = new Date(today)
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    return normalize(lastMonth)
  }

  // Dias da semana (segunda, terça, etc)
  for (const [name, dayIndex] of Object.entries(weekdayMap)) {
    if (lowerMessage.includes(name)) {
      return getUpcomingWeekday(today, dayIndex)
    }
  }

  return null
}

