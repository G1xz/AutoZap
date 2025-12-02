/**
 * Gerenciamento de carrinho de compras consolidado
 * Estrutura robusta inspirada em padrões de arquitetura limpa
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

/**
 * Gera chave única do carrinho
 */
function getCartKey(instanceId: string, contactNumber: string): string {
  const normalized = normalizeContactNumber(contactNumber)
  return `${instanceId}-${normalized}`
}

// ============================================================================
// ARMAZENAMENTO EM MEMÓRIA
// ============================================================================

// Armazena carrinhos em memória
// TODO: Em produção, considerar Redis ou banco de dados para persistência
const carts = new Map<string, Cart>()

// ============================================================================
// OPERAÇÕES BÁSICAS DO CARRINHO
// ============================================================================

/**
 * Obtém ou cria carrinho para um contato
 * Sempre normaliza o número de contato internamente
 */
export function getCart(instanceId: string, contactNumber: string): Cart {
  const normalizedContact = normalizeContactNumber(contactNumber)
  const key = getCartKey(instanceId, normalizedContact)
  
  let cart = carts.get(key)
  
  if (!cart) {
    cart = {
      instanceId,
      contactNumber: normalizedContact,
      items: [],
      updatedAt: new Date(),
    }
    carts.set(key, cart)
    log.debug('Carrinho criado', { 
      instanceId, 
      contactNumber: normalizedContact, 
      key 
    })
  } else {
    log.debug('Carrinho encontrado', { 
      instanceId, 
      contactNumber: normalizedContact, 
      itemCount: cart.items.length 
    })
  }
  
  return cart
}

/**
 * Salva carrinho no armazenamento
 * Garante que a chave seja sempre normalizada
 */
function saveCart(cart: Cart): void {
  const key = getCartKey(cart.instanceId, cart.contactNumber)
  cart.updatedAt = new Date()
  carts.set(key, cart)
  log.debug('Carrinho salvo', { 
    key, 
    itemCount: cart.items.length 
  })
}

/**
 * Adiciona item ao carrinho
 * Valida dados e garante consistência
 */
export function addToCart(
  instanceId: string,
  contactNumber: string,
  item: CartItem
): Cart {
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
  const cart = getCart(instanceId, normalizedContact)
  
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
  
  // Salva carrinho atualizado
  saveCart(cart)
  
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
export function removeFromCart(
  instanceId: string,
  contactNumber: string,
  productId: string,
  productType: 'service' | 'catalog'
): Cart {
  const normalizedContact = normalizeContactNumber(contactNumber)
  const cart = getCart(instanceId, normalizedContact)
  
  const initialCount = cart.items.length
  cart.items = cart.items.filter(
    (item) => !(item.productId === productId && item.productType === productType)
  )
  
  if (cart.items.length < initialCount) {
    saveCart(cart)
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
export function updateCartItemQuantity(
  instanceId: string,
  contactNumber: string,
  productId: string,
  productType: 'service' | 'catalog',
  quantity: number
): Cart {
  if (quantity <= 0) {
    return removeFromCart(instanceId, contactNumber, productId, productType)
  }
  
  const normalizedContact = normalizeContactNumber(contactNumber)
  const cart = getCart(instanceId, normalizedContact)
  
  const item = cart.items.find(
    (i) => i.productId === productId && i.productType === productType
  )
  
  if (item) {
    item.quantity = quantity
    saveCart(cart)
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
export function clearCart(instanceId: string, contactNumber: string): void {
  const normalizedContact = normalizeContactNumber(contactNumber)
  const key = getCartKey(instanceId, normalizedContact)
  const deleted = carts.delete(key)
  
  if (deleted) {
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
  const cart = getCart(instanceId, normalizedContact)
  
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
  clearCart(instanceId, normalizedContact)
  
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
