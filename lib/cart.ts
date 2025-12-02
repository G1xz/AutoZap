/**
 * Gerenciamento de carrinho de compras
 * Permite adicionar múltiplos produtos antes de finalizar o pedido
 */

import { prisma } from './prisma'
import { log } from './logger'

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
  contactNumber: string
  items: CartItem[]
  updatedAt: Date
}

// Armazena carrinhos em memória (em produção, usar Redis ou banco)
const carts = new Map<string, Cart>()

/**
 * Obtém ou cria carrinho para um contato
 */
export function getCart(instanceId: string, contactNumber: string): Cart {
  const normalizedContact = contactNumber.replace(/\D/g, '')
  const key = `${instanceId}-${normalizedContact}`
  
  let cart = carts.get(key)
  
  if (!cart) {
    cart = {
      instanceId,
      contactNumber: normalizedContact,
      items: [],
      updatedAt: new Date(),
    }
    carts.set(key, cart)
  }
  
  return cart
}

/**
 * Adiciona item ao carrinho
 */
export function addToCart(
  instanceId: string,
  contactNumber: string,
  item: CartItem
): Cart {
  const cart = getCart(instanceId, contactNumber)
  
  // Verifica se o produto já está no carrinho
  const existingIndex = cart.items.findIndex(
    (i) => i.productId === item.productId && i.productType === item.productType
  )
  
  if (existingIndex >= 0) {
    // Atualiza quantidade
    cart.items[existingIndex].quantity += item.quantity
    if (item.notes) {
      cart.items[existingIndex].notes = item.notes
    }
  } else {
    // Adiciona novo item
    cart.items.push(item)
  }
  
  cart.updatedAt = new Date()
  carts.set(`${instanceId}-${contactNumber.replace(/\D/g, '')}`, cart)
  
  log.debug('Item adicionado ao carrinho', {
    instanceId,
    contactNumber,
    productId: item.productId,
    quantity: item.quantity,
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
  const cart = getCart(instanceId, contactNumber)
  
  cart.items = cart.items.filter(
    (item) => !(item.productId === productId && item.productType === productType)
  )
  
  cart.updatedAt = new Date()
  carts.set(`${instanceId}-${contactNumber.replace(/\D/g, '')}`, cart)
  
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
  const cart = getCart(instanceId, contactNumber)
  
  const item = cart.items.find(
    (i) => i.productId === productId && i.productType === productType
  )
  
  if (item) {
    if (quantity <= 0) {
      return removeFromCart(instanceId, contactNumber, productId, productType)
    }
    item.quantity = quantity
    cart.updatedAt = new Date()
    carts.set(`${instanceId}-${contactNumber.replace(/\D/g, '')}`, cart)
  }
  
  return cart
}

/**
 * Limpa o carrinho
 */
export function clearCart(instanceId: string, contactNumber: string): void {
  const key = `${instanceId}-${contactNumber.replace(/\D/g, '')}`
  carts.delete(key)
}

/**
 * Calcula total do carrinho
 */
export function getCartTotal(cart: Cart): number {
  return cart.items.reduce((total, item) => total + (item.quantity * item.unitPrice), 0)
}

/**
 * Cria pedido a partir do carrinho
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
  const cart = getCart(instanceId, contactNumber)
  
  if (cart.items.length === 0) {
    throw new Error('Carrinho vazio')
  }
  
  const normalizedContact = contactNumber.replace(/\D/g, '')
  const totalAmount = getCartTotal(cart)
  
  // Determina método de pagamento baseado nos produtos
  let paymentLink: string | undefined
  let paymentPixKey: string | undefined
  let paymentMethod: string | undefined
  
  // Busca informações de pagamento do primeiro produto que tiver
  for (const item of cart.items) {
    if (item.productType === 'service') {
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
    }
  }
  
  // Se não encontrou método de pagamento, usa cash
  if (!paymentMethod) {
    paymentMethod = 'cash'
  }
  
  // Cria o pedido no banco
  const order = await prisma.order.create({
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
  
  // Limpa o carrinho após criar o pedido
  clearCart(instanceId, contactNumber)
  
  // Marca produtos como convertidos
  for (const item of cart.items) {
    try {
      const { markInterestAsConverted } = await import('./promotions')
      await markInterestAsConverted({
        instanceId,
        contactNumber,
        productId: item.productId,
        productType: item.productType,
      })
    } catch (error) {
      log.error('Erro ao marcar interesse como convertido', error)
    }
  }
  
  log.event('order_created', {
    orderId: order.id,
    userId,
    instanceId,
    contactNumber: normalizedContact,
    itemCount: cart.items.length,
    totalAmount,
  })
  
  return {
    orderId: order.id,
    paymentLink,
    paymentPixKey,
  }
}

