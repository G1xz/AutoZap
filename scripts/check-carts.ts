/**
 * Script para verificar carrinhos no banco de dados
 * Mostra todos os carrinhos e seus itens
 */

import { prisma } from '../lib/prisma'

async function checkCarts() {
  try {
    console.log('🔍 Verificando carrinhos no banco de dados...\n')

    // Busca todos os carrinhos com seus itens
    const carts = await prisma.cart.findMany({
      include: {
        items: true,
        instance: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    console.log(`📊 Total de carrinhos encontrados: ${carts.length}\n`)

    if (carts.length === 0) {
      console.log('✅ Nenhum carrinho encontrado no banco de dados.')
      return
    }

    // Agrupa por status (com itens vs vazios)
    const cartsWithItems = carts.filter(c => c.items.length > 0)
    const emptyCarts = carts.filter(c => c.items.length === 0)

    console.log(`🛒 Carrinhos COM itens: ${cartsWithItems.length}`)
    console.log(`📦 Carrinhos VAZIOS: ${emptyCarts.length}\n`)

    // Mostra carrinhos com itens
    if (cartsWithItems.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🛒 CARRINHOS COM ITENS:')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

      cartsWithItems.forEach((cart, index) => {
        console.log(`[${index + 1}] Carrinho ID: ${cart.id}`)
        console.log(`   Instância: ${cart.instance.name} (${cart.instanceId})`)
        console.log(`   Contato: ${cart.contactNumber}`)
        console.log(`   Usuário: ${cart.user.name} (${cart.user.email})`)
        console.log(`   Criado em: ${cart.createdAt.toLocaleString('pt-BR')}`)
        console.log(`   Atualizado em: ${cart.updatedAt.toLocaleString('pt-BR')}`)
        console.log(`   Total de itens: ${cart.items.length}`)
        console.log(`\n   📦 ITENS:`)
        
        let total = 0
        cart.items.forEach((item, itemIndex) => {
          const itemTotal = item.quantity * Number(item.unitPrice)
          total += itemTotal
          console.log(`      ${itemIndex + 1}. ${item.productName}`)
          console.log(`         Tipo: ${item.productType}`)
          console.log(`         Quantidade: ${item.quantity}x`)
          console.log(`         Preço unitário: R$ ${Number(item.unitPrice).toFixed(2).replace('.', ',')}`)
          console.log(`         Subtotal: R$ ${itemTotal.toFixed(2).replace('.', ',')}`)
          if (item.notes) {
            console.log(`         Observação: ${item.notes}`)
          }
          console.log('')
        })
        
        console.log(`   💰 TOTAL DO CARRINHO: R$ ${total.toFixed(2).replace('.', ',')}`)
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      })
    }

    // Mostra carrinhos vazios (se houver)
    if (emptyCarts.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📦 CARRINHOS VAZIOS:')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

      emptyCarts.forEach((cart, index) => {
        console.log(`[${index + 1}] Carrinho ID: ${cart.id}`)
        console.log(`   Instância: ${cart.instance.name} (${cart.instanceId})`)
        console.log(`   Contato: ${cart.contactNumber}`)
        console.log(`   Criado em: ${cart.createdAt.toLocaleString('pt-BR')}`)
        console.log(`   Atualizado em: ${cart.updatedAt.toLocaleString('pt-BR')}`)
        console.log('')
      })
    }

    // Estatísticas
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 ESTATÍSTICAS:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Total de carrinhos: ${carts.length}`)
    console.log(`Carrinhos com itens: ${cartsWithItems.length}`)
    console.log(`Carrinhos vazios: ${emptyCarts.length}`)
    
    const totalItems = carts.reduce((sum, cart) => sum + cart.items.length, 0)
    console.log(`Total de itens em todos os carrinhos: ${totalItems}`)
    
    const totalValue = carts.reduce((sum, cart) => {
      const cartTotal = cart.items.reduce((itemSum, item) => {
        return itemSum + (item.quantity * Number(item.unitPrice))
      }, 0)
      return sum + cartTotal
    }, 0)
    console.log(`Valor total em todos os carrinhos: R$ ${totalValue.toFixed(2).replace('.', ',')}`)

  } catch (error) {
    console.error('❌ Erro ao verificar carrinhos:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Executa o script
checkCarts()
  .then(() => {
    console.log('\n✅ Verificação concluída!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erro ao executar script:', error)
    process.exit(1)
  })

