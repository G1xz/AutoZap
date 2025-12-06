import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateFrete } from '@/lib/delivery'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { deliveryAddress } = body

    if (!deliveryAddress || !deliveryAddress.trim()) {
      return NextResponse.json(
        { error: 'Endereço de entrega é obrigatório' },
        { status: 400 }
      )
    }

    // Busca configurações do usuário
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        businessAddress: true,
        deliveryPricePerKm: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (!user.businessAddress || !user.businessAddress.trim()) {
      return NextResponse.json(
        { error: 'Endereço do estabelecimento não configurado. Configure em Configurações → Configurações de Entrega.' },
        { status: 400 }
      )
    }

    if (!user.deliveryPricePerKm || user.deliveryPricePerKm <= 0) {
      return NextResponse.json(
        { error: 'Preço por quilômetro não configurado. Configure em Configurações → Configurações de Entrega.' },
        { status: 400 }
      )
    }

    // Calcula frete
    const freightResult = await calculateFrete(
      user.businessAddress,
      deliveryAddress.trim(),
      user.deliveryPricePerKm
    )

    if (!freightResult.success) {
      return NextResponse.json(
        { error: freightResult.error || 'Não foi possível calcular o frete. Verifique se os endereços estão corretos.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      distance: freightResult.distance,
      duration: freightResult.duration,
      pricePerKm: user.deliveryPricePerKm,
      freightPrice: freightResult.freightPrice,
      originAddress: user.businessAddress,
      destinationAddress: deliveryAddress.trim(),
    })
  } catch (error) {
    console.error('Erro ao calcular frete:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular frete' },
      { status: 500 }
    )
  }
}

