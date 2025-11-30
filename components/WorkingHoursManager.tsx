'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { WorkingHoursConfig, TimeSlot } from '@/lib/working-hours'
import { Plus, X } from 'lucide-react'

export default function WorkingHoursManager() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig>({})

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
      const response = await fetch('/api/working-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workingHoursConfig: workingHours }),
      })

      if (response.ok) {
        toast.success('Os horários de funcionamento foram salvos com sucesso.')
      } else {
        throw new Error('Erro ao salvar horários')
      }
    } catch (error) {
      console.error('Erro ao salvar horários:', error)
      toast.error('Não foi possível salvar os horários.')
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
