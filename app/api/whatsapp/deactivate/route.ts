import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST - Desativa uma instância WhatsApp
 * 
 * Usado quando cliente cancela o serviço para evitar uso não autorizado
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { instanceId } = body

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId é obrigatório' }, { status: 400 })
    }

    // Verifica se a instância pertence ao usuário
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    // Desativa a instância
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: {
        active: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Instância desativada com sucesso. Cliente não poderá mais usar.',
    })
  } catch (error) {
    console.error('Erro ao desativar instância:', error)
    return NextResponse.json(
      { error: 'Erro ao desativar instância' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Reativa uma instância WhatsApp
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { instanceId } = body

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId é obrigatório' }, { status: 400 })
    }

    // Verifica se a instância pertence ao usuário
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    // Reativa a instância
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: {
        active: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Instância reativada com sucesso.',
    })
  } catch (error) {
    console.error('Erro ao reativar instância:', error)
    return NextResponse.json(
      { error: 'Erro ao reativar instância' },
      { status: 500 }
    )
  }
}

