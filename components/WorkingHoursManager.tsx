'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { WorkingHoursConfig } from '@/lib/working-hours'

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
        toast({
          title: 'Horários salvos',
          description: 'Os horários de funcionamento foram salvos com sucesso.',
        })
      } else {
        throw new Error('Erro ao salvar horários')
      }
    } catch (error) {
      console.error('Erro ao salvar horários:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar os horários.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const updateDayConfig = (
    key: keyof WorkingHoursConfig,
    updates: Partial<{ isOpen: boolean; openTime?: string; closeTime?: string }>
  ) => {
    setWorkingHours((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...updates,
      },
    }))
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
          Configure os horários de funcionamento do seu negócio. Estes horários serão aplicados a todos os fluxos e impedirão agendamentos fora do horário configurado.
        </p>
      </div>

      <div className="space-y-3 mb-6">
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

          return (
            <div
              key={key}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200"
            >
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="checkbox"
                  checked={dayConfig.isOpen || false}
                  onChange={(e) => {
                    updateDayConfig(key, {
                      isOpen: e.target.checked,
                      openTime: e.target.checked ? dayConfig.openTime || '09:00' : undefined,
                      closeTime: e.target.checked ? dayConfig.closeTime || '18:00' : undefined,
                    })
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                />
                <span className="text-sm font-medium text-gray-700 w-32">{label}</span>
              </div>

              {dayConfig.isOpen && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={dayConfig.openTime || '09:00'}
                    onChange={(e) => {
                      updateDayConfig(key, { openTime: e.target.value })
                    }}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600">às</span>
                  <input
                    type="time"
                    value={dayConfig.closeTime || '18:00'}
                    onChange={(e) => {
                      updateDayConfig(key, { closeTime: e.target.value })
                    }}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
                  />
                </div>
              )}

              {!dayConfig.isOpen && (
                <span className="text-sm text-gray-500">Fechado</span>
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
          ⚠️ Os horários configurados aqui serão aplicados a todos os fluxos de automação. Agendamentos só poderão ser feitos dentro dos horários configurados acima.
        </p>
      </div>
    </div>
  )
}

