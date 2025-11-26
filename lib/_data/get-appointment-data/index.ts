import { prisma } from '../../prisma'
import { checkAvailability, getAvailableTimes, getUserAppointments } from '../../appointments'

export interface AppointmentData {
  totalAppointments: number
  confirmedAppointments: number
  pendingAppointments: number
  cancelledAppointments: number
  completedAppointments: number
  futureAppointments: Array<{
    id: string
    date: Date
    formattedDate: string
    formattedTime: string
    status: string
    description: string | null
  }>
  pastAppointments: Array<{
    id: string
    date: Date
    formattedDate: string
    formattedTime: string
    status: string
    description: string | null
  }>
  nextAppointment: {
    id: string
    date: Date
    formattedDate: string
    formattedTime: string
    status: string
    description: string | null
  } | null
  appointmentsByWeekday: Record<string, number>
}

/**
 * Busca dados completos de agendamentos do usuário
 * Similar ao getUserFinancialData do Midas
 */
export async function getAppointmentData(
  userId: string,
  instanceId: string,
  contactNumber: string
): Promise<AppointmentData> {
  const userAppointmentsResult = await getUserAppointments(userId, instanceId, contactNumber)
  
  if (!userAppointmentsResult.success || !userAppointmentsResult.appointments) {
    return {
      totalAppointments: 0,
      confirmedAppointments: 0,
      pendingAppointments: 0,
      cancelledAppointments: 0,
      completedAppointments: 0,
      futureAppointments: [],
      pastAppointments: [],
      nextAppointment: null,
      appointmentsByWeekday: {},
    }
  }

  const appointments = userAppointmentsResult.appointments
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  // Separa por status
  const confirmedAppointments = appointments.filter(apt => apt.status === 'confirmed')
  const pendingAppointments = appointments.filter(apt => apt.status === 'pending')
  const cancelledAppointments = appointments.filter(apt => apt.status === 'cancelled')
  const completedAppointments = appointments.filter(apt => apt.status === 'completed')
  
  // Agendamentos futuros e passados
  const futureAppointments = appointments
    .filter(apt => {
      const aptDate = new Date(apt.date)
      return aptDate >= today && (apt.status === 'confirmed' || apt.status === 'pending')
    })
    .map(apt => ({
      id: apt.id,
      date: new Date(apt.date),
      formattedDate: apt.formattedDate,
      formattedTime: apt.formattedTime,
      status: apt.status,
      description: apt.description || null,
    }))
  
  const pastAppointments = appointments
    .filter(apt => {
      const aptDate = new Date(apt.date)
      return aptDate < today
    })
    .map(apt => ({
      id: apt.id,
      date: new Date(apt.date),
      formattedDate: apt.formattedDate,
      formattedTime: apt.formattedTime,
      status: apt.status,
      description: apt.description || null,
    }))
  
  // Próximo agendamento
  const nextAppointment = futureAppointments.length > 0
    ? futureAppointments.sort((a, b) => a.date.getTime() - b.date.getTime())[0]
    : null
  
  // Distribuição por dia da semana
  const appointmentsByWeekday: Record<string, number> = {
    'Domingo': 0,
    'Segunda': 0,
    'Terça': 0,
    'Quarta': 0,
    'Quinta': 0,
    'Sexta': 0,
    'Sábado': 0,
  }
  
  appointments.forEach(apt => {
    const date = new Date(apt.date)
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' })
    appointmentsByWeekday[weekday] = (appointmentsByWeekday[weekday] || 0) + 1
  })
  
  return {
    totalAppointments: appointments.length,
    confirmedAppointments: confirmedAppointments.length,
    pendingAppointments: pendingAppointments.length,
    cancelledAppointments: cancelledAppointments.length,
    completedAppointments: completedAppointments.length,
    futureAppointments,
    pastAppointments,
    nextAppointment,
    appointmentsByWeekday,
  }
}

