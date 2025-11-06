import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  trigger: z.string().min(1).optional(),
  response: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
  instanceId: z.string().nullable().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rule = await prisma.automationRule.findUnique({
      where: { id: params.id },
    })

    if (!rule) {
      return NextResponse.json(
        { error: 'Regra não encontrada' },
        { status: 404 }
      )
    }

    if (rule.userId !== session.user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateRuleSchema.parse(body)

    // Se apenas isActive foi enviado (toggle rápido)
    if (Object.keys(body).length === 1 && 'isActive' in body) {
      const updatedRule = await prisma.automationRule.update({
        where: { id: params.id },
        data: { isActive: body.isActive },
      })
      return NextResponse.json(updatedRule)
    }

    // Verifica se instanceId pertence ao usuário (se fornecido)
    if (data.instanceId !== undefined) {
      if (data.instanceId) {
        const instance = await prisma.whatsAppInstance.findUnique({
          where: { id: data.instanceId },
        })

        if (!instance || instance.userId !== session.user.id) {
          return NextResponse.json(
            { error: 'Instância inválida' },
            { status: 400 }
          )
        }
      }
    }

    const updatedRule = await prisma.automationRule.update({
      where: { id: params.id },
      data: {
        ...data,
      },
    })

    return NextResponse.json(updatedRule)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar regra:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar regra' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rule = await prisma.automationRule.findUnique({
      where: { id: params.id },
    })

    if (!rule) {
      return NextResponse.json(
        { error: 'Regra não encontrada' },
        { status: 404 }
      )
    }

    if (rule.userId !== session.user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    await prisma.automationRule.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir regra:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir regra' },
      { status: 500 }
    )
  }
}



