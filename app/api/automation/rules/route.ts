import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const ruleSchema = z.object({
  name: z.string().min(1),
  trigger: z.string().min(1),
  response: z.string().min(1),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
  instanceId: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rules = await prisma.automationRule.findMany({
      where: { userId: session.user.id },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(rules)
  } catch (error) {
    console.error('Erro ao buscar regras:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar regras' },
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
    const data = ruleSchema.parse(body)

    // Verifica se instanceId pertence ao usuário (se fornecido)
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

    const rule = await prisma.automationRule.create({
      data: {
        userId: session.user.id,
        name: data.name,
        trigger: data.trigger,
        response: data.response,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
        instanceId: data.instanceId ?? null,
      },
    })

    return NextResponse.json(rule, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro ao criar regra:', error)
    return NextResponse.json(
      { error: 'Erro ao criar regra' },
      { status: 500 }
    )
  }
}



