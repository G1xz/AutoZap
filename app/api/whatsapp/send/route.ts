import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendWhatsAppMessage } from '@/lib/whatsapp-cloud-api'
import { z } from 'zod'

const sendMessageSchema = z.object({
  instanceId: z.string(),
  to: z.string(),
  message: z.string().min(1),
  messageType: z.enum(['service', 'utility', 'marketing', 'authentication']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const data = sendMessageSchema.parse(body)

    // Verifica se a instância pertence ao usuário
    const { prisma } = await import('@/lib/prisma')
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: data.instanceId },
    })

    if (!instance || instance.userId !== session.user.id) {
      return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
    }

    // Envia a mensagem
    await sendWhatsAppMessage(
      data.instanceId,
      data.to,
      data.message,
      data.messageType || 'service'
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro ao enviar mensagem:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao enviar mensagem' },
      { status: 500 }
    )
  }
}



