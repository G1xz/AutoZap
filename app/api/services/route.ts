import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleError } from '@/lib/errors'
import { rateLimitMiddleware } from '@/lib/rate-limiter'
import { validate } from '@/lib/validations'
import { z } from 'zod'
import { log } from '@/lib/logger'

const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  // Promoções
  hasPromotions: z.boolean().optional(),
  promotions: z.array(z.object({
    value: z.number(),
    type: z.enum(['percent', 'value']),
    gatewayLink: z.string().url().optional(),
  })).nullable().optional(),
  pixKeyId: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await rateLimitMiddleware(request, 'api')

    const services = await prisma.service.findMany({
      where: { userId: session.user.id },
      include: {
        pixKey: {
          select: {
            id: true,
            name: true,
            pixKey: true,
            pixKeyType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Parse promotions JSON para cada serviço
    const servicesWithParsedPromotions = services.map(service => ({
      ...service,
      promotions: service.promotions ? JSON.parse(service.promotions) : null,
    }))

    return NextResponse.json(servicesWithParsedPromotions)
  } catch (error) {
    const handled = handleError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.statusCode })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await rateLimitMiddleware(request, 'api')

    const body = await request.json()
    const data = validate(serviceSchema, body)

    // Verifica se a chave Pix pertence ao usuário (se fornecida)
    if (data.pixKeyId) {
      const pixKey = await prisma.businessPixKey.findFirst({
        where: {
          id: data.pixKeyId,
          userId: session.user.id,
        },
      })

      if (!pixKey) {
        return NextResponse.json(
          { error: 'Chave Pix não encontrada ou não pertence ao usuário' },
          { status: 400 }
        )
      }
    }

    const service = await prisma.service.create({
      data: {
        name: data.name,
        description: data.description || null,
        price: data.price || null,
        imageUrl: data.imageUrl || null,
        isActive: data.isActive ?? true,
        // Promoções
        hasPromotions: data.hasPromotions ?? false,
        promotions: data.promotions ? JSON.stringify(data.promotions) : null,
        pixKeyId: data.pixKeyId || null,
        userId: session.user.id,
      },
      include: {
        pixKey: {
          select: {
            id: true,
            name: true,
            pixKey: true,
            pixKeyType: true,
          },
        },
      },
    })

    log.event('service_created', {
      userId: session.user.id,
      serviceId: service.id,
      hasPromotions: service.hasPromotions,
    })

    return NextResponse.json(service, { status: 201 })
  } catch (error) {
    const handled = handleError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.statusCode })
  }
}

