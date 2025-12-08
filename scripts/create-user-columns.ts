import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verificando colunas na tabela User...')
  
  try {
    // Verifica quais colunas existem
    const columns = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name IN ('slotConfig', 'workingHoursConfig');
    `) as Array<{ column_name: string }>

    const existingColumns = columns.map(c => c.column_name)
    console.log('📋 Colunas existentes:', existingColumns)

    // Cria slotConfig se não existir
    if (!existingColumns.includes('slotConfig')) {
      console.log('➕ Criando coluna slotConfig...')
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User" 
        ADD COLUMN IF NOT EXISTS "slotConfig" TEXT;
      `)
      console.log('✅ Coluna slotConfig criada!')
    } else {
      console.log('✅ Coluna slotConfig já existe')
    }

    // Cria workingHoursConfig se não existir
    if (!existingColumns.includes('workingHoursConfig')) {
      console.log('➕ Criando coluna workingHoursConfig...')
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User" 
        ADD COLUMN IF NOT EXISTS "workingHoursConfig" TEXT;
      `)
      console.log('✅ Coluna workingHoursConfig criada!')
    } else {
      console.log('✅ Coluna workingHoursConfig já existe')
    }

    // Verifica novamente
    const finalCheck = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name IN ('slotConfig', 'workingHoursConfig')
      ORDER BY column_name;
    `) as Array<{ column_name: string; data_type: string; is_nullable: string }>

    console.log('\n📊 Status final das colunas:')
    finalCheck.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`)
    })

    console.log('\n✅ Concluído! Agora você pode salvar os horários.')
  } catch (error) {
    console.error('❌ Erro:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()


