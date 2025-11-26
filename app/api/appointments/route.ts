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

    // CRÍTICO: Usa select explícito para evitar erro se endDate não existir no banco
    let appointments: Array<{
      id: string
      userId: string
      instanceId: string | null
      contactNumber: string
      contactName: string | null
      date: Date
      endDate?: Date | null
      duration?: number | null
      description: string | null
      status: string
      createdAt: Date
      updatedAt: Date
      instance?: { name: string } | null
    }>
    
    try {
      appointments = await prisma.appointment.findMany({
        where,
        select: {
          id: true,
          userId: true,
          instanceId: true,
          contactNumber: true,
          contactName: true,
          date: true,
          endDate: true,
          duration: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          instance: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { date: 'asc' },
      })
    } catch (error: any) {
      // Se falhar (provavelmente porque endDate/duration não existem ainda), busca sem esses campos
      console.warn('⚠️ [GET /api/appointments] Erro ao buscar com endDate/duration, tentando sem esses campos:', error.message)
      try {
        const appointmentsWithoutNewFields = await prisma.appointment.findMany({
          where,
          select: {
            id: true,
            userId: true,
            instanceId: true,
            contactNumber: true,
            contactName: true,
            date: true,
            description: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            instance: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { date: 'asc' },
        })
        
        // Converte para o formato esperado
        appointments = appointmentsWithoutNewFields.map(apt => ({
          ...apt,
          endDate: null,
          duration: null,
        }))
        console.log('✅ [GET /api/appointments] Busca sem endDate/duration bem-sucedida')
      } catch (fallbackError) {
        console.error('❌ [GET /api/appointments] Erro também na busca sem endDate/duration:', fallbackError)
        throw fallbackError
      }
    }

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

