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

interface BusinessMetricsData {
  serviceProfit: number
  productProfit: number
  totalSales: number
  totalOrders: number
  pendingOrders: number
  confirmedOrders: number
  completedOrders: number
  conversionRate: number
  totalConversations: number
  salesLast30Days: number
  salesByDay: Record<string, number>
  averagePointsPerRequest: number
  remainingRequests: number
}

interface AIMetricsData {
  totalRequests: number
  totalPointsConsumed: number
  pointsAvailable: number
  cachedRequests: number
}

export default function ReportsManager() {
  const { data: session } = useSession()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetricsData | null>(null)
  const [aiMetrics, setAiMetrics] = useState<AIMetricsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
    fetchBusinessMetrics()
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

  const fetchBusinessMetrics = async () => {
    try {
      const response = await fetch('/api/business-metrics')
      if (response.ok) {
        const data = await response.json()
        setBusinessMetrics(data)
      }
    } catch (error) {
      console.error('Erro ao buscar métricas de negócio:', error)
    }
  }

  const fetchAIMetrics = async () => {
    try {
      const response = await fetch('/api/ai-metrics')
      if (response.ok) {
        const data = await response.json()
        // Calcula pontos consumidos e disponíveis
        const totalPointsConsumed = data.totalRequests > 0 ? data.totalPointsConsumed || 0 : 0
        setAiMetrics({
          totalRequests: data.totalRequests || 0,
          totalPointsConsumed,
          pointsAvailable: data.pointsAvailable || 0,
          cachedRequests: data.cachedRequests || 0,
        })
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

      {/* Métricas de Negócio */}
      {businessMetrics && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 Métricas de Negócio</h3>
          
          {/* Cards principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-700 mb-1">Lucro de Serviços</div>
              <div className="text-2xl font-bold text-green-900">
                R$ {businessMetrics.serviceProfit.toFixed(2).replace('.', ',')}
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-700 mb-1">Lucro de Produtos</div>
              <div className="text-2xl font-bold text-blue-900">
                R$ {businessMetrics.productProfit.toFixed(2).replace('.', ',')}
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-purple-700 mb-1">Total de Vendas</div>
              <div className="text-2xl font-bold text-purple-900">
                R$ {businessMetrics.totalSales.toFixed(2).replace('.', ',')}
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-sm text-orange-700 mb-1">Taxa de Conversão</div>
              <div className="text-2xl font-bold text-orange-900">
                {businessMetrics.conversionRate.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Métricas de Requisições de IA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="text-sm text-indigo-700 mb-1">Média de Pontos por Requisição</div>
              <div className="text-2xl font-bold text-indigo-900">
                {businessMetrics.averagePointsPerRequest.toFixed(2)} pts
              </div>
              <div className="text-xs text-indigo-600 mt-1">
                Baseado em requisições não em cache
              </div>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <div className="text-sm text-teal-700 mb-1">Requisições Restantes</div>
              <div className="text-2xl font-bold text-teal-900">
                {businessMetrics.remainingRequests.toLocaleString('pt-BR')}
              </div>
              <div className="text-xs text-teal-600 mt-1">
                Com os pontos disponíveis
              </div>
            </div>
          </div>

          {/* Estatísticas de pedidos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{businessMetrics.totalOrders}</div>
              <div className="text-sm text-gray-600 mt-1">Total de Pedidos</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{businessMetrics.pendingOrders}</div>
              <div className="text-sm text-gray-600 mt-1">Pendentes</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{businessMetrics.confirmedOrders}</div>
              <div className="text-sm text-gray-600 mt-1">Confirmados</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{businessMetrics.completedOrders}</div>
              <div className="text-sm text-gray-600 mt-1">Concluídos</div>
            </div>
          </div>

          {/* Vendas dos últimos 30 dias */}
          <div className="mt-6">
            <h4 className="text-md font-semibold text-gray-800 mb-3">Vendas dos Últimos 30 Dias</h4>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-3xl font-bold text-gray-900">
                R$ {businessMetrics.salesLast30Days.toFixed(2).replace('.', ',')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Métricas de IA (Pontos) */}
      {aiMetrics && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🤖 Uso de Inteligência Artificial</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-purple-700 mb-1">Total de Requisições</div>
              <div className="text-2xl font-bold text-purple-900">{aiMetrics.totalRequests}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-700 mb-1">Pontos Consumidos</div>
              <div className="text-2xl font-bold text-blue-900">{aiMetrics.totalPointsConsumed.toLocaleString('pt-BR')}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-700 mb-1">Pontos Disponíveis</div>
              <div className="text-2xl font-bold text-green-900">{aiMetrics.pointsAvailable.toLocaleString('pt-BR')}</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-sm text-orange-700 mb-1">Respostas em Cache</div>
              <div className="text-2xl font-bold text-orange-900">{aiMetrics.cachedRequests}</div>
            </div>
          </div>
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

