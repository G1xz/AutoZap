// Script para aplicar migration diretamente via Prisma
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function applyMigration() {
  try {
    console.log('🔄 Aplicando migration...')
    
    // Aplica a migration diretamente
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Workflow" 
      ADD COLUMN IF NOT EXISTS "isAIOnly" BOOLEAN NOT NULL DEFAULT false;
    `)
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Workflow" 
      ADD COLUMN IF NOT EXISTS "aiBusinessDetails" TEXT;
    `)
    
    console.log('✅ Migration aplicada com sucesso!')
    
    // Verifica se as colunas foram criadas
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Workflow' 
      AND column_name IN ('isAIOnly', 'aiBusinessDetails');
    `)
    
    console.log('📋 Colunas criadas:', result)
    
  } catch (error) {
    console.error('❌ Erro ao aplicar migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()
  .then(() => {
    console.log('✅ Concluído!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Falha:', error)
    process.exit(1)
  })

