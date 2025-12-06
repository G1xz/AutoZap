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

    return NextResponse.json({
      businessAddress: user.businessAddress,
      deliveryPricePerKm: user.deliveryPricePerKm,
    })
  } catch (error) {
    console.error('Erro ao buscar configurações de entrega:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar configurações de entrega' },
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
    const { businessAddress, deliveryPricePerKm } = body

    console.log('📦 [delivery-settings] Dados recebidos:', { businessAddress, deliveryPricePerKm })

    // Validações
    if (businessAddress && businessAddress.trim() && (!deliveryPricePerKm || deliveryPricePerKm < 0)) {
      return NextResponse.json(
        { error: 'Preço por quilômetro é obrigatório quando o endereço é informado' },
        { status: 400 }
      )
    }

    // Prepara dados para atualização
    const updateData: any = {}
    
    if (businessAddress !== undefined) {
      updateData.businessAddress = businessAddress?.trim() || null
    }
    
    if (deliveryPricePerKm !== undefined && deliveryPricePerKm !== null) {
      const price = typeof deliveryPricePerKm === 'string' 
        ? parseFloat(deliveryPricePerKm.replace(',', '.'))
        : parseFloat(deliveryPricePerKm.toString())
      
      if (isNaN(price) || price < 0) {
        return NextResponse.json(
          { error: 'Preço por quilômetro deve ser um número válido maior ou igual a zero' },
          { status: 400 }
        )
      }
      
      updateData.deliveryPricePerKm = price
    } else if (deliveryPricePerKm === null) {
      updateData.deliveryPricePerKm = null
    }

    console.log('📦 [delivery-settings] Dados para atualizar:', updateData)

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        businessAddress: true,
        deliveryPricePerKm: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao salvar configurações de entrega:', error)
    
    // Verifica se é erro do Prisma (campo não existe)
    if (error instanceof Error) {
      if (error.message.includes('Unknown column') || error.message.includes('column') || error.message.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Erro: Campos de entrega não encontrados no banco de dados. Execute: npx prisma db push' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: `Erro ao salvar configurações de entrega: ${error instanceof Error ? error.message : 'Erro desconhecido'}` },
      { status: 500 }
    )
  }
}

