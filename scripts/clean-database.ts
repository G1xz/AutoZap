/**
 * Script para limpar o banco de dados mantendo apenas usuários
 * Execute: npx tsx scripts/clean-database.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanDatabase() {
  console.log('🧹 Iniciando limpeza do banco de dados...')
  console.log('⚠️  Mantendo apenas usuários (com isAdmin preservado)')
  console.log('')

  try {
    // Conta registros antes de deletar
    const counts = {
      aiMetrics: await prisma.aIMetric.count(),
      orders: await prisma.order.count(),
      carts: await prisma.cart.count(),
      appointments: await prisma.appointment.count(),
      messages: await prisma.message.count(),
      conversationStatuses: await prisma.conversationStatus.count(),
      workflows: await prisma.workflow.count(),
      catalogs: await prisma.catalog.count(),
      catalogNodes: await prisma.catalogNode.count(),
      catalogConnections: await prisma.catalogConnection.count(),
      productInterests: await prisma.productInterest.count(),
      planSubscriptions: await prisma.planSubscription.count(),
      pendingAppointments: await prisma.pendingAppointment.count(),
      whatsAppInstances: await prisma.whatsAppInstance.count(),
      contacts: await prisma.contact.count(),
      automationRules: await prisma.automationRule.count(),
      services: await prisma.service.count(),
      businessPixKeys: await prisma.businessPixKey.count(),
    }

    console.log('📊 Registros encontrados:')
    Object.entries(counts).forEach(([key, count]) => {
      console.log(`   ${key}: ${count}`)
    })
    console.log('')

    // Deleta em ordem (respeitando foreign keys)
    console.log('🗑️  Deletando registros...')

    // 1. Product Interests
    await prisma.productInterest.deleteMany({})
    console.log('   ✅ Product Interests deletados')

    // 2. Catalog Connections
    await prisma.catalogConnection.deleteMany({})
    console.log('   ✅ Catalog Connections deletados')

    // 3. Catalog Nodes
    await prisma.catalogNode.deleteMany({})
    console.log('   ✅ Catalog Nodes deletados')

    // 4. Catalogs
    await prisma.catalog.deleteMany({})
    console.log('   ✅ Catalogs deletados')

    // 5. Services
    await prisma.service.deleteMany({})
    console.log('   ✅ Services deletados')

    // 6. Automation Rules
    await prisma.automationRule.deleteMany({})
    console.log('   ✅ Automation Rules deletados')

    // 7. Workflow Connections
    await prisma.workflowConnection.deleteMany({})
    console.log('   ✅ Workflow Connections deletados')

    // 8. Workflow Nodes
    await prisma.workflowNode.deleteMany({})
    console.log('   ✅ Workflow Nodes deletados')

    // 9. Workflows
    await prisma.workflow.deleteMany({})
    console.log('   ✅ Workflows deletados')

    // 10. Contacts
    await prisma.contact.deleteMany({})
    console.log('   ✅ Contacts deletados')

    // 11. Business Pix Keys
    await prisma.businessPixKey.deleteMany({})
    console.log('   ✅ Business Pix Keys deletados')

    // 12. Plan Subscriptions
    await prisma.planSubscription.deleteMany({})
    console.log('   ✅ Plan Subscriptions deletados')

    // 13. Cart Items
    await prisma.cartItem.deleteMany({})
    console.log('   ✅ Cart Items deletados')

    // 14. Carts
    await prisma.cart.deleteMany({})
    console.log('   ✅ Carts deletados')

    // 15. Order Items
    await prisma.orderItem.deleteMany({})
    console.log('   ✅ Order Items deletados')

    // 16. Orders
    await prisma.order.deleteMany({})
    console.log('   ✅ Orders deletados')

    // 17. Pending Appointments
    await prisma.pendingAppointment.deleteMany({})
    console.log('   ✅ Pending Appointments deletados')

    // 18. Appointments
    await prisma.appointment.deleteMany({})
    console.log('   ✅ Appointments deletados')

    // 19. Messages
    await prisma.message.deleteMany({})
    console.log('   ✅ Messages deletados')

    // 20. Conversation Statuses
    await prisma.conversationStatus.deleteMany({})
    console.log('   ✅ Conversation Statuses deletados')

    // 21. AI Metrics
    await prisma.aIMetric.deleteMany({})
    console.log('   ✅ AI Metrics deletados')

    // 22. WhatsApp Instances
    await prisma.whatsAppInstance.deleteMany({})
    console.log('   ✅ WhatsApp Instances deletados')

    // Reseta pontos dos usuários (mas mantém os usuários)
    await prisma.user.updateMany({
      data: {
        pointsAvailable: 0,
        pointsConsumedThisMonth: 0,
        planName: null,
        planRenewalDate: null,
      },
    })
    console.log('   ✅ Pontos dos usuários resetados')

    console.log('')
    console.log('✅ Limpeza concluída com sucesso!')
    console.log('')
    console.log('📋 Usuários mantidos:')
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        pointsAvailable: true,
      },
    })
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - Admin: ${user.isAdmin ? 'Sim' : 'Não'} - Pontos: ${user.pointsAvailable}`)
    })
  } catch (error) {
    console.error('❌ Erro ao limpar banco de dados:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Executa a limpeza
// Para usar com confirmação interativa, descomente o código abaixo e comente esta linha:
cleanDatabase().catch(console.error)

/*
// Confirmação antes de executar (descomente para usar)
import * as readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

rl.question('⚠️  ATENÇÃO: Isso vai deletar TODOS os dados exceto usuários. Continuar? (sim/não): ', async (answer) => {
  if (answer.toLowerCase() === 'sim' || answer.toLowerCase() === 's' || answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    await cleanDatabase()
  } else {
    console.log('❌ Operação cancelada.')
  }
  rl.close()
})
*/

