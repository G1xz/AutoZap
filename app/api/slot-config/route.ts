import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SlotConfig } from '@/lib/appointment-slots'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { slotConfig: true },
    })

    let slotConfig: SlotConfig | null = null
    if (user?.slotConfig) {
      try {
        slotConfig = JSON.parse(user.slotConfig) as SlotConfig
      } catch (error) {
        console.error('Erro ao parsear slotConfig:', error)
      }
    }

    return NextResponse.json({ slotConfig })
  } catch (error) {
    console.error('Erro ao buscar configuração de slots:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar configuração de slots' },
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
    const { slotConfig } = body

    if (!slotConfig || typeof slotConfig !== 'object') {
      return NextResponse.json(
        { error: 'Formato de configuração inválido' },
        { status: 400 }
      )
    }

    // Valida valores
    const slotSize = slotConfig.slotSizeMinutes
    const buffer = slotConfig.bufferMinutes || 0

    if (!slotSize || typeof slotSize !== 'number' || slotSize < 5 || slotSize > 60) {
      return NextResponse.json(
        { error: 'Tamanho do slot deve ser entre 5 e 60 minutos' },
        { status: 400 }
      )
    }

    if (typeof buffer !== 'number' || buffer < 0 || buffer > 60) {
      return NextResponse.json(
        { error: 'Buffer deve ser entre 0 e 60 minutos' },
        { status: 400 }
      )
    }

    // Verifica e cria coluna se necessário
    try {
      const columnCheck = await prisma.$queryRawUnsafe(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' 
        AND column_name = 'slotConfig';
      `) as Array<{ column_name: string }>

      if (columnCheck.length === 0) {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "User" 
          ADD COLUMN IF NOT EXISTS "slotConfig" TEXT;
        `)
      }
    } catch (error) {
      console.warn('Erro ao verificar/criar coluna slotConfig:', error)
    }

    // Salva como JSON string
    const configJson = JSON.stringify({
      slotSizeMinutes: slotSize,
      bufferMinutes: buffer,
    })

    await prisma.user.update({
      where: { id: session.user.id },
      data: { slotConfig: configJson },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao salvar configuração de slots:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar configuração de slots' },
      { status: 500 }
    )
  }
}

