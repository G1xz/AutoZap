import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateAppointment } from '@/lib/appointments'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { status, dateTime, duration } = await request.json()

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }

    if (status && !dateTime) {
      const updated = await prisma.appointment.update({
        where: { id: params.id },
        data: { status },
      })

      return NextResponse.json(updated)
    }

    if (!dateTime) {
      return NextResponse.json({ error: 'Nova data/horário é obrigatória.' }, { status: 400 })
    }

    const newDate = new Date(dateTime)
    if (isNaN(newDate.getTime())) {
      return NextResponse.json({ error: 'Data/hora inválida.' }, { status: 400 })
    }

    const result = await updateAppointment(params.id, session.user.id, newDate, duration)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erro ao reagendar agendamento' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar agendamento' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      select: {
        id: true,
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }

    await prisma.appointment.delete({
      where: { id: params.id },
      select: {
        id: true,
      },
    })

    return NextResponse.json({ success: true, message: 'Agendamento excluído com sucesso' })
  } catch (error) {
    console.error('Erro ao excluir agendamento:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir agendamento' },
      { status: 500 }
    )
  }
}

