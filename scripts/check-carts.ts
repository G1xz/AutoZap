/**
 * Script para verificar carrinhos e itens no banco de dados
 * Execute com: npx tsx scripts/check-carts.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkCarts() {
  console.log('🔍 Verificando carrinhos no banco de dados...\n')

  try {
    // Busca todos os carrinhos
    const allCarts = await prisma.cart.findMany({
      include: {
        items: true,
        instance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    console.log(`📊 Total de carrinhos no banco: ${allCarts.length}\n`)

    if (allCarts.length === 0) {
      console.log('⚠️ Nenhum carrinho encontrado no banco de dados.')
      return
    }

    // Mostra cada carrinho
    allCarts.forEach((cart, index) => {
      console.log(`\n🛒 Carrinho ${index + 1}:`)
      console.log(`   ID: ${cart.id}`)
      console.log(`   Instance ID: ${cart.instanceId}`)
      console.log(`   Instance Name: ${cart.instance?.name || 'N/A'}`)
      console.log(`   Contact Number: "${cart.contactNumber}"`)
      console.log(`   Total de itens: ${cart.items.length}`)
      console.log(`   Criado em: ${cart.createdAt.toISOString()}`)
      console.log(`   Atualizado em: ${cart.updatedAt.toISOString()}`)

      if (cart.items.length > 0) {
        console.log(`   📦 Itens:`)
        cart.items.forEach((item, itemIndex) => {
          console.log(`      [${itemIndex + 1}] ${item.productName}`)
          console.log(`          ID: ${item.id}`)
          console.log(`          Product ID: ${item.productId}`)
          console.log(`          Product Type: ${item.productType}`)
          console.log(`          Quantidade: ${item.quantity}`)
          console.log(`          Preço Unitário: R$ ${item.unitPrice}`)
          console.log(`          Total: R$ ${item.quantity * item.unitPrice}`)
          console.log(`          Criado em: ${item.createdAt.toISOString()}`)
        })
      } else {
        console.log(`   ⚠️ Carrinho VAZIO (sem itens)`)
      }
    })

    // Estatísticas gerais
    console.log(`\n📈 Estatísticas:`)
    const totalItems = allCarts.reduce((sum, cart) => sum + cart.items.length, 0)
    const cartsWithItems = allCarts.filter(cart => cart.items.length > 0).length
    const emptyCarts = allCarts.filter(cart => cart.items.length === 0).length

    console.log(`   Total de itens em todos os carrinhos: ${totalItems}`)
    console.log(`   Carrinhos com itens: ${cartsWithItems}`)
    console.log(`   Carrinhos vazios: ${emptyCarts}`)

    // Verifica CartItems órfãos (sem carrinho)
    const orphanItems = await prisma.cartItem.findMany({
      where: {
        cart: null,
      },
    })

    if (orphanItems.length > 0) {
      console.log(`\n⚠️ ATENÇÃO: ${orphanItems.length} CartItems órfãos encontrados (sem carrinho associado)!`)
    }

    // Verifica por instância
    const cartsByInstance = await prisma.cart.groupBy({
      by: ['instanceId'],
      _count: {
        id: true,
      },
    })

    console.log(`\n📊 Carrinhos por instância:`)
    for (const group of cartsByInstance) {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: group.instanceId },
        select: { name: true },
      })
      console.log(`   ${instance?.name || group.instanceId}: ${group._count.id} carrinho(s)`)
    }

  } catch (error) {
    console.error('❌ Erro ao verificar carrinhos:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCarts()
