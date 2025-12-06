'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { Trash2, Database, AlertCircle } from 'lucide-react'

export default function MessageCleanupManager() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [retentionDays, setRetentionDays] = useState<string>('90')
  const [stats, setStats] = useState<{
    totalMessages: number
    messagesByAge: {
      last7Days: number
      last30Days: number
      last90Days: number
      older: number
    }
  } | null>(null)

  useEffect(() => {
    if (session?.user?.id) {
      fetchStats()
    }
  }, [session])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/messages/cleanup')
      if (response.ok) {
        const data = await response.json()
        setRetentionDays(data.retentionDays?.toString() || '90')
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRetention = async () => {
    if (!session?.user?.id) return

    const days = parseInt(retentionDays)
    if (isNaN(days) || days < 1 || days > 3650) {
      toast.error('Dias de retenção deve ser um número entre 1 e 3650 (10 anos)')
      return
    }

    try {
      const response = await fetch('/api/messages/cleanup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retentionDays: days }),
      })

      if (response.ok) {
        toast.success('Configuração de retenção salva com sucesso!')
        await fetchStats()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar configuração')
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
      toast.error('Não foi possível salvar a configuração de retenção.')
    }
  }

  const handleCleanup = async () => {
    if (!session?.user?.id) return

    const days = parseInt(retentionDays)
    if (isNaN(days) || days < 1) {
      toast.error('Configure os dias de retenção antes de limpar')
      return
    }

    if (!confirm(`Tem certeza que deseja deletar mensagens com mais de ${days} dias?\n\nEsta ação não pode ser desfeita!`)) {
      return
    }

    setCleaning(true)
    try {
      const response = await fetch('/api/messages/cleanup', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`${data.deletedCount} mensagens deletadas com sucesso!`)
        await fetchStats()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao limpar mensagens')
      }
    } catch (error) {
      console.error('Erro ao limpar mensagens:', error)
      toast.error('Não foi possível limpar as mensagens.')
    } finally {
      setCleaning(false)
    }
  }

  if (loading) {
    return <div className="text-center py-4">Carregando estatísticas...</div>
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Database size={20} className="text-gray-700" />
        <h3 className="text-lg font-semibold text-gray-900">Limpeza de Mensagens</h3>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={20} className="text-yellow-600 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-semibold mb-1">⚠️ Economia de Espaço</p>
            <p>
              Mensagens antigas ocupam espaço no banco de dados. Configure quantos dias deseja manter 
              as mensagens. Mensagens mais antigas serão automaticamente deletadas.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Estatísticas */}
        {stats && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Estatísticas de Mensagens
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-xs text-gray-600 mb-1">Total</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatNumber(stats.totalMessages)}
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-xs text-gray-600 mb-1">Últimos 7 dias</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(stats.messagesByAge.last7Days)}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-xs text-gray-600 mb-1">Últimos 30 dias</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(stats.messagesByAge.last30Days)}
                </div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-xs text-gray-600 mb-1">Últimos 90 dias</div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatNumber(stats.messagesByAge.last90Days)}
                </div>
              </div>
            </div>
            {stats.messagesByAge.older > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-red-600 mb-1">Mensagens antigas (mais de 90 dias)</div>
                    <div className="text-xl font-bold text-red-600">
                      {formatNumber(stats.messagesByAge.older)}
                    </div>
                  </div>
                  <div className="text-xs text-red-600">
                    Serão deletadas se a retenção for menor que 90 dias
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Configuração de Retenção */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Dias de Retenção *
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              min="1"
              max="3650"
              placeholder="90"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
            <button
              onClick={handleSaveRetention}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Salvar
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Mensagens mais antigas que este número de dias serão deletadas. Recomendado: 30-90 dias.
          </p>
        </div>

        {/* Botão de Limpeza Manual */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Trash2 size={18} />
            {cleaning ? 'Limpando...' : 'Limpar Mensagens Antigas Agora'}
          </button>
        </div>
      </div>
    </div>
  )
}

