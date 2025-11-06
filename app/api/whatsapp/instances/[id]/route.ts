import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
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

    // Com WhatsApp Cloud API não há conexão persistente para desconectar
    // Apenas deleta a instância do banco
    await prisma.whatsAppInstance.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir instância:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir instância' },
      { status: 500 }
    )
  }
}




