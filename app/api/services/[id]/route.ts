import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleError, NotFoundError } from '@/lib/errors'
import { rateLimitMiddleware } from '@/lib/rate-limiter'
import { z } from 'zod'
import { log } from '@/lib/logger'

const updateServiceSchema = z.object({
  name: z.string().min(1).optional(),
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
  // Entrega e pagamento
  deliveryAvailable: z.boolean().optional(),
  pickupAvailable: z.boolean().optional(),
  paymentLink: z.string().url().nullable().optional(),
  paymentPixKeyId: z.string().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    await rateLimitMiddleware(request, 'api')

    const body = await request.json()
    const data = updateServiceSchema.parse(body)

    // Verifica se o serviço existe e pertence ao usuário
    const existing = await prisma.service.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existing) {
      throw new NotFoundError('Serviço')
    }

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

    // Verifica se a chave Pix de pagamento pertence ao usuário (se fornecida)
    if (data.paymentPixKeyId) {
      const pixKey = await prisma.businessPixKey.findFirst({
        where: {
          id: data.paymentPixKeyId,
          userId: session.user.id,
        },
      })

      if (!pixKey) {
        return NextResponse.json(
          { error: 'Chave Pix de pagamento não encontrada ou não pertence ao usuário' },
          { status: 400 }
        )
      }
    }

    const updated = await prisma.service.update({
      where: { id: params.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        // Promoções
        ...(data.hasPromotions !== undefined && { hasPromotions: data.hasPromotions }),
        ...(data.promotions !== undefined && { promotions: data.promotions ? JSON.stringify(data.promotions) : null }),
        ...(data.pixKeyId !== undefined && { pixKeyId: data.pixKeyId }),
        // Entrega e pagamento
        ...(data.deliveryAvailable !== undefined && { deliveryAvailable: data.deliveryAvailable }),
        ...(data.pickupAvailable !== undefined && { pickupAvailable: data.pickupAvailable }),
        ...(data.paymentLink !== undefined && { paymentLink: data.paymentLink }),
        ...(data.paymentPixKeyId !== undefined && { paymentPixKeyId: data.paymentPixKeyId }),
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

    log.event('service_updated', {
      userId: session.user.id,
      serviceId: updated.id,
    })

    // Parse promotions JSON
    const updatedWithParsedPromotions = {
      ...updated,
      promotions: updated.promotions ? JSON.parse(updated.promotions) : null,
    }

    return NextResponse.json(updatedWithParsedPromotions)
  } catch (error) {
    const handled = handleError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.statusCode })
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

    await rateLimitMiddleware(request, 'api')

    const service = await prisma.service.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!service) {
      throw new NotFoundError('Serviço')
    }

    await prisma.service.delete({
      where: { id: params.id },
    })

    log.event('service_deleted', {
      userId: session.user.id,
      serviceId: params.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const handled = handleError(error)
    return NextResponse.json({ error: handled.message }, { status: handled.statusCode })
  }
}

