import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = { userId: session.user.id }
    if (status && status !== 'all') {
      where.status = status
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        instance: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    })

    const formatted = appointments.map((apt) => ({
      ...apt,
      instanceName: apt.instance?.name || null,
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar agendamentos' },
      { status: 500 }
    )
  }
}

