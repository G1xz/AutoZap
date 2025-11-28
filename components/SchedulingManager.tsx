'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { Check, X, Trash2, CheckCircle2 } from 'lucide-react'

interface Appointment {
  id: string
  contactNumber: string
  contactName: string | null
  date: string
  description: string | null
  status: string
  instanceName?: string
}

export default function SchedulingManager() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    try {
      const response = await fetch('/api/appointments')
      if (response.ok) {
        const data = await response.json()
        setAppointments(data)
      } else {
        toast.error('Erro ao buscar agendamentos')
      }
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error)
      toast.error('Erro ao buscar agendamentos')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      setActionInProgress(id)
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar agendamento')
      }

      fetchAppointments()
      toast.success('Agendamento atualizado com sucesso!')
    } catch (error) {
      console.error('Erro ao alterar status:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar status')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir agendamento',
      description: 'Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Manter',
      variant: 'destructive',
    })

    if (!confirmed) {
      return
    }

    try {
      setActionInProgress(id)
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao excluir agendamento')
      }

      fetchAppointments()
      toast.success('Agendamento excluído com sucesso!')
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir agendamento')
    } finally {
      setActionInProgress(null)
    }
  }

  // Função auxiliar para converter UTC para horário do Brasil (UTC-3)
  // Usada apenas para comparações, não para formatação
  const utcToBrazilian = (utcDate: Date): Date => {
    return new Date(utcDate.getTime() - (3 * 60 * 60000))
  }

  const formatDate = (dateString: string) => {
    const utcDate = new Date(dateString) // Data vem do banco em UTC
    // Usa apenas timeZone para conversão automática (não faz conversão manual)
    return utcDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo', // JavaScript converte automaticamente de UTC para horário do Brasil
    })
  }

  const formatTime = (dateString: string) => {
    const utcDate = new Date(dateString) // Data vem do banco em UTC
    // Usa apenas timeZone para conversão automática (não faz conversão manual)
    return utcDate.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo', // JavaScript converte automaticamente de UTC para horário do Brasil
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmado'
      case 'pending':
        return 'Pendente'
      case 'cancelled':
        return 'Cancelado'
      case 'completed':
        return 'Concluído'
      default:
        return status
    }
  }

  // Funções do calendário
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []
    
    // Preencher dias vazios do início
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Preencher dias do mês
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  const getAppointmentsForDate = (date: Date | null) => {
    if (!date) return []
    // Usa horário do Brasil para comparar datas
    const dateStr = date.toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Sao_Paulo',
    })
    return appointments.filter(apt => {
      const utcDate = new Date(apt.date)
      const brazilianDate = utcToBrazilian(utcDate)
      const aptDateStr = brazilianDate.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
      return aptDateStr === dateStr && apt.status !== 'cancelled'
    })
  }

  const getUpcomingAppointments = () => {
    const nowBrazilian = utcToBrazilian(new Date()) // Horário atual no Brasil
    return appointments
      .filter(apt => {
        const utcDate = new Date(apt.date)
        const aptDateBrazilian = utcToBrazilian(utcDate)
        return aptDateBrazilian >= nowBrazilian && apt.status !== 'cancelled'
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5)
  }

  const getSelectedDateAppointments = () => {
    // Usa horário do Brasil para comparar datas
    const dateStr = selectedDate.toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Sao_Paulo',
    })
    return appointments.filter(apt => {
      const utcDate = new Date(apt.date)
      const brazilianDate = utcToBrazilian(utcDate)
      const aptDateStr = brazilianDate.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
      return aptDateStr === dateStr
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  const days = getDaysInMonth(currentMonth)
  const upcomingAppointments = getUpcomingAppointments()
  const selectedDateAppointments = getSelectedDateAppointments()

  return (
    <>
      <ConfirmDialog />
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Agenda</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            {/* Navegação do mês */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                ←
              </button>
              <h3 className="text-lg font-semibold text-gray-900">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                →
              </button>
            </div>

            {/* Dias da semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Dias do mês */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const dayAppointments = getAppointmentsForDate(day)
                const isToday = day && day.toDateString() === new Date().toDateString()
                const isSelected = day && day.toDateString() === selectedDate.toDateString()

                return (
                  <button
                    key={index}
                    onClick={() => day && setSelectedDate(day)}
                    className={`
                      aspect-square p-2 rounded border transition-all
                      ${!day ? 'border-transparent' : 'border-gray-200 hover:border-autozap-primary'}
                      ${isToday ? 'bg-autozap-primary/10 border-autozap-primary' : ''}
                      ${isSelected ? 'bg-autozap-primary text-white border-autozap-primary' : 'bg-white text-gray-900'}
                      ${dayAppointments.length > 0 ? 'font-semibold' : ''}
                    `}
                    disabled={!day}
                  >
                    <div className="text-sm">{day ? day.getDate() : ''}</div>
                    {dayAppointments.length > 0 && (
                      <div className={`text-xs mt-1 ${isSelected ? 'text-white' : 'text-autozap-primary'}`}>
                        {dayAppointments.length}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Agendamentos do dia selecionado */}
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Agendamentos de {selectedDate.toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
              })}
            </h3>
            {selectedDateAppointments.length === 0 ? (
              <p className="text-center text-gray-500 py-8 bg-white border border-gray-200 rounded-lg">
                Nenhum agendamento para este dia.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDateAppointments.map((appointment) => {
                  const isProcessing = actionInProgress === appointment.id
                  return (
                  <div
                    key={appointment.id}
                    className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="text-lg font-semibold text-gray-900">
                            {formatTime(appointment.date)}
                          </div>
                          <h3 className="font-semibold text-lg text-gray-900">
                            {appointment.contactName || appointment.contactNumber}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{appointment.contactNumber}</p>
                        {appointment.instanceName && (
                          <p className="text-xs text-gray-500 mt-1">Conta: {appointment.instanceName}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(appointment.status)}`}>
                        {getStatusLabel(appointment.status)}
                      </span>
                    </div>

                    {appointment.description && (
                      <p className="text-sm text-gray-600 mb-3">{appointment.description}</p>
                    )}

                    <div className="flex gap-2 items-center">
                      {appointment.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(appointment.id, 'confirmed')}
                            disabled={isProcessing}
                            className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => handleStatusChange(appointment.id, 'cancelled')}
                            disabled={isProcessing}
                            className="flex-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Cancelar
                          </button>
                        </>
                      )}
                      {appointment.status === 'confirmed' && (
                        <button
                          onClick={() => handleStatusChange(appointment.id, 'completed')}
                          disabled={isProcessing}
                          className="flex-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Marcar como Concluído
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(appointment.id)}
                        disabled={isProcessing}
                        className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Excluir agendamento"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>

        {/* Próximos agendamentos */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 sticky top-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Próximos Agendamentos</h3>
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Nenhum agendamento próximo.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((appointment) => {
                  const utcDate = new Date(appointment.date)
                  const aptDateBrazilian = utcToBrazilian(utcDate)
                  const nowBrazilian = utcToBrazilian(new Date())
                  const isToday = aptDateBrazilian.toDateString() === nowBrazilian.toDateString()
                  const isProcessing = actionInProgress === appointment.id
                  
                  return (
                    <div
                      key={appointment.id}
                      className={`border rounded-lg p-3 transition-all ${
                        isToday 
                          ? 'border-autozap-primary bg-autozap-primary/5' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-gray-600 mb-1">
                            {isToday ? 'Hoje' : aptDateBrazilian.toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: 'short',
                              timeZone: 'America/Sao_Paulo',
                            })}
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {formatTime(appointment.date)}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(appointment.status)}`}>
                          {getStatusLabel(appointment.status)}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {appointment.contactName || appointment.contactNumber}
                      </div>
                      {appointment.description && (
                        <div className="text-xs text-gray-600 mt-1 line-clamp-1">
                          {appointment.description}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        {appointment.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(appointment.id, 'confirmed')}
                              disabled={isProcessing}
                              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-green-50 hover:border-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Confirmar agendamento"
                              aria-label="Confirmar agendamento"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(appointment.id, 'cancelled')}
                              disabled={isProcessing}
                              className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Cancelar agendamento"
                              aria-label="Cancelar agendamento"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {appointment.status === 'confirmed' && (
                          <button
                            onClick={() => handleStatusChange(appointment.id, 'completed')}
                            disabled={isProcessing}
                            className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Marcar como concluído"
                            aria-label="Marcar como concluído"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(appointment.id)}
                          disabled={isProcessing}
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Excluir agendamento"
                          aria-label="Excluir agendamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
