'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface ReportData {
  totalMessages: number
  totalConversations: number
  activeConversations: number
  waitingHumanConversations: number
  closedConversations: number
  totalAppointments: number
  pendingAppointments: number
  confirmedAppointments: number
  completedAppointments: number
  messagesByDay: Array<{ date: string; count: number }>
}

interface AIMetricsData {
  totalRequests: number
  totalTokens: number
  totalCost: number
  averageTokens: number
  averageCost: number
  cachedRequests: number
  averageDuration: number
  byModel: Record<string, { requests: number; tokens: number; cost: number }>
}

export default function ReportsManager() {
  const { data: session } = useSession()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [aiMetrics, setAiMetrics] = useState<AIMetricsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
    fetchAIMetrics()
  }, [])

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports')
      if (response.ok) {
        const data = await response.json()
        setReportData(data)
      }
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAIMetrics = async () => {
    try {
      const response = await fetch('/api/ai-metrics')
      if (response.ok) {
        const data = await response.json()
        setAiMetrics(data)
      }
    } catch (error) {
      console.error('Erro ao buscar métricas de IA:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  if (!reportData) {
    return <div className="text-center py-8 text-gray-500">Erro ao carregar relatórios.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Relatórios</h2>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Total de Mensagens</div>
          <div className="text-2xl font-bold text-gray-900">{reportData.totalMessages}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Conversas Ativas</div>
          <div className="text-2xl font-bold text-green-600">{reportData.activeConversations}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Aguardando Atendente</div>
          <div className="text-2xl font-bold text-yellow-600">{reportData.waitingHumanConversations}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Agendamentos</div>
          <div className="text-2xl font-bold text-blue-600">{reportData.totalAppointments}</div>
        </div>
      </div>

      {/* Estatísticas de conversas */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas de Conversas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-gray-900">{reportData.totalConversations}</div>
            <div className="text-sm text-gray-600 mt-1">Total de Conversas</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{reportData.activeConversations}</div>
            <div className="text-sm text-gray-600 mt-1">Em Atendimento</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-3xl font-bold text-gray-600">{reportData.closedConversations}</div>
            <div className="text-sm text-gray-600 mt-1">Encerradas</div>
          </div>
        </div>
      </div>

      {/* Estatísticas de agendamentos */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas de Agendamentos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600">{reportData.pendingAppointments}</div>
            <div className="text-sm text-gray-600 mt-1">Pendentes</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">{reportData.confirmedAppointments}</div>
            <div className="text-sm text-gray-600 mt-1">Confirmados</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">{reportData.completedAppointments}</div>
            <div className="text-sm text-gray-600 mt-1">Concluídos</div>
          </div>
        </div>
      </div>

      {/* Métricas de IA */}
      {aiMetrics && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🤖 Métricas de Inteligência Artificial</h3>
          
          {/* Cards principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-purple-700 mb-1">Total de Requisições</div>
              <div className="text-2xl font-bold text-purple-900">{aiMetrics.totalRequests}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-700 mb-1">Total de Tokens</div>
              <div className="text-2xl font-bold text-blue-900">{aiMetrics.totalTokens.toLocaleString('pt-BR')}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-700 mb-1">Custo Total</div>
              <div className="text-2xl font-bold text-green-900">${aiMetrics.totalCost.toFixed(4)}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-sm text-orange-700 mb-1">Respostas em Cache</div>
              <div className="text-2xl font-bold text-orange-900">{aiMetrics.cachedRequests}</div>
            </div>
          </div>

          {/* Estatísticas detalhadas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{Math.round(aiMetrics.averageTokens).toLocaleString('pt-BR')}</div>
              <div className="text-sm text-gray-600 mt-1">Tokens Médios por Requisição</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">${aiMetrics.averageCost.toFixed(6)}</div>
              <div className="text-sm text-gray-600 mt-1">Custo Médio por Requisição</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{Math.round(aiMetrics.averageDuration)}ms</div>
              <div className="text-sm text-gray-600 mt-1">Tempo Médio de Resposta</div>
            </div>
          </div>

          {/* Estatísticas por modelo */}
          {Object.keys(aiMetrics.byModel).length > 0 && (
            <div className="mt-6">
              <h4 className="text-md font-semibold text-gray-800 mb-3">Estatísticas por Modelo</h4>
              <div className="space-y-3">
                {Object.entries(aiMetrics.byModel).map(([model, stats]) => (
                  <div key={model} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-gray-900">{model}</span>
                      <span className="text-sm text-gray-600">{stats.requests} requisições</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Tokens: </span>
                        <span className="font-semibold text-gray-900">{stats.tokens.toLocaleString('pt-BR')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Custo: </span>
                        <span className="font-semibold text-gray-900">${stats.cost.toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gráfico de mensagens por dia */}
      {reportData.messagesByDay.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Mensagens por Dia (últimos 7 dias)</h3>
          <div className="space-y-2">
            {reportData.messagesByDay.map((item, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-24 text-sm text-gray-600">
                  {new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                  <div
                    className="bg-autozap-primary h-6 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${Math.min((item.count / Math.max(...reportData.messagesByDay.map(d => d.count))) * 100, 100)}%` }}
                  >
                    <span className="text-xs text-white font-semibold">{item.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

