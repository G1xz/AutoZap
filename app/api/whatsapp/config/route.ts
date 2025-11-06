import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const configSchema = z.object({
  instanceId: z.string(),
  phoneId: z.string(),
  accessToken: z.string(),
  appId: z.string().optional(),
  appSecret: z.string().optional(),
  businessAccountId: z.string().optional(),
  webhookVerifyToken: z.string().optional(),
  phone: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = configSchema.parse(body)

    // Verifica se a instância pertence ao usuário
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: data.instanceId },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    // Atualiza a configuração da instância
    const updatedInstance = await prisma.whatsAppInstance.update({
      where: { id: data.instanceId },
      data: {
        phoneId: data.phoneId,
        accessToken: data.accessToken,
        appId: data.appId,
        appSecret: data.appSecret,
        businessAccountId: data.businessAccountId,
        webhookVerifyToken: data.webhookVerifyToken || `verify_${data.instanceId}_${Date.now()}`,
        phone: data.phone,
        status: 'connected',
      },
    })

    return NextResponse.json({ success: true, instance: updatedInstance })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro ao configurar instância:', error)
    return NextResponse.json(
      { error: 'Erro ao configurar instância' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instanceId')

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId é obrigatório' }, { status: 400 })
    }

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        userId: true,
        name: true,
        phone: true,
        phoneId: true,
        status: true,
        businessAccountId: true,
        webhookVerifyToken: true,
        createdAt: true,
      },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    return NextResponse.json(instance)
  } catch (error) {
    console.error('Erro ao buscar configuração:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar configuração' },
      { status: 500 }
    )
  }
}

