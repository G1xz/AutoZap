import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAIStats } from '@/lib/ai-metrics'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Busca estatísticas de IA para o usuário
    const stats = await getAIStats({
      userId: session.user.id,
    })

    // Busca informações do plano do usuário
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        planName: true,
        pointsAvailable: true,
        pointsConsumedThisMonth: true,
        planRenewalDate: true,
      },
    })

    return NextResponse.json({
      ...stats,
      planName: user?.planName || null,
      pointsAvailable: user?.pointsAvailable || 0,
      pointsConsumedThisMonth: user?.pointsConsumedThisMonth || 0,
      planRenewalDate: user?.planRenewalDate || null,
    })
  } catch (error) {
    console.error('Erro ao buscar métricas de IA:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar métricas de IA' },
      { status: 500 }
    )
  }
}

