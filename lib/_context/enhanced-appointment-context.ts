import { prisma } from '../prisma'
import { checkAvailability, getAvailableTimes, getUserAppointments } from '../appointments'

/**
 * Gera contexto aprimorado sobre agendamentos para a IA
 * Similar ao generateEnhancedFinancialContext do Midas
 */
export async function generateEnhancedAppointmentContext(
  userId: string,
  instanceId: string,
  contactNumber: string
): Promise<string> {
  try {
    // Busca agendamentos do usuário
    const userAppointmentsResult = await getUserAppointments(userId, instanceId, contactNumber)
    
    if (!userAppointmentsResult.success || !userAppointmentsResult.appointments) {
      return "Nenhum agendamento encontrado para análise."
    }

    const appointments = userAppointmentsResult.appointments
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    // Separa agendamentos por status
    const confirmedAppointments = appointments.filter(apt => apt.status === 'confirmed')
    const pendingAppointments = appointments.filter(apt => apt.status === 'pending')
    const cancelledAppointments = appointments.filter(apt => apt.status === 'cancelled')
    const completedAppointments = appointments.filter(apt => apt.status === 'completed')
    
    // Agendamentos futuros (confirmados e pendentes)
    const futureAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.date)
      return aptDate >= today && (apt.status === 'confirmed' || apt.status === 'pending')
    })
    
    // Agendamentos passados
    const pastAppointments = appointments.filter(apt => {
      const aptDate = new Date(apt.date)
      return aptDate < today
    })
    
    // Próximo agendamento
    const nextAppointment = futureAppointments.length > 0
      ? futureAppointments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
      : null
    
    // Agendamentos por dia da semana
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
    
    // Formata contexto
    const context = `
📅 RELATÓRIO COMPLETO DE AGENDAMENTOS - AUTOZAP AI
⚠️ IMPORTANTE: Este relatório inclui TODOS os agendamentos do cliente, não apenas os futuros.

📊 RESUMO EXECUTIVO:
- Total de Agendamentos: ${appointments.length}
- Confirmados: ${confirmedAppointments.length}
- Pendentes de Confirmação: ${pendingAppointments.length}
- Cancelados: ${cancelledAppointments.length}
- Concluídos: ${completedAppointments.length}
- Agendamentos Futuros: ${futureAppointments.length}
- Agendamentos Passados: ${pastAppointments.length}

${nextAppointment ? `
🎯 PRÓXIMO AGENDAMENTO:
- Data: ${nextAppointment.formattedDate}
- Horário: ${nextAppointment.formattedTime}
- Status: ${nextAppointment.status === 'confirmed' ? 'Confirmado' : 'Pendente de Confirmação'}
- Descrição: ${nextAppointment.description || 'N/A'}
` : `
⚠️ Nenhum agendamento futuro encontrado.
`}

📅 AGENDAMENTOS FUTUROS (${futureAppointments.length}):
${futureAppointments.length > 0
  ? futureAppointments
      .slice(0, 10)
      .map((apt, i) => 
        `${i + 1}. ${apt.formattedDate} às ${apt.formattedTime} - ${apt.status === 'confirmed' ? '✅ Confirmado' : '⏳ Pendente'} - ${apt.description || 'Sem descrição'}`
      )
      .join('\n')
  : 'Nenhum agendamento futuro.'}

📋 AGENDAMENTOS PASSADOS (${pastAppointments.length}):
${pastAppointments.length > 0
  ? pastAppointments
      .slice(0, 10)
      .map((apt, i) => 
        `${i + 1}. ${apt.formattedDate} às ${apt.formattedTime} - ${apt.status === 'completed' ? '✅ Concluído' : apt.status === 'cancelled' ? '❌ Cancelado' : '⏳ Pendente'} - ${apt.description || 'Sem descrição'}`
      )
      .join('\n')
  : 'Nenhum agendamento passado.'}

📊 DISTRIBUIÇÃO POR DIA DA SEMANA:
${Object.entries(appointmentsByWeekday)
  .map(([day, count]) => `- ${day}: ${count} agendamento(s)`)
  .join('\n')}

⚠️ AGENDAMENTOS PENDENTES DE CONFIRMAÇÃO (${pendingAppointments.length}):
${pendingAppointments.length > 0
  ? pendingAppointments
      .slice(0, 5)
      .map((apt, i) => 
        `${i + 1}. ${apt.formattedDate} às ${apt.formattedTime} - ${apt.description || 'Sem descrição'}`
      )
      .join('\n')
  : 'Nenhum agendamento pendente.'}

📝 IMPORTANTE: Este relatório fornece acesso completo ao histórico de agendamentos do cliente.
A IA pode responder perguntas sobre qualquer período histórico, não apenas agendamentos futuros.
Cada agendamento inclui: data, horário, status, descrição e duração.
`;

    return context
  } catch (error) {
    console.error("Error generating enhanced appointment context:", error)
    return "Erro ao gerar contexto de agendamentos aprimorado."
  }
}

