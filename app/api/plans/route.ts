import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getActivePlans } from '@/lib/plans'

/**
 * GET /api/plans
 * Retorna todos os planos ativos disponíveis
 */
export async function GET(request: NextRequest) {
  try {
    const plans = await getActivePlans()
    
    return NextResponse.json({
      plans: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        price: plan.price,
        adminPercentage: plan.adminPercentage,
        pointsAmount: plan.pointsAmount,
        isActive: plan.isActive,
      })),
    })
  } catch (error) {
    console.error('Erro ao buscar planos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar planos' },
      { status: 500 }
    )
  }
}

