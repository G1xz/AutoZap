/**
 * Sistema de Promoções e Descontos
 * Gerencia promoções de produtos/serviços e integração com pagamentos
 */

import { prisma } from './prisma'
import { log } from './logger'

export interface PromotionLevel {
  value: number // Valor do desconto
  type: 'percent' | 'value' // Tipo: porcentagem ou valor fixo
  gatewayLink?: string // Link do gateway (se houver)
}

export interface ProductPromotion {
  hasPromotions: boolean
  levels: {
    level1?: PromotionLevel
    level2?: PromotionLevel
    level3?: PromotionLevel
  }
  pixKeyId?: string
}

/**
 * Calcula o preço final com desconto
 */
export function calculatePromotionPrice(
  basePrice: number,
  promotionValue: number,
  promotionType: 'percent' | 'value'
): number {
  if (promotionType === 'percent') {
    const discount = (basePrice * promotionValue) / 100
    return Math.max(0, basePrice - discount)
  } else {
    return Math.max(0, basePrice - promotionValue)
  }
}

/**
 * Formata mensagem de promoção para a IA
 */
export function formatPromotionMessage(
  productName: string,
  basePrice: number,
  promoLevel: number,
  promotionValue: number,
  promotionType: 'percent' | 'value',
  pixKey?: string,
  gatewayLink?: string
): string {
  const finalPrice = calculatePromotionPrice(basePrice, promotionValue, promotionType)
  const discountText =
    promotionType === 'percent'
      ? `${promotionValue}% de desconto`
      : `R$ ${promotionValue.toFixed(2)} de desconto`

  let message = `🎉 *Promoção Especial - ${productName}*\n\n`
  message += `💰 Preço original: R$ ${basePrice.toFixed(2)}\n`
  message += `🎁 ${discountText}\n`
  message += `✅ *Preço final: R$ ${finalPrice.toFixed(2)}*\n\n`

  if (pixKey) {
    message += `💳 *Forma de Pagamento PIX:*\n`
    message += `Chave: ${pixKey}\n`
    message += `Valor: R$ ${finalPrice.toFixed(2)}\n\n`
  }

  if (gatewayLink) {
    message += `🔗 *Ou compre pelo link:*\n`
    message += `${gatewayLink}\n\n`
  }

  message += `⚡ Esta é uma oportunidade limitada!`

  return message
}

/**
 * Obtém informações de promoção de um serviço
 */
export async function getServicePromotion(serviceId: string): Promise<ProductPromotion | null> {
  try {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
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

    if (!service || !service.hasPromotions || !service.promotions) {
      return null
    }

    // Parse do JSON array de promoções
    let promotionsArray: Array<{ value: number; type: 'percent' | 'value'; gatewayLink?: string }> = []
    try {
      promotionsArray = JSON.parse(service.promotions)
    } catch (error) {
      log.error('Erro ao parsear promoções', error, { serviceId })
      return null
    }

    if (!Array.isArray(promotionsArray) || promotionsArray.length === 0) {
      return null
    }

    // Converte array dinâmico para formato de levels (1-indexed)
    const levels: ProductPromotion['levels'] = {}
    promotionsArray.forEach((promo, index) => {
      const levelNumber = (index + 1) as 1 | 2 | 3
      if (levelNumber <= 3) {
        levels[`level${levelNumber}` as keyof typeof levels] = {
          value: promo.value,
          type: promo.type,
          gatewayLink: promo.gatewayLink,
        }
      }
    })

    return {
      hasPromotions: true,
      levels,
      pixKeyId: service.pixKeyId || undefined,
    }
  } catch (error) {
    log.error('Erro ao obter promoção do serviço', error, { serviceId })
    return null
  }
}

/**
 * Registra interesse do cliente em um produto
 */
export async function registerProductInterest(params: {
  userId: string
  instanceId: string
  contactNumber: string
  productId: string
  productType: 'service' | 'catalog'
  productName: string
  interestType: 'viewed' | 'asked_info' | 'requested_discount'
}): Promise<void> {
  try {
    const normalizedContact = params.contactNumber.replace(/\D/g, '')

    // Quando productType é 'catalog', o productId é um CatalogNode.id, não um Service.id
    // A foreign key constraint com Service falha, então usamos uma abordagem diferente
    if (params.productType === 'catalog') {
      // Gera um ID compatível com CUID usado pelo Prisma
      const generateCuid = () => {
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 15)
        return `c${timestamp}${random}`
      }

      // Para catalog, usamos SQL direto para evitar a foreign key constraint
      // Verifica se já existe antes de inserir
      const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT id FROM "ProductInterest"
        WHERE "instanceId" = $1 
          AND "contactNumber" = $2 
          AND "productId" = $3 
          AND "productType" = $4
        LIMIT 1
      `, params.instanceId, normalizedContact, params.productId, params.productType)

      if (existing && existing.length > 0) {
        // Atualiza registro existente
        await prisma.$executeRawUnsafe(`
          UPDATE "ProductInterest"
          SET "interestType" = $1,
              "lastInteraction" = NOW(),
              "status" = $2,
              "updatedAt" = NOW()
          WHERE "instanceId" = $3 
            AND "contactNumber" = $4 
            AND "productId" = $5 
            AND "productType" = $6
        `, params.interestType, 'pending', params.instanceId, normalizedContact, params.productId, params.productType)
      } else {
        // Insere novo registro
        await prisma.$executeRawUnsafe(
          `
          INSERT INTO "ProductInterest" (
            "id", "userId", "instanceId", "contactNumber", "productId", "productType", 
            "productName", "interestType", "status", "lastInteraction", "createdAt", "updatedAt"
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW()
          )
          `,
          generateCuid(),
          params.userId,
          params.instanceId,
          normalizedContact,
          params.productId,
          params.productType,
          params.productName,
          params.interestType,
          'pending'
        )
      }
    } else {
      // Para service, usamos o método normal do Prisma (com foreign key)
      await prisma.productInterest.upsert({
        where: {
          instanceId_contactNumber_productId_productType: {
            instanceId: params.instanceId,
            contactNumber: normalizedContact,
            productId: params.productId,
            productType: params.productType,
          },
        },
        update: {
          interestType: params.interestType,
          lastInteraction: new Date(),
          status: 'pending', // Reset para pending se ainda não converteu
        },
        create: {
          userId: params.userId,
          instanceId: params.instanceId,
          contactNumber: normalizedContact,
          productId: params.productId,
          productType: params.productType,
          productName: params.productName,
          interestType: params.interestType,
          status: 'pending',
        },
      })
    }

    log.event('product_interest_registered', {
      userId: params.userId,
      instanceId: params.instanceId,
      contactNumber: normalizedContact,
      productId: params.productId,
      productType: params.productType,
      interestType: params.interestType,
    })
  } catch (error) {
    log.error('Erro ao registrar interesse do produto', error, params)
  }
}

/**
 * Marca interesse como convertido (comprou)
 */
export async function markInterestAsConverted(params: {
  instanceId: string
  contactNumber: string
  productId: string
  productType: 'service' | 'catalog'
}): Promise<void> {
  try {
    const normalizedContact = params.contactNumber.replace(/\D/g, '')

    await prisma.productInterest.updateMany({
      where: {
        instanceId: params.instanceId,
        contactNumber: normalizedContact,
        productId: params.productId,
        productType: params.productType,
        status: 'pending',
      },
      data: {
        status: 'converted',
        convertedAt: new Date(),
      },
    })

    log.event('product_interest_converted', {
      instanceId: params.instanceId,
      contactNumber: normalizedContact,
      productId: params.productId,
    })
  } catch (error) {
    log.error('Erro ao marcar interesse como convertido', error, params)
  }
}

