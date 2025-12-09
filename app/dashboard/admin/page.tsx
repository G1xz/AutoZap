'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface AdminMetrics {
  totalUsers: number
  totalAIMetrics: number
  totalCost: number
  totalPointsConsumed: number
  totalCachedRequests: number
  averageCostPerRequest: number
  averageRequestsPerSaleConversation: number
  averageRequestsPerConversation: number
  totalSales: number
  totalOrders: number
  completedOrders: number
  totalConversations: number
  conversationsWithSales: number
  metricsByUser: Array<{
    userId: string
    userName: string
    userEmail: string
    planName: string | null
    pointsAvailable: number
    pointsConsumedThisMonth: number
    aiRequests: number
    aiCost: number
    aiPointsConsumed: number
    totalSales: number
    totalOrders: number
    createdAt: Date
  }>
}

export default function AdminPage() {
  const { data: session } = useSession()
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAdminMetrics()
  }, [])

  const fetchAdminMetrics = async () => {
    try {
      const response = await fetch('/api/admin/metrics')
      if (!response.ok) {
        if (response.status === 403) {
          setError('Você não tem permissão para acessar esta página.')
        } else {
          setError('Erro ao carregar métricas.')
        }
        return
      }
      const data = await response.json()
      setMetrics(data)
    } catch (error) {
      console.error('Erro ao buscar métricas de administrador:', error)
      setError('Erro ao carregar métricas.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg text-gray-600">Carregando métricas...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg text-red-600">{error}</div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg text-gray-600">Nenhuma métrica encontrada.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Painel de Administrador</h1>
        <div className="text-sm text-gray-600">
          Logado como: <span className="font-semibold">{session?.user?.email}</span>
        </div>
      </div>

      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Total de Usuários</div>
          <div className="text-3xl font-bold text-gray-900">{metrics.totalUsers}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Total de Vendas</div>
          <div className="text-3xl font-bold text-green-600">
            R$ {metrics.totalSales.toFixed(2).replace('.', ',')}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Custo Total de IA</div>
          <div className="text-3xl font-bold text-red-600">
            ${metrics.totalCost.toFixed(4)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Pontos Consumidos</div>
          <div className="text-3xl font-bold text-blue-600">
            {metrics.totalPointsConsumed.toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Estatísticas de IA */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas de Inteligência Artificial</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{metrics.totalAIMetrics}</div>
            <div className="text-sm text-gray-600 mt-1">Total de Requisições</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{metrics.totalCachedRequests}</div>
            <div className="text-sm text-gray-600 mt-1">Respostas em Cache</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{metrics.totalPointsConsumed.toLocaleString('pt-BR')}</div>
            <div className="text-sm text-gray-600 mt-1">Pontos Consumidos</div>
          </div>
        </div>

        {/* Métricas de Custo e Médias */}
        <div className="border-t pt-6 mt-6">
          <h3 className="text-md font-semibold text-gray-800 mb-4">Métricas de Custo e Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                ${metrics.averageCostPerRequest.toFixed(6)}
              </div>
              <div className="text-sm text-gray-600 mt-1">Custo Médio por Requisição</div>
              <div className="text-xs text-gray-500 mt-1">(apenas requisições não em cache)</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">
                {metrics.averageRequestsPerSaleConversation.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 mt-1">Requisições Médias por Conversa com Venda</div>
              <div className="text-xs text-gray-500 mt-1">
                ({metrics.conversationsWithSales} conversas com vendas)
              </div>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="text-2xl font-bold text-indigo-700">
                {metrics.averageRequestsPerConversation.toFixed(1)}
              </div>
              <div className="text-sm text-gray-600 mt-1">Requisições Médias por Conversa</div>
              <div className="text-xs text-gray-500 mt-1">
                ({metrics.totalConversations} conversas no total)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas de Vendas */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Estatísticas de Vendas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{metrics.totalOrders}</div>
            <div className="text-sm text-gray-600 mt-1">Total de Pedidos</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{metrics.completedOrders}</div>
            <div className="text-sm text-gray-600 mt-1">Pedidos Concluídos</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              R$ {metrics.totalSales.toFixed(2).replace('.', ',')}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total de Vendas</div>
          </div>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Métricas por Usuário</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plano
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pontos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requisições IA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Custo IA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendas
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.metricsByUser.map((user) => (
                <tr key={user.userId}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.userName}</div>
                    <div className="text-sm text-gray-500">{user.userEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.planName || 'Sem plano'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {user.pointsAvailable.toLocaleString('pt-BR')} disponíveis
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.pointsConsumedThisMonth.toLocaleString('pt-BR')} consumidos este mês
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.aiRequests}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">${user.aiCost.toFixed(4)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      R$ {user.totalSales.toFixed(2).replace('.', ',')}
                    </div>
                    <div className="text-xs text-gray-500">{user.totalOrders} pedidos</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

