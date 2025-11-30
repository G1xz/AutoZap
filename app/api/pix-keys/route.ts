import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleError } from '@/lib/errors'
import { rateLimitMiddleware } from '@/lib/rate-limiter'
import { validate, safeValidate } from '@/lib/validations'
import { z } from 'zod'
import { log } from '@/lib/logger'

const pixKeySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  pixKey: z.string().min(1, 'Chave Pix é obrigatória').max(200),
  pixKeyType: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']).optional().default('random'),
  isActive: z.boolean().optional().default(true),
})

/**
 * GET - Lista todas as chaves Pix do usuário
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    await rateLimitMiddleware(request, 'api')

    const pixKeys = await prisma.businessPixKey.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
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

    return NextResponse.json({ pixKeys })
  } catch (error) {
    const handled = handleError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.statusCode })
  }
}

/**
 * POST - Cria uma nova chave Pix
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    await rateLimitMiddleware(request, 'api')

    const body = await request.json()
    const data = validate(pixKeySchema, body)

    const pixKey = await prisma.businessPixKey.create({
      data: {
        userId: session.user.id,
        name: data.name,
        pixKey: data.pixKey,
        pixKeyType: data.pixKeyType,
        isActive: data.isActive,
      },
      select: {
        id: true,
        name: true,
        pixKey: true,
        pixKeyType: true,
        isActive: true,
        createdAt: true,
      },
    })

    log.event('pix_key_created', {
      userId: session.user.id,
      pixKeyId: pixKey.id,
    })

    return NextResponse.json({ pixKey }, { status: 201 })
  } catch (error) {
    const handled = handleError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.statusCode })
  }
}

