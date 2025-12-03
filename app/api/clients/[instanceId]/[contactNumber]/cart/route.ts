import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getCart } from '@/lib/cart'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string; contactNumber: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { instanceId, contactNumber } = await params

    // Verifica se a instância pertence ao usuário
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
      select: { userId: true },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Instância não encontrada ou não autorizada' }, { status: 404 })
    }

    // Busca o carrinho
    const normalizedContact = contactNumber.replace(/\D/g, '')
    const cart = await getCart(instanceId, normalizedContact)

    // Verifica se há pedidos relacionados a este carrinho
    const orders = await prisma.order.findMany({
      where: {
        instanceId,
        contactNumber: normalizedContact,
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      cart,
      orders,
      hasActiveCart: cart.items.length > 0,
      hasOrders: orders.length > 0,
    })
  } catch (error) {
    console.error('Erro ao buscar carrinho do cliente:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar carrinho' },
      { status: 500 }
    )
  }
}

