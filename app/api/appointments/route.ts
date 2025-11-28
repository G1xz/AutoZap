import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAppointment } from '@/lib/appointments'

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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      contactName,
      contactNumber,
      description,
      dateTime,
      duration,
      status = 'pending',
    } = body

    if (!contactNumber || !dateTime) {
      return NextResponse.json(
        { error: 'Contato e data/horário são obrigatórios.' },
        { status: 400 }
      )
    }

    const normalizedNumber = String(contactNumber).replace(/\D/g, '')
    if (!normalizedNumber) {
      return NextResponse.json(
        { error: 'Número de contato inválido.' },
        { status: 400 }
      )
    }

    const parsedDate = new Date(dateTime)
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: 'Data/hora inválida.' },
        { status: 400 }
      )
    }

    const durationMinutes = Number(duration) > 0 ? Number(duration) : 60

    const result = await createAppointment({
      userId: session.user.id,
      instanceId: null,
      contactNumber: normalizedNumber,
      contactName: contactName || null,
      date: parsedDate,
      duration: durationMinutes,
      description: description || null,
    })

    if (!result.success || !result.appointment) {
      return NextResponse.json(
        { error: result.error || 'Erro ao criar agendamento.' },
        { status: 400 }
      )
    }

    const appointmentId = result.appointment.id

    if (status && status !== 'pending') {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status },
      })
    }

    const createdAppointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
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
      },
    })

    return NextResponse.json(createdAppointment)
  } catch (error) {
    console.error('Erro ao criar agendamento manual:', error)
    return NextResponse.json(
      { error: 'Erro ao criar agendamento manual.' },
      { status: 500 }
    )
  }
}

