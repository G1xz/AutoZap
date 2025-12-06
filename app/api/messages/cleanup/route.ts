import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cleanupOldMessages, getMessageStats } from '@/lib/message-cleanup'
import { prisma } from '@/lib/prisma'

/**
 * GET - Obtém estatísticas de mensagens e configuração de retenção
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        messageRetentionDays: true,
      },
    })

    const stats = await getMessageStats(session.user.id)

    return NextResponse.json({
      retentionDays: user?.messageRetentionDays || 90,
      stats,
    })
  } catch (error) {
    console.error('Erro ao buscar estatísticas de mensagens:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas de mensagens' },
      { status: 500 }
    )
  }
}

/**
 * POST - Executa limpeza de mensagens antigas
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        messageRetentionDays: true,
      },
    })

    const retentionDays = user?.messageRetentionDays || 90

    const result = await cleanupOldMessages(session.user.id, retentionDays)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // Atualiza estatísticas após limpeza
    const stats = await getMessageStats(session.user.id)

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      stats,
    })
  } catch (error) {
    console.error('Erro ao limpar mensagens:', error)
    return NextResponse.json(
      { error: 'Erro ao limpar mensagens' },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Atualiza configuração de retenção de mensagens
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { retentionDays } = body

    if (retentionDays !== undefined) {
      if (typeof retentionDays !== 'number' || retentionDays < 1 || retentionDays > 3650) {
        return NextResponse.json(
          { error: 'Dias de retenção deve ser um número entre 1 e 3650 (10 anos)' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        messageRetentionDays: retentionDays || null,
      },
      select: {
        messageRetentionDays: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao atualizar configuração de retenção:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar configuração de retenção' },
      { status: 500 }
    )
  }
}

