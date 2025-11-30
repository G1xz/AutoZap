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
    const status = searchParams.get('status') || 'converted' // Por padrão, apenas produtos comprados

    // Busca produtos comprados (ProductInterest com status converted)
    const purchasedProducts = await prisma.productInterest.findMany({
      where: {
        userId: session.user.id,
        status: status === 'all' ? undefined : status,
      },
      include: {
        instance: {
          select: {
            id: true,
            name: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        convertedAt: 'desc', // Mais recentes primeiro
      },
    })

    return NextResponse.json({ products: purchasedProducts })
  } catch (error) {
    console.error('Erro ao buscar produtos comprados:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar produtos comprados' },
      { status: 500 }
    )
  }
}

