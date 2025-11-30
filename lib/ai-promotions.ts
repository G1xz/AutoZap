/**
 * Integração de Promoções com a IA
 * Funções para a IA usar quando cliente pedir desconto
 */

import { getServicePromotion, formatPromotionMessage, calculatePromotionPrice } from './promotions'
import { registerProductInterest } from './promotions'
import { log } from './logger'

/**
 * Função para a IA oferecer promoção quando cliente pedir desconto
 */
export async function offerPromotionToAI(params: {
  userId: string
  instanceId: string
  contactNumber: string
  productId: string
  productName: string
  basePrice: number
  attempt: number // 1, 2 ou 3 (qual nível de promoção oferecer)
}): Promise<{
  message: string
  finalPrice: number
  pixKey?: string
  gatewayLink?: string
} | null> {
  try {
    // Registra interesse como "requested_discount"
    await registerProductInterest({
      userId: params.userId,
      instanceId: params.instanceId,
      contactNumber: params.contactNumber,
      productId: params.productId,
      productType: 'service',
      productName: params.productName,
      interestType: 'requested_discount',
    })

    // Obtém promoções do serviço
    const promotion = await getServicePromotion(params.productId)

    if (!promotion || !promotion.hasPromotions) {
      return null // Não tem promoções configuradas
    }

    // Determina qual nível oferecer baseado na tentativa
    let promoLevel: 1 | 2 | 3 = 1
    let promotionValue: number | null = null
    let promotionType: 'percent' | 'value' = 'percent'
    let gatewayLink: string | undefined

    if (params.attempt === 1 && promotion.levels.level1) {
      promoLevel = 1
      promotionValue = promotion.levels.level1.value
      promotionType = promotion.levels.level1.type
      gatewayLink = promotion.levels.level1.gatewayLink
    } else if (params.attempt === 2 && promotion.levels.level2) {
      promoLevel = 2
      promotionValue = promotion.levels.level2.value
      promotionType = promotion.levels.level2.type
      gatewayLink = promotion.levels.level2.gatewayLink
    } else if (params.attempt === 3 && promotion.levels.level3) {
      promoLevel = 3
      promotionValue = promotion.levels.level3.value
      promotionType = promotion.levels.level3.type
      gatewayLink = promotion.levels.level3.gatewayLink
    } else {
      return null // Não há promoção para esta tentativa
    }

    if (!promotionValue) {
      return null
    }

    // Busca chave Pix se configurada
    let pixKey: string | undefined
    if (promotion.pixKeyId) {
      const { prisma } = await import('./prisma')
      const pixKeyData = await prisma.businessPixKey.findUnique({
        where: { id: promotion.pixKeyId },
        select: { pixKey: true },
      })
      pixKey = pixKeyData?.pixKey
    }

    // Calcula preço final
    const finalPrice = calculatePromotionPrice(params.basePrice, promotionValue, promotionType)

    // Formata mensagem
    const message = formatPromotionMessage(
      params.productName,
      params.basePrice,
      promoLevel,
      promotionValue,
      promotionType,
      pixKey,
      gatewayLink
    )

    log.event('promotion_offered', {
      userId: params.userId,
      instanceId: params.instanceId,
      contactNumber: params.contactNumber,
      productId: params.productId,
      promoLevel,
      finalPrice,
    })

    return {
      message,
      finalPrice,
      pixKey,
      gatewayLink,
    }
  } catch (error) {
    log.error('Erro ao oferecer promoção', error, params)
    return null
  }
}

/**
 * Função helper para a IA detectar quando cliente pede desconto
 */
export function detectDiscountRequest(message: string): boolean {
  const discountKeywords = [
    'desconto',
    'promoção',
    'promocao',
    'mais barato',
    'mais barata',
    'preço menor',
    'valor menor',
    'tem desconto',
    'tem promo',
    'está caro',
    'muito caro',
    'baratear',
    'reduzir',
    'abaixar',
    'negociar',
    'negociação',
  ]

  const normalizedMessage = message.toLowerCase().trim()

  return discountKeywords.some((keyword) => normalizedMessage.includes(keyword))
}

