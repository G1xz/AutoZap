/**
 * Script para limpeza automática de mensagens antigas
 * 
 * Execute este script via cron job para limpar mensagens automaticamente
 * 
 * Exemplo de cron (diariamente às 2h da manhã):
 * 0 2 * * * cd /caminho/do/projeto && npx tsx scripts/cleanup-messages.ts
 * 
 * Ou usando node:
 * 0 2 * * * cd /caminho/do/projeto && node -r ts-node/register scripts/cleanup-messages.ts
 */

import { cleanupAllUsersMessages } from '../lib/message-cleanup'

async function main() {
  console.log('🧹 Iniciando limpeza automática de mensagens...')
  console.log(`   Data/Hora: ${new Date().toISOString()}`)
  
  try {
    const results = await cleanupAllUsersMessages(90) // Retenção padrão: 90 dias
    
    const totalDeleted = Object.values(results).reduce(
      (sum, result) => sum + result.deletedCount,
      0
    )
    
    const usersProcessed = Object.keys(results).length
    
    console.log(`✅ Limpeza concluída!`)
    console.log(`   Usuários processados: ${usersProcessed}`)
    console.log(`   Total de mensagens deletadas: ${totalDeleted}`)
    
    // Log detalhado por usuário
    for (const [userId, result] of Object.entries(results)) {
      if (result.deletedCount > 0) {
        console.log(`   - Usuário ${userId}: ${result.deletedCount} mensagens deletadas`)
      }
      if (result.error) {
        console.error(`   - Usuário ${userId}: Erro - ${result.error}`)
      }
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Erro ao executar limpeza:', error)
    process.exit(1)
  }
}

main()

