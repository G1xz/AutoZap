import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(instances)
  } catch (error) {
    console.error('Erro ao buscar instâncias:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar instâncias' },
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
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nome é obrigatório' },
        { status: 400 }
      )
    }

    const instance = await prisma.whatsAppInstance.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        status: 'disconnected',
      },
    })

    return NextResponse.json(instance, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar instância:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro ao criar instância'
    return NextResponse.json(
      { 
        error: 'Erro ao criar instância',
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}

