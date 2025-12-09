import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { subscribeUserToPlan } from '@/lib/plans'

/**
 * POST /api/plans/subscribe
 * Assina um plano para o usuário logado
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { planId, pricePaid } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'ID do plano é obrigatório' },
        { status: 400 }
      )
    }

    // Assina o plano
    const result = await subscribeUserToPlan(
      session.user.id,
      planId,
      pricePaid || 0
    )

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      pointsAdded: result.pointsAdded,
      message: `Plano assinado com sucesso! Você recebeu ${result.pointsAdded} pontos.`,
    })
  } catch (error: any) {
    console.error('Erro ao assinar plano:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao assinar plano' },
      { status: 500 }
    )
  }
}

