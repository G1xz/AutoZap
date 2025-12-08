import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAIStats } from '@/lib/ai-metrics'

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

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Erro ao buscar métricas de IA:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar métricas de IA' },
      { status: 500 }
    )
  }
}

