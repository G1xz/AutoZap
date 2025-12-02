/**
 * Gerenciamento de carrinho de compras consolidado
 * Persistido no banco de dados para garantir que não seja perdido entre requisições
 * 
 * IMPORTANTE: Todas as funções normalizam o número de contato internamente
 * para garantir consistência na chave do carrinho
 */

import { prisma } from './prisma'
import { log } from './logger'

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface CartItem {
  productId: string
  productType: 'service' | 'catalog'
  productName: string
  quantity: number
  unitPrice: number
  notes?: string
}

export interface Cart {
  instanceId: string
  contactNumber: string // Sempre normalizado
  items: CartItem[]
  updatedAt: Date
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Normaliza número de contato removendo caracteres não numéricos
 * Garante consistência em todas as operações
 */
function normalizeContactNumber(contactNumber: string): string {
  return contactNumber.replace(/\D/g, '')
}

// ============================================================================
// OPERAÇÕES BÁSICAS DO CARRINHO (PERSISTIDAS NO BANCO)
// ============================================================================

/**
 * Obtém ou cria carrinho para um contato
 * Busca do banco de dados para garantir persistência
 */
export async function getCart(instanceId: string, contactNumber: string): Promise<Cart> {
  const normalizedContact = normalizeContactNumber(contactNumber)
  
  // Log detalhado para debug
  console.log(`🛒 [getCart] ========== BUSCANDO CARRINHO ==========`)
  console.log(`   instanceId: ${instanceId}`)
  console.log(`   contactNumber original: "${contactNumber}"`)
  console.log(`   contactNumber normalizado: "${normalizedContact}"`)
  
  // Busca instância para obter userId
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId },
    select: { userId: true },
  })
  
  if (!instance) {
    throw new Error(`Instância ${instanceId} não encontrada`)
  }
  
  // Busca carrinho no banco com itens relacionados
  let cartRecord = await prisma.cart.findUnique({
    where: {
      instanceId_contactNumber: {
        instanceId,
        contactNumber: normalizedContact,
      },
    },
    include: {
      items: true,
    },
  })
  
  if (!cartRecord) {
    console.log(`🛒 [getCart] Carrinho NÃO encontrado, criando novo...`)
    // Cria novo carrinho
    cartRecord = await prisma.cart.create({
      data: {
        userId: instance.userId,
        instanceId,
        contactNumber: normalizedContact,
      },
      include: {
        items: true,
      },
    })
    console.log(`🛒 [getCart] ✅ Carrinho criado no banco: ID=${cartRecord.id}`)
    log.debug('Carrinho criado no banco', { 
      instanceId, 
      contactNumber: normalizedContact,
      cartId: cartRecord.id,
    })
  } else {
    console.log(`🛒 [getCart] ✅ Carrinho encontrado no banco: ID=${cartRecord.id}, Itens: ${cartRecord.items.length}`)
    log.debug('Carrinho encontrado no banco', { 
      instanceId, 
      contactNumber: normalizedContact,
      cartId: cartRecord.id,
      itemCount: cartRecord.items.length,
    })
  }
  
  // Converte itens do banco para formato da interface
  const items: CartItem[] = cartRecord.items.map(item => ({
    productId: item.productId,
    productType: item.productType as 'service' | 'catalog',
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    notes: item.notes || undefined,
  }))
  
  console.log(`🛒 [getCart] Itens carregados: ${items.length} itens`)
  items.forEach((item, i) => {
    console.log(`   [${i + 1}] ${item.productName} x${item.quantity} - R$ ${item.unitPrice}`)
  })
  
  return {
    instanceId: cartRecord.instanceId,
    contactNumber: cartRecord.contactNumber,
    items,
    updatedAt: cartRecord.updatedAt,
  }
}


/**
 * Adiciona item ao carrinho
 * Valida dados e garante consistência
 */
export async function addToCart(
  instanceId: string,
  contactNumber: string,
  item: CartItem
): Promise<Cart> {
  // Validação de entrada robusta
  if (!item) {
    throw new Error('Item do carrinho é obrigatório')
  }
  
  if (!item.productId || typeof item.productId !== 'string' || item.productId.trim().length === 0) {
    throw new Error('ID do produto é obrigatório e deve ser uma string válida')
  }
  
  if (!item.productName || typeof item.productName !== 'string' || item.productName.trim().length === 0) {
    throw new Error('Nome do produto é obrigatório e deve ser uma string válida')
  }
  
  if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
    throw new Error('Quantidade deve ser um número inteiro maior que zero')
  }
  
  if (typeof item.unitPrice !== 'number' || item.unitPrice < 0 || isNaN(item.unitPrice)) {
    throw new Error('Preço unitário deve ser um número válido maior ou igual a zero')
  }
  
  if (item.productType !== 'service' && item.productType !== 'catalog') {
    throw new Error('Tipo do produto deve ser "service" ou "catalog"')
  }
  
  // Valida limites razoáveis
  if (item.quantity > 1000) {
    throw new Error('Quantidade máxima permitida é 1000 unidades')
  }
  
  if (item.unitPrice > 1000000) {
    throw new Error('Preço unitário máximo permitido é R$ 1.000.000,00')
  }

  // Normaliza número
  const normalizedContact = normalizeContactNumber(contactNumber)
  
  // Busca userId da instância
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId },
    select: { userId: true },
  })
  
  if (!instance) {
    throw new Error(`Instância ${instanceId} não encontrada`)
  }
  
  // Busca ou cria carrinho
  let cartRecord = await prisma.cart.findUnique({
    where: {
      instanceId_contactNumber: {
        instanceId,
        contactNumber: normalizedContact,
      },
    },
  })
  
  if (!cartRecord) {
    cartRecord = await prisma.cart.create({
      data: {
        userId: instance.userId,
        instanceId,
        contactNumber: normalizedContact,
      },
    })
    console.log(`🛒 [addToCart] ✅ Carrinho criado: ID=${cartRecord.id}`)
  }
  
  // Usa upsert para adicionar ou atualizar item
  // O unique constraint garante que não haverá duplicatas
  const existingItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productId_productType: {
        cartId: cartRecord.id,
        productId: item.productId,
        productType: item.productType,
      },
    },
  })
  
  if (existingItem) {
    // Atualiza quantidade do item existente
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: existingItem.quantity + item.quantity,
        notes: item.notes || existingItem.notes,
      },
    })
    console.log(`🛒 [addToCart] ✅ Item atualizado: ${item.productName} (quantidade: ${existingItem.quantity + item.quantity})`)
    log.debug('Item atualizado no carrinho', {
      productId: item.productId,
      newQuantity: existingItem.quantity + item.quantity,
    })
  } else {
    // Adiciona novo item
    await prisma.cartItem.create({
      data: {
        cartId: cartRecord.id,
        productId: item.productId,
        productType: item.productType,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: item.notes,
      },
    })
    console.log(`🛒 [addToCart] ✅ Item adicionado: ${item.productName} x${item.quantity}`)
    log.debug('Novo item adicionado ao carrinho', {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
    })
  }
  
  // Atualiza updatedAt do carrinho
  await prisma.cart.update({
    where: { id: cartRecord.id },
    data: { updatedAt: new Date() },
  })
  
  // Retorna carrinho atualizado
  return getCart(instanceId, normalizedContact)
}

/**
 * Remove item do carrinho
 */
export async function removeFromCart(
  instanceId: string,
  contactNumber: string,
  productId: string,
  productType: 'service' | 'catalog'
): Promise<Cart> {
  const normalizedContact = normalizeContactNumber(contactNumber)
  
  // Busca carrinho
  const cartRecord = await prisma.cart.findUnique({
    where: {
      instanceId_contactNumber: {
        instanceId,
        contactNumber: normalizedContact,
      },
    },
  })
  
  if (!cartRecord) {
    // Carrinho não existe, retorna vazio
    return {
      instanceId,
      contactNumber: normalizedContact,
      items: [],
      updatedAt: new Date(),
    }
  }
  
  // Remove item usando unique constraint
  try {
    await prisma.cartItem.delete({
      where: {
        cartId_productId_productType: {
          cartId: cartRecord.id,
          productId,
          productType,
        },
      },
    })
    
    // Atualiza updatedAt do carrinho
    await prisma.cart.update({
      where: { id: cartRecord.id },
      data: { updatedAt: new Date() },
    })
    
    console.log(`🛒 [removeFromCart] ✅ Item removido: ${productId} (${productType})`)
    log.debug('Item removido do carrinho', {
      productId,
      productType,
    })
  } catch (error: any) {
    // Se não encontrou o item, não é erro crítico
    if (error.code !== 'P2025') {
      throw error
    }
    console.log(`🛒 [removeFromCart] ⚠️ Item não encontrado no carrinho: ${productId}`)
  }
  
  // Retorna carrinho atualizado
  return getCart(instanceId, normalizedContact)
}

/**
 * Atualiza quantidade de um item no carrinho
 */
export async function updateCartItemQuantity(
  instanceId: string,
  contactNumber: string,
  productId: string,
  productType: 'service' | 'catalog',
  quantity: number
): Promise<Cart> {
  if (quantity <= 0) {
    return removeFromCart(instanceId, contactNumber, productId, productType)
  }
  
  const normalizedContact = normalizeContactNumber(contactNumber)
  
  // Busca carrinho
  const cartRecord = await prisma.cart.findUnique({
    where: {
      instanceId_contactNumber: {
        instanceId,
        contactNumber: normalizedContact,
      },
    },
  })
  
  if (!cartRecord) {
    throw new Error('Carrinho não encontrado')
  }
  
  // Atualiza quantidade do item
  try {
    await prisma.cartItem.update({
      where: {
        cartId_productId_productType: {
          cartId: cartRecord.id,
          productId,
          productType,
        },
      },
      data: {
        quantity,
      },
    })
    
    // Atualiza updatedAt do carrinho
    await prisma.cart.update({
      where: { id: cartRecord.id },
      data: { updatedAt: new Date() },
    })
    
    console.log(`🛒 [updateCartItemQuantity] ✅ Quantidade atualizada: ${productId} → ${quantity}`)
    log.debug('Quantidade atualizada', {
      productId,
      newQuantity: quantity,
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new Error('Item não encontrado no carrinho')
    }
    throw error
  }
  
  // Retorna carrinho atualizado
  return getCart(instanceId, normalizedContact)
}

/**
 * Limpa o carrinho completamente
 */
export async function clearCart(instanceId: string, contactNumber: string): Promise<void> {
  const normalizedContact = normalizeContactNumber(contactNumber)
  
  // Busca carrinho
  const cartRecord = await prisma.cart.findUnique({
    where: {
      instanceId_contactNumber: {
        instanceId,
        contactNumber: normalizedContact,
      },
    },
  })
  
  if (cartRecord) {
    // Remove todos os itens (cascade vai remover automaticamente, mas vamos fazer explicitamente)
    await prisma.cartItem.deleteMany({
      where: { cartId: cartRecord.id },
    })
    
    // Remove o carrinho
    await prisma.cart.delete({
      where: { id: cartRecord.id },
    })
    
    console.log(`🛒 [clearCart] ✅ Carrinho limpo: ID=${cartRecord.id}`)
    log.debug('Carrinho limpo', { instanceId, contactNumber: normalizedContact })
  }
}

/**
 * Calcula total do carrinho
 */
export function getCartTotal(cart: Cart): number {
  if (!cart || !Array.isArray(cart.items)) {
    return 0
  }
  
  return cart.items.reduce(
    (total, item) => {
      const itemTotal = (item.quantity || 0) * (item.unitPrice || 0)
      // Valida que o cálculo não resultou em NaN ou Infinity
      if (isNaN(itemTotal) || !isFinite(itemTotal)) {
        console.warn(`🛒 [getCartTotal] ⚠️ Item com cálculo inválido:`, item)
        return total
      }
      return total + itemTotal
    }, 
    0
  )
}

/**
 * Valida e limpa carrinho, removendo itens inválidos
 */
export function validateAndCleanCart(cart: Cart): Cart {
  if (!cart || !Array.isArray(cart.items)) {
    return {
      instanceId: cart?.instanceId || '',
      contactNumber: cart?.contactNumber || '',
      items: [],
      updatedAt: cart?.updatedAt || new Date(),
    }
  }
  
  const validItems = cart.items.filter(item => {
    const isValid = 
      item &&
      typeof item === 'object' &&
      typeof item.productId === 'string' &&
      item.productId.trim().length > 0 &&
      typeof item.productName === 'string' &&
      item.productName.trim().length > 0 &&
      typeof item.quantity === 'number' &&
      item.quantity > 0 &&
      item.quantity <= 1000 &&
      Number.isInteger(item.quantity) &&
      typeof item.unitPrice === 'number' &&
      item.unitPrice >= 0 &&
      item.unitPrice <= 1000000 &&
      isFinite(item.unitPrice) &&
      (item.productType === 'service' || item.productType === 'catalog')
    
    if (!isValid) {
      console.warn(`🛒 [validateAndCleanCart] ⚠️ Item inválido removido:`, item)
    }
    
    return isValid
  })
  
  if (validItems.length !== cart.items.length) {
    console.warn(`🛒 [validateAndCleanCart] ⚠️ ${cart.items.length - validItems.length} itens inválidos removidos`)
  }
  
  return {
    ...cart,
    items: validItems,
  }
}

// ============================================================================
// OPERAÇÕES AVANÇADAS
// ============================================================================

/**
 * Cria pedido a partir do carrinho
 * Valida carrinho, processa pagamento e cria ordem no banco
 */
export async function createOrderFromCart(
  userId: string,
  instanceId: string,
  contactNumber: string,
  contactName: string | undefined,
  deliveryType: 'pickup' | 'delivery',
  deliveryAddress?: string,
  notes?: string
): Promise<{ orderId: string; paymentLink?: string; paymentPixKey?: string }> {
  // Normaliza número e obtém carrinho
  const normalizedContact = normalizeContactNumber(contactNumber)
  const cart = await getCart(instanceId, normalizedContact)
  
  // Validação
  if (cart.items.length === 0) {
    throw new Error('Carrinho vazio. Adicione produtos antes de finalizar o pedido.')
  }
  
  // Valida endereço se for entrega
  if (deliveryType === 'delivery' && !deliveryAddress?.trim()) {
    throw new Error('Endereço de entrega é obrigatório para entregas.')
  }
  
  const totalAmount = getCartTotal(cart)
  
  // Determina método de pagamento baseado nos produtos
  let paymentLink: string | undefined
  let paymentPixKey: string | undefined
  let paymentMethod: string | undefined
  
  // Busca informações de pagamento do primeiro produto que tiver
  for (const item of cart.items) {
    if (item.productType === 'service') {
      try {
        const service = await prisma.service.findUnique({
          where: { id: item.productId },
          include: {
            paymentPixKey: true,
          },
        })
        
        if (service) {
          if (service.paymentLink) {
            paymentLink = service.paymentLink
            paymentMethod = 'gateway'
            break
          } else if (service.paymentPixKey) {
            paymentPixKey = service.paymentPixKey.pixKey
            paymentMethod = 'pix'
            break
          }
        }
      } catch (error) {
        log.error('Erro ao buscar informações de pagamento do serviço', {
          productId: item.productId,
          error,
        })
      }
    }
  }
  
  // Se não encontrou método de pagamento, usa cash
  if (!paymentMethod) {
    paymentMethod = 'cash'
  }
  
  // Cria o pedido no banco
  let order
  try {
    console.log(`🛒 [createOrderFromCart] ========== CRIANDO PEDIDO ==========`)
    console.log(`   userId: ${userId}`)
    console.log(`   instanceId: ${instanceId}`)
    console.log(`   contactNumber: ${normalizedContact}`)
    console.log(`   itemCount: ${cart.items.length}`)
    console.log(`   totalAmount: ${totalAmount}`)
    console.log(`   deliveryType: ${deliveryType}`)
    
    cart.items.forEach((item, i) => {
      console.log(`   Item ${i + 1}: ${item.productName} x${item.quantity} @ R$ ${item.unitPrice}`)
    })
    
    order = await prisma.order.create({
      data: {
        userId,
        instanceId,
        contactNumber: normalizedContact,
        contactName,
        deliveryType,
        deliveryAddress: deliveryType === 'delivery' ? deliveryAddress : null,
        status: 'pending',
        totalAmount,
        paymentMethod,
        paymentLink,
        paymentPixKey,
        notes,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            productType: item.productType,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: true,
      },
    })
    
    console.log(`🛒 [createOrderFromCart] ✅ Pedido criado no banco:`, {
      orderId: order.id,
      itemCount: order.items.length,
      totalAmount: order.totalAmount,
    })
  } catch (error) {
    console.error(`🛒 [createOrderFromCart] ❌ Erro ao criar pedido:`, error)
    log.error('Erro ao criar pedido no banco de dados', {
      userId,
      instanceId,
      contactNumber: normalizedContact,
      error,
    })
    throw new Error(`Erro ao criar pedido: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
  
  // Limpa o carrinho após criar o pedido com sucesso
  await clearCart(instanceId, normalizedContact)
  
  // Marca produtos como convertidos (não bloqueia se falhar)
  for (const item of cart.items) {
    try {
      const { markInterestAsConverted } = await import('./promotions')
      await markInterestAsConverted({
        instanceId,
        contactNumber: normalizedContact,
        productId: item.productId,
        productType: item.productType,
      })
    } catch (error) {
      log.error('Erro ao marcar interesse como convertido', {
        productId: item.productId,
        error,
      })
      // Não lança erro, apenas loga
    }
  }
  
  log.event('order_created', {
    orderId: order.id,
    userId,
    instanceId,
    contactNumber: normalizedContact,
    itemCount: cart.items.length,
    totalAmount,
    paymentMethod,
  })
  
  return {
    orderId: order.id,
    paymentLink,
    paymentPixKey,
  }
}
