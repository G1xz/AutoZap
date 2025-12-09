/**
 * Script para inicializar os planos no banco de dados
 * Execute: npx tsx scripts/init-plans.ts
 */

import { initializePlans } from '../lib/plans'

async function main() {
  console.log('🚀 Inicializando planos...')
  
  try {
    await initializePlans()
    console.log('✅ Planos inicializados com sucesso!')
    
    // Mostra os planos criados
    const { getActivePlans } = await import('../lib/plans')
    const plans = await getActivePlans()
    
    console.log('\n📋 Planos criados:')
    plans.forEach(plan => {
      console.log(`\n${plan.displayName}:`)
      console.log(`  - Preço: R$ ${plan.price.toFixed(2)}`)
      console.log(`  - Porcentagem Admin: ${(plan.adminPercentage * 100).toFixed(0)}%`)
      console.log(`  - Pontos para Cliente: ${plan.pointsAmount}`)
      console.log(`  - Receita Admin: R$ ${(plan.price * plan.adminPercentage).toFixed(2)}`)
    })
  } catch (error) {
    console.error('❌ Erro ao inicializar planos:', error)
    process.exit(1)
  }
}

main()

