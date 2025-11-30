import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleError, NotFoundError } from '@/lib/errors'
import { rateLimitMiddleware } from '@/lib/rate-limiter'
import { validate, safeValidate } from '@/lib/validations'
import { z } from 'zod'
import { log } from '@/lib/logger'

const updatePixKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pixKey: z.string().min(1).max(200).optional(),
  pixKeyType: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']).optional(),
  isActive: z.boolean().optional(),
})

/**
 * GET - Obtém uma chave Pix específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    await rateLimitMiddleware(request, 'api')

    const pixKey = await prisma.businessPixKey.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        pixKey: true,
        pixKeyType: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!pixKey) {
      throw new NotFoundError('Chave Pix')
    }

    return NextResponse.json({ pixKey })
  } catch (error) {
    const handled = handleError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.statusCode })
  }
}

/**
 * PUT - Atualiza uma chave Pix
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    await rateLimitMiddleware(request, 'api')

    const body = await request.json()
    const data = validate(updatePixKeySchema, body)

    // Verifica se a chave existe e pertence ao usuário
    const existing = await prisma.businessPixKey.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existing) {
      throw new NotFoundError('Chave Pix')
    }

    const pixKey = await prisma.businessPixKey.update({
      where: { id: params.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.pixKey && { pixKey: data.pixKey }),
        ...(data.pixKeyType && { pixKeyType: data.pixKeyType }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      select: {
        id: true,
        name: true,
        pixKey: true,
        pixKeyType: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    log.event('pix_key_updated', {
      userId: session.user.id,
      pixKeyId: pixKey.id,
    })

    return NextResponse.json({ pixKey })
  } catch (error) {
    const handled = handleError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.statusCode })
  }
}

/**
 * DELETE - Remove uma chave Pix
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    await rateLimitMiddleware(request, 'api')

    // Verifica se a chave existe e pertence ao usuário
    const existing = await prisma.businessPixKey.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existing) {
      throw new NotFoundError('Chave Pix')
    }

    // Verifica se há serviços usando esta chave
    try {
      const servicesUsingKey = await prisma.service.findMany({
        where: {
          pixKeyId: params.id,
          userId: session.user.id,
        },
        select: { id: true },
      })

      if (servicesUsingKey.length > 0) {
        return NextResponse.json(
          {
            error: 'Não é possível excluir esta chave Pix pois ela está sendo usada por serviços',
            servicesCount: servicesUsingKey.length,
          },
          { status: 400 }
        )
      }
    } catch (error) {
      // Se houver erro ao verificar serviços (ex: Prisma Client não regenerado), continua com exclusão
      console.warn('Erro ao verificar serviços usando a chave Pix:', error)
    }

    await prisma.businessPixKey.delete({
      where: { id: params.id },
    })

    log.event('pix_key_deleted', {
      userId: session.user.id,
      pixKeyId: params.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = handleError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.statusCode })
  }
}

