'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Zap, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface PointsData {
  pointsAvailable: number
  pointsConsumedThisMonth: number
  planName: string | null
}

interface PointsIndicatorProps {
  compact?: boolean
}

export default function PointsIndicator({ compact = false }: PointsIndicatorProps) {
  const { data: session } = useSession()
  const [pointsData, setPointsData] = useState<PointsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user?.id) {
      fetchPoints()
      // Atualiza a cada 30 segundos
      const interval = setInterval(fetchPoints, 30000)
      return () => clearInterval(interval)
    }
  }, [session])

  const fetchPoints = async () => {
    try {
      const response = await fetch('/api/ai-metrics')
      if (response.ok) {
        const data = await response.json()
        setPointsData({
          pointsAvailable: data.pointsAvailable || 0,
          pointsConsumedThisMonth: data.pointsConsumedThisMonth || 0,
          planName: data.planName || null,
        })
      }
    } catch (error) {
      console.error('Erro ao buscar pontos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!session || loading || !pointsData) {
    return null
  }

  const totalPoints = pointsData.pointsAvailable + pointsData.pointsConsumedThisMonth
  const usagePercentage = totalPoints > 0 
    ? (pointsData.pointsConsumedThisMonth / totalPoints) * 100 
    : 0

  // Determina a cor baseada no uso
  const getBarColor = () => {
    if (usagePercentage >= 90) return 'bg-red-500'
    if (usagePercentage >= 70) return 'bg-orange-500'
    if (usagePercentage >= 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  // Determina se está acabando
  const isLow = pointsData.pointsAvailable < 1000 || usagePercentage >= 80

  // Versão compacta para mobile
  if (compact) {
    return (
      <Link 
        href="/dashboard/plans"
        className="flex items-center gap-2 transition-all hover:opacity-80"
        title={`${pointsData.pointsAvailable.toLocaleString('pt-BR')} pontos disponíveis`}
      >
        <Zap 
          className={`w-4 h-4 ${isLow ? 'text-orange-500' : 'text-blue-600'}`}
          fill={isLow ? '#f97316' : '#2563eb'}
        />
        <span className="text-sm font-semibold text-gray-900">
          {pointsData.pointsAvailable.toLocaleString('pt-BR')}
        </span>
        {isLow && (
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </Link>
    )
  }

  // Versão completa para desktop
  return (
    <Link 
      href="/dashboard/plans"
      className="flex items-center gap-2 sm:gap-3 transition-all group"
      title="Clique para ver planos e comprar mais pontos"
    >
      {/* Ícone */}
      <div className="relative">
        <Zap 
          className={`w-4 h-4 sm:w-5 sm:h-5 ${isLow ? 'text-orange-500' : 'text-blue-600'}`}
          fill={isLow ? '#f97316' : '#2563eb'}
        />
        {isLow && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>

      {/* Informações de pontos */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-sm sm:text-base font-semibold text-gray-900">
            {pointsData.pointsAvailable.toLocaleString('pt-BR')}
          </span>
          <span className="text-xs text-gray-600 hidden sm:inline">pts</span>
        </div>
        
        {/* Barra de progresso */}
        <div className="w-full h-1 bg-gray-200/50 rounded-full overflow-hidden mt-1 min-w-[60px] sm:min-w-[100px]">
          <div
            className={`h-full ${getBarColor()} transition-all duration-300`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
      </div>

      {/* Indicador de baixo */}
      {isLow && (
        <div className="flex items-center text-orange-600">
          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
        </div>
      )}
    </Link>
  )
}

