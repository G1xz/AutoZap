import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: params.id },
    })

    if (!instance) {
      return NextResponse.json(
        { error: 'Instância não encontrada' },
        { status: 404 }
      )
    }

    if (instance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    await prisma.whatsAppInstance.update({
      where: { id: params.id },
      data: { 
        status: 'disconnected',
        accessToken: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao desconectar instância:', error)
    return NextResponse.json(
      { error: 'Erro ao desconectar instância' },
      { status: 500 }
    )
  }
}

