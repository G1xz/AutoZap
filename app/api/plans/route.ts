import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getActivePlans } from '@/lib/plans'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/plans
 * Retorna todos os planos ativos disponíveis e o plano atual do usuário
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const plans = await getActivePlans()
    
    // Busca o plano atual do usuário se estiver logado
    let currentPlanName: string | null = null
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { planName: true },
      })
      currentPlanName = user?.planName || null
    }
    
    // Encontra qual plano corresponde ao nome do usuário
    let currentPlanId: string | null = null
    if (currentPlanName) {
      const matchingPlan = plans.find(plan => plan.displayName === currentPlanName)
      currentPlanId = matchingPlan?.id || null
    }
    
    return NextResponse.json({
      plans: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        price: plan.price,
        adminPercentage: plan.adminPercentage,
        pointsAmount: plan.pointsAmount,
        isActive: plan.isActive,
        isCurrentPlan: plan.id === currentPlanId,
      })),
      currentPlanId,
      currentPlanName,
    })
  } catch (error) {
    console.error('Erro ao buscar planos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar planos' },
      { status: 500 }
    )
  }
}

