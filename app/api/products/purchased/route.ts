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
    const whereClause: any = {
      userId: session.user.id,
    }
    
    if (status !== 'all') {
      whereClause.status = status
    }

    const purchasedProducts = await prisma.productInterest.findMany({
      where: whereClause,
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
        lastInteraction: 'desc', // Ordena por última interação (mais recentes primeiro)
      },
    })
    
    // Ordena manualmente para colocar convertedAt primeiro quando existir
    const sortedProducts = purchasedProducts.sort((a, b) => {
      if (a.convertedAt && b.convertedAt) {
        return new Date(b.convertedAt).getTime() - new Date(a.convertedAt).getTime()
      }
      if (a.convertedAt && !b.convertedAt) return -1
      if (!a.convertedAt && b.convertedAt) return 1
      return 0
    })

    return NextResponse.json({ products: sortedProducts })
  } catch (error) {
    console.error('Erro ao buscar produtos comprados:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar produtos comprados' },
      { status: 500 }
    )
  }
}

