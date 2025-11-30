import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { WorkingHoursConfig } from '@/lib/working-hours'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { workingHoursConfig: true },
    })

    let workingHoursConfig: WorkingHoursConfig | null = null
    if (user?.workingHoursConfig) {
      try {
        workingHoursConfig = JSON.parse(user.workingHoursConfig) as WorkingHoursConfig
      } catch (error) {
        console.error('Erro ao parsear workingHoursConfig:', error)
      }
    }

    return NextResponse.json({ workingHoursConfig })
  } catch (error) {
    console.error('Erro ao buscar horários de funcionamento:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar horários de funcionamento' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { workingHoursConfig } = body

    // Valida que é um objeto válido
    if (workingHoursConfig && typeof workingHoursConfig !== 'object') {
      return NextResponse.json(
        { error: 'Formato de horários inválido' },
        { status: 400 }
      )
    }

    // Salva como JSON string
    const configJson = workingHoursConfig ? JSON.stringify(workingHoursConfig) : null

    await prisma.user.update({
      where: { id: session.user.id },
      data: { workingHoursConfig: configJson },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao salvar horários de funcionamento:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar horários de funcionamento' },
      { status: 500 }
    )
  }
}

