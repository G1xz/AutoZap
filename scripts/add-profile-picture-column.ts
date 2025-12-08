import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Verificando coluna profilePictureUrl...')

  try {
    // Verifica se a coluna existe
    const columnCheck = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name = 'profilePictureUrl';
    `) as Array<{ column_name: string }>

    if (columnCheck.length > 0) {
      console.log('✅ Coluna profilePictureUrl já existe')
      return
    }

    // Cria a coluna se não existir
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT;
    `)

    console.log('✅ Coluna profilePictureUrl criada com sucesso!')
  } catch (error: any) {
    console.error('❌ Erro ao criar coluna:', error)
    throw error
  }
}

main()
  .catch((error) => {
    console.error('Erro:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

