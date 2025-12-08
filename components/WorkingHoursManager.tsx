'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { WorkingHoursConfig, TimeSlot } from '@/lib/working-hours'
import { Plus, X, Copy } from 'lucide-react'

export default function WorkingHoursManager() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig>({})
  const [copyFromDay, setCopyFromDay] = useState<keyof WorkingHoursConfig | null>(null)
  const [selectedDaysToCopy, setSelectedDaysToCopy] = useState<Set<keyof WorkingHoursConfig>>(new Set())

  useEffect(() => {
    if (session?.user?.id) {
      fetchWorkingHours()
    }
  }, [session])

  const fetchWorkingHours = async () => {
    try {
      const response = await fetch('/api/working-hours')
      if (response.ok) {
        const data = await response.json()
        if (data.workingHoursConfig) {
          setWorkingHours(data.workingHoursConfig)
        }
      }
    } catch (error) {
      console.error('Erro ao buscar horários:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!session?.user?.id) return

    setSaving(true)
    try {
      // Limpa o objeto removendo campos undefined e valores inválidos
      const cleanWorkingHours = Object.entries(workingHours).reduce((acc, [key, value]) => {
        if (value && typeof value === 'object') {
          const cleanDay: any = {}
          if (value.isOpen !== undefined) cleanDay.isOpen = value.isOpen
          if (value.slots && Array.isArray(value.slots) && value.slots.length > 0) {
            cleanDay.slots = value.slots.filter((slot: any) =>
              slot &&
              slot.openTime &&
              slot.closeTime &&
              typeof slot.openTime === 'string' &&
              typeof slot.closeTime === 'string'
            )
          }
          // Remove campos antigos (openTime/closeTime) se slots existir
          if (cleanDay.slots && cleanDay.slots.length > 0) {
            // Não inclui openTime e closeTime quando tem slots
          } else if (value.openTime && value.closeTime) {
            // Mantém formato antigo se não tem slots
            cleanDay.openTime = value.openTime
            cleanDay.closeTime = value.closeTime
          }
          
          if (Object.keys(cleanDay).length > 0) {
            (acc as any)[key] = cleanDay
          }
        }
        return acc
      }, {} as WorkingHoursConfig)

      const response = await fetch('/api/working-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workingHoursConfig: cleanWorkingHours }),
      })

      if (response.ok) {
        toast.success('Os horários de funcionamento foram salvos com sucesso.')
      } else {
        // Tenta obter a mensagem de erro do servidor
        let errorMessage = 'Erro ao salvar horários'
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch (e) {
          // Se não conseguir parsear o JSON, usa a mensagem padrão
          errorMessage = `Erro ${response.status}: ${response.statusText}`
        }
        console.error('Erro ao salvar horários:', {
          status: response.status,
          statusText: response.statusText,
          message: errorMessage,
          workingHours,
        })
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Erro ao salvar horários:', error)
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível salvar os horários.'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const getDaySlots = (key: keyof WorkingHoursConfig): TimeSlot[] => {
    const dayConfig = workingHours[key]
    if (!dayConfig) return []
    
    if (dayConfig.slots && dayConfig.slots.length > 0) {
      return dayConfig.slots
    } else if (dayConfig.openTime && dayConfig.closeTime) {
      // Migra formato antigo para novo formato
      return [{ openTime: dayConfig.openTime, closeTime: dayConfig.closeTime }]
    }
    return []
  }

  const updateDayConfig = (
    key: keyof WorkingHoursConfig,
    updates: Partial<{ isOpen: boolean; slots?: TimeSlot[] }>
  ) => {
    setWorkingHours((prev) => {
      const current = prev[key] || { isOpen: false }
      return {
        ...prev,
        [key]: {
          ...current,
          ...updates,
          // Remove campos antigos quando usa slots
          ...(updates.slots ? { openTime: undefined, closeTime: undefined } : {}),
        },
      }
    })
  }

  const addSlot = (key: keyof WorkingHoursConfig) => {
    const currentSlots = getDaySlots(key)
    const newSlot: TimeSlot = {
      openTime: '09:00',
      closeTime: '18:00',
    }
    updateDayConfig(key, {
      isOpen: true,
      slots: [...currentSlots, newSlot],
    })
  }

  const removeSlot = (key: keyof WorkingHoursConfig, index: number) => {
    const currentSlots = getDaySlots(key)
    const newSlots = currentSlots.filter((_, i) => i !== index)
    
    if (newSlots.length === 0) {
      updateDayConfig(key, { isOpen: false, slots: [] })
    } else {
      updateDayConfig(key, { slots: newSlots })
    }
  }

  const updateSlot = (
    key: keyof WorkingHoursConfig,
    index: number,
    field: 'openTime' | 'closeTime',
    value: string
  ) => {
    const currentSlots = getDaySlots(key)
    const newSlots = [...currentSlots]
    newSlots[index] = { ...newSlots[index], [field]: value }
    updateDayConfig(key, { slots: newSlots })
  }

  const copyHoursToDays = (fromDay: keyof WorkingHoursConfig, toDays: (keyof WorkingHoursConfig)[]) => {
    const sourceConfig = workingHours[fromDay]
    if (!sourceConfig) return

    const sourceSlots = getDaySlots(fromDay)
    const isSourceOpen = sourceConfig.isOpen || false

    setWorkingHours((prev) => {
      const updated = { ...prev }
      
      toDays.forEach((dayKey) => {
        if (dayKey === fromDay) return // Não copia para o mesmo dia
        
        if (isSourceOpen && sourceSlots.length > 0) {
          // Copia os slots e marca como aberto
          updated[dayKey] = {
            isOpen: true,
            slots: sourceSlots.map(slot => ({ ...slot })), // Deep copy dos slots
          } as any
        } else {
          // Se o dia fonte está fechado, fecha o dia destino também
          updated[dayKey] = {
            isOpen: false,
            slots: [],
          } as any
        }
      })
      
      return updated
    })

    setCopyFromDay(null)
    toast.success(`Horários copiados para ${toDays.length} dia(s) com sucesso!`)
  }

  const handleCopyClick = (dayKey: keyof WorkingHoursConfig) => {
    const slots = getDaySlots(dayKey)
    if (slots.length === 0) {
      toast.error('Este dia não tem horários configurados para copiar.')
      return
    }
    setCopyFromDay(dayKey)
    setSelectedDaysToCopy(new Set()) // Limpa seleção anterior
  }

  const handleCopyConfirm = () => {
    if (!copyFromDay || selectedDaysToCopy.size === 0) {
      toast.error('Selecione pelo menos um dia para copiar.')
      return
    }
    copyHoursToDays(copyFromDay, Array.from(selectedDaysToCopy))
    setSelectedDaysToCopy(new Set())
  }

  const toggleDaySelection = (dayKey: keyof WorkingHoursConfig) => {
    setSelectedDaysToCopy((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(dayKey)) {
        newSet.delete(dayKey)
      } else {
        newSet.add(dayKey)
      }
      return newSet
    })
  }

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Horários de Funcionamento
        </h3>
        <p className="text-sm text-gray-600">
          Configure os horários de funcionamento do seu negócio. Você pode adicionar múltiplos turnos por dia (ex: 7h-11h e 13h-21h). Estes horários serão aplicados a todos os fluxos e impedirão agendamentos fora do horário configurado.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {[
          { key: 'monday' as const, label: 'Segunda-feira' },
          { key: 'tuesday' as const, label: 'Terça-feira' },
          { key: 'wednesday' as const, label: 'Quarta-feira' },
          { key: 'thursday' as const, label: 'Quinta-feira' },
          { key: 'friday' as const, label: 'Sexta-feira' },
          { key: 'saturday' as const, label: 'Sábado' },
          { key: 'sunday' as const, label: 'Domingo' },
        ].map(({ key, label }) => {
          const dayConfig = workingHours[key] || { isOpen: false }
          const isOpen = dayConfig.isOpen || false
          const slots = getDaySlots(key)

          return (
            <div
              key={key}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // Ao ativar, adiciona um turno padrão se não houver nenhum
                      if (slots.length === 0) {
                        updateDayConfig(key, {
                          isOpen: true,
                          slots: [{ openTime: '09:00', closeTime: '18:00' }],
                        })
                      } else {
                        updateDayConfig(key, { isOpen: true })
                      }
                    } else {
                      updateDayConfig(key, { isOpen: false, slots: [] })
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                />
                <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>
                <div className="flex items-center gap-2">
                  {isOpen && slots.length > 0 && (
                    <button
                      onClick={() => handleCopyClick(key)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                      title="Copiar horários deste dia para outros dias"
                    >
                      <Copy size={14} />
                      Copiar
                    </button>
                  )}
                  {isOpen && (
                    <button
                      onClick={() => addSlot(key)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-autozap-primary text-white rounded hover:bg-autozap-light transition-colors"
                    >
                      <Plus size={14} />
                      Adicionar Turno
                    </button>
                  )}
                </div>
              </div>

              {isOpen && slots.length > 0 && (
                <div className="space-y-2 ml-7">
                  {slots.map((slot, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-white rounded border border-gray-300"
                    >
                      <input
                        type="time"
                        value={slot.openTime}
                        onChange={(e) => updateSlot(key, index, 'openTime', e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
                      />
                      <span className="text-sm text-gray-600">às</span>
                      <input
                        type="time"
                        value={slot.closeTime}
                        onChange={(e) => updateSlot(key, index, 'closeTime', e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
                      />
                      {slots.length > 1 && (
                        <button
                          onClick={() => removeSlot(key, index)}
                          className="ml-auto p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remover turno"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isOpen && (
                <div className="ml-7">
                  <span className="text-sm text-gray-500">Fechado</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal de copiar horários */}
      {copyFromDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Copiar Horários
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Selecione para quais dias deseja copiar os horários de{' '}
              <strong>
                {[
                  { key: 'monday', label: 'Segunda-feira' },
                  { key: 'tuesday', label: 'Terça-feira' },
                  { key: 'wednesday', label: 'Quarta-feira' },
                  { key: 'thursday', label: 'Quinta-feira' },
                  { key: 'friday', label: 'Sexta-feira' },
                  { key: 'saturday', label: 'Sábado' },
                  { key: 'sunday', label: 'Domingo' },
                ].find(d => d.key === copyFromDay)?.label}
              </strong>
              :
            </p>
            
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {[
                { key: 'monday' as const, label: 'Segunda-feira' },
                { key: 'tuesday' as const, label: 'Terça-feira' },
                { key: 'wednesday' as const, label: 'Quarta-feira' },
                { key: 'thursday' as const, label: 'Quinta-feira' },
                { key: 'friday' as const, label: 'Sexta-feira' },
                { key: 'saturday' as const, label: 'Sábado' },
                { key: 'sunday' as const, label: 'Domingo' },
              ]
                .filter(({ key }) => key !== copyFromDay) // Remove o dia fonte da lista
                .map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDaysToCopy.has(key)}
                      onChange={() => toggleDaySelection(key)}
                      className="w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setCopyFromDay(null)
                  setSelectedDaysToCopy(new Set())
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCopyConfirm}
                className="px-4 py-2 text-sm bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors"
              >
                Copiar para {selectedDaysToCopy.size} dia(s)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Horários'}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          ⚠️ Os horários configurados aqui serão aplicados a todos os fluxos de automação. Agendamentos só poderão ser feitos dentro dos turnos configurados acima.
        </p>
      </div>
    </div>
  )
}
