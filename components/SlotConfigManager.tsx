'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'

const SLOT_OPTIONS = [5, 10, 15, 20, 25, 30]

export default function SlotConfigManager() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [slotSize, setSlotSize] = useState(15)
  const [bufferMinutes, setBufferMinutes] = useState(0)

  useEffect(() => {
    if (session?.user?.id) {
      fetchSlotConfig()
    }
  }, [session])

  const fetchSlotConfig = async () => {
    try {
      const response = await fetch('/api/slot-config')
      if (response.ok) {
        const data = await response.json()
        if (data.slotConfig) {
          setSlotSize(data.slotConfig.slotSizeMinutes || 15)
          setBufferMinutes(data.slotConfig.bufferMinutes || 0)
        }
      }
    } catch (error) {
      console.error('Erro ao buscar configuração de slots:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!session?.user?.id) return

    setSaving(true)
    try {
      const response = await fetch('/api/slot-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotConfig: {
            slotSizeMinutes: slotSize,
            bufferMinutes: bufferMinutes,
          },
        }),
      })

      if (response.ok) {
        toast.success('Configuração de slots salva com sucesso!')
        // Força reload da página para atualizar o banner de compatibilidade
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Erro ao salvar configuração')
      }
    } catch (error) {
      console.error('Erro ao salvar configuração de slots:', error)
      toast.error('Não foi possível salvar a configuração.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Configuração de Slots de Agendamento
        </h3>
        <p className="text-sm text-gray-600">
          Configure o tamanho dos blocos de tempo para agendamentos. Os serviços só poderão ter durações que sejam múltiplos deste valor.
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tamanho do Slot (minutos)
          </label>
          <select
            value={slotSize}
            onChange={(e) => setSlotSize(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-autozap-primary focus:outline-none"
          >
            {SLOT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} minutos
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Exemplo: Com slot de {slotSize} minutos, os horários disponíveis serão sempre múltiplos de {slotSize} (ex: 07:00, 07:{slotSize.toString().padStart(2, '0')}, 07:{(slotSize * 2).toString().padStart(2, '0')}, etc.)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Buffer entre Agendamentos (minutos)
          </label>
          <input
            type="number"
            min="0"
            max="30"
            step="5"
            value={bufferMinutes}
            onChange={(e) => setBufferMinutes(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-autozap-primary focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tempo de intervalo entre agendamentos (ex: 5 minutos para limpeza/preparação)
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          ⚠️ <strong>Importante:</strong> Ao alterar o tamanho do slot, certifique-se de que todos os serviços tenham durações que sejam múltiplos deste valor. 
          Exemplo: com slot de {slotSize} minutos, as durações válidas são {slotSize}, {slotSize * 2}, {slotSize * 3}, {slotSize * 4}, etc.
        </p>
      </div>
    </div>
  )
}

