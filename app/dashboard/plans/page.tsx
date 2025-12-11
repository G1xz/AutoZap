'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Plan {
  id: string
  name: string
  displayName: string
  price: number
  adminPercentage: number
  pointsAmount: number
  isActive: boolean
  isCurrentPlan?: boolean
}

export default function PlansPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    fetchPlans()
  }, [session, router])

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/plans')
      if (response.ok) {
        const data = await response.json()
        setPlans(data.plans)
      }
    } catch (error) {
      console.error('Erro ao buscar planos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (planId: string, price: number) => {
    if (!confirm(`Deseja assinar o plano por R$ ${price.toFixed(2)}?`)) {
      return
    }

    setSubscribing(planId)
    try {
      const response = await fetch('/api/plans/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          pricePaid: price,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Plano assinado com sucesso! Você recebeu ${data.pointsAdded} pontos.`)
        router.push('/dashboard')
      } else {
        const error = await response.json()
        alert(`Erro: ${error.error}`)
      }
    } catch (error) {
      console.error('Erro ao assinar plano:', error)
      alert('Erro ao assinar plano. Tente novamente.')
    } finally {
      setSubscribing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando planos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Escolha seu Plano</h1>
        <p className="text-lg text-gray-600">
          Selecione o plano ideal para suas necessidades
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-lg shadow-lg border-2 ${
                plan.isCurrentPlan
                  ? 'border-green-500 transform scale-105'
                  : plan.name === 'enterprise'
                  ? 'border-blue-600'
                  : 'border-gray-200'
              } overflow-hidden relative`}
            >
              {plan.isCurrentPlan && (
                <div className="bg-green-500 text-white text-center py-2 text-sm font-semibold">
                  ✓ Plano Ativo
                </div>
              )}
              {!plan.isCurrentPlan && plan.name === 'enterprise' && (
                <div className="bg-blue-600 text-white text-center py-2 text-sm font-semibold">
                  Mais Popular
                </div>
              )}

              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.displayName}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    R$ {plan.price.toFixed(2)}
                  </span>
                  <span className="text-gray-600">/mês</span>
                </div>

                <div className="mb-6">
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <svg
                      className="w-5 h-5 text-green-500 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="font-semibold text-gray-900 text-lg">
                      {plan.pointsAmount.toLocaleString('pt-BR')} pontos
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleSubscribe(plan.id, plan.price)}
                  disabled={subscribing === plan.id || plan.isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                    plan.isCurrentPlan
                      ? 'bg-green-500 text-white cursor-not-allowed'
                      : plan.name === 'enterprise'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {subscribing === plan.id
                    ? 'Processando...'
                    : plan.isCurrentPlan
                    ? 'Plano Atual'
                    : 'Assinar Plano'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Como funciona?
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>
            • <strong>1 dólar = 1000 pontos</strong>: Cada dólar convertido vira 1000 pontos
          </li>
          <li>
            • <strong>Pontos para você</strong>: O valor do plano é convertido em
            pontos que você pode usar para requisições de IA
          </li>
          <li>
            • <strong>Planos maiores = mais pontos</strong>: Quanto maior o plano, mais
            pontos você recebe
          </li>
        </ul>
      </div>
    </div>
  )
}

