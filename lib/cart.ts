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
  
  // Busca TODOS os carrinhos desta instância para debug
  const allCarts = await prisma.cart.findMany({
    where: { instanceId },
  })
  console.log(`🛒 [getCart] Total de carrinhos para esta instância: ${allCarts.length}`)
  allCarts.forEach((c, i) => {
    console.log(`   [${i + 1}] contactNumber: "${c.contactNumber}", Itens: ${c.items}, ID: ${c.id}`)
  })
  
  // Busca carrinho no banco
  let cartRecord = await prisma.cart.findUnique({
    where: {
      instanceId_contactNumber: {
        instanceId,
        contactNumber: normalizedContact,
      },
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
        items: JSON.stringify([]),
      },
    })
    console.log(`🛒 [getCart] ✅ Carrinho criado no banco: ID=${cartRecord.id}`)
    log.debug('Carrinho criado no banco', { 
      instanceId, 
      contactNumber: normalizedContact,
      cartId: cartRecord.id,
    })
  } else {
    console.log(`🛒 [getCart] ✅ Carrinho encontrado no banco: ID=${cartRecord.id}`)
    log.debug('Carrinho encontrado no banco', { 
      instanceId, 
      contactNumber: normalizedContact,
      cartId: cartRecord.id,
    })
  }
  
  // Parse dos itens do JSON
  let items: CartItem[] = []
  try {
    items = JSON.parse(cartRecord.items) as CartItem[]
    console.log(`🛒 [getCart] Itens parseados: ${items.length} itens`)
    items.forEach((item, i) => {
      console.log(`   [${i + 1}] ${item.productName} x${item.quantity} - R$ ${item.unitPrice}`)
    })
  } catch (error) {
    console.error(`🛒 [getCart] ❌ Erro ao fazer parse dos itens:`, error)
    log.error('Erro ao fazer parse dos itens do carrinho', { cartId: cartRecord.id, error })
    items = []
  }
  
  return {
    instanceId: cartRecord.instanceId,
    contactNumber: cartRecord.contactNumber,
    items,
    updatedAt: cartRecord.updatedAt,
  }
}

/**
 * Salva carrinho no banco de dados
 */
async function saveCart(cart: Cart, userId: string): Promise<void> {
  const itemsJson = JSON.stringify(cart.items)
  
  console.log(`🛒 [saveCart] ========== SALVANDO CARRINHO ==========`)
  console.log(`   instanceId: ${cart.instanceId}`)
  console.log(`   contactNumber: "${cart.contactNumber}"`)
  console.log(`   itemCount: ${cart.items.length}`)
  console.log(`   itemsJson: ${itemsJson.substring(0, 200)}...`)
  
  const result = await prisma.cart.upsert({
    where: {
      instanceId_contactNumber: {
        instanceId: cart.instanceId,
        contactNumber: cart.contactNumber,
      },
    },
    update: {
      items: itemsJson,
      updatedAt: new Date(),
    },
    create: {
      userId,
      instanceId: cart.instanceId,
      contactNumber: cart.contactNumber,
      items: itemsJson,
    },
  })
  
  console.log(`🛒 [saveCart] ✅ Carrinho salvo: ID=${result.id}, Itens=${cart.items.length}`)
  
  // Verifica se foi salvo corretamente
  const verify = await prisma.cart.findUnique({
    where: { id: result.id },
  })
  if (verify) {
    const verifyItems = JSON.parse(verify.items) as CartItem[]
    console.log(`🛒 [saveCart] ✅ Verificação: ${verifyItems.length} itens no banco`)
  }
  
  log.debug('Carrinho salvo no banco', { 
    instanceId: cart.instanceId,
    contactNumber: cart.contactNumber,
    itemCount: cart.items.length,
    cartId: result.id,
  })
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
  // Validação de entrada
  if (!item.productId || !item.productName) {
    throw new Error('ID e nome do produto são obrigatórios')
  }
  
  if (item.quantity <= 0) {
    throw new Error('Quantidade deve ser maior que zero')
  }
  
  if (item.unitPrice < 0) {
    throw new Error('Preço unitário não pode ser negativo')
  }

  // Normaliza número e obtém carrinho
  const normalizedContact = normalizeContactNumber(contactNumber)
  const cart = await getCart(instanceId, normalizedContact)
  
  // Busca userId da instância
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId },
    select: { userId: true },
  })
  
  if (!instance) {
    throw new Error(`Instância ${instanceId} não encontrada`)
  }
  
  // Verifica se o produto já está no carrinho
  const existingIndex = cart.items.findIndex(
    (i) => i.productId === item.productId && i.productType === item.productType
  )
  
  if (existingIndex >= 0) {
    // Atualiza quantidade do item existente
    cart.items[existingIndex].quantity += item.quantity
    if (item.notes) {
      cart.items[existingIndex].notes = item.notes
    }
    log.debug('Item atualizado no carrinho', {
      productId: item.productId,
      newQuantity: cart.items[existingIndex].quantity,
    })
  } else {
    // Adiciona novo item
    cart.items.push(item)
    log.debug('Novo item adicionado ao carrinho', {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
    })
  }
  
  // Salva carrinho atualizado no banco
  await saveCart(cart, instance.userId)
  
  log.debug('Item adicionado ao carrinho', {
    instanceId,
    contactNumber: normalizedContact,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    totalItems: cart.items.length,
  })
  
  return cart
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
  const cart = await getCart(instanceId, normalizedContact)
  
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId },
    select: { userId: true },
  })
  
  if (!instance) {
    throw new Error(`Instância ${instanceId} não encontrada`)
  }
  
  const initialCount = cart.items.length
  cart.items = cart.items.filter(
    (item) => !(item.productId === productId && item.productType === productType)
  )
  
  if (cart.items.length < initialCount) {
    await saveCart(cart, instance.userId)
    log.debug('Item removido do carrinho', {
      productId,
      productType,
      remainingItems: cart.items.length,
    })
  }
  
  return cart
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
  const cart = await getCart(instanceId, normalizedContact)
  
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId },
    select: { userId: true },
  })
  
  if (!instance) {
    throw new Error(`Instância ${instanceId} não encontrada`)
  }
  
  const item = cart.items.find(
    (i) => i.productId === productId && i.productType === productType
  )
  
  if (item) {
    item.quantity = quantity
    await saveCart(cart, instance.userId)
    log.debug('Quantidade atualizada', {
      productId,
      newQuantity: quantity,
    })
  }
  
  return cart
}

/**
 * Limpa o carrinho completamente
 */
export async function clearCart(instanceId: string, contactNumber: string): Promise<void> {
  const normalizedContact = normalizeContactNumber(contactNumber)
  
  const deleted = await prisma.cart.deleteMany({
    where: {
      instanceId,
      contactNumber: normalizedContact,
    },
  })
  
  if (deleted.count > 0) {
    log.debug('Carrinho limpo', { instanceId, contactNumber: normalizedContact })
  }
}

/**
 * Calcula total do carrinho
 */
export function getCartTotal(cart: Cart): number {
  return cart.items.reduce(
    (total, item) => total + (item.quantity * item.unitPrice), 
    0
  )
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
  } catch (error) {
    log.error('Erro ao criar pedido no banco de dados', {
      userId,
      instanceId,
      contactNumber: normalizedContact,
      error,
    })
    throw new Error('Erro ao criar pedido. Tente novamente.')
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
