import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Endpoint temporário para aplicar migration manualmente
 * Execute: GET /api/migrate/apply
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('🔄 Aplicando migration para isAIOnly e aiBusinessDetails...')

    // Verifica se as colunas já existem
    const checkColumns = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Workflow' 
      AND column_name IN ('isAIOnly', 'aiBusinessDetails');
    `) as Array<{ column_name: string }>

    const existingColumns = checkColumns.map(c => c.column_name)
    const results: string[] = []

    // Adiciona isAIOnly se não existir
    if (!existingColumns.includes('isAIOnly')) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Workflow" 
          ADD COLUMN "isAIOnly" BOOLEAN NOT NULL DEFAULT false;
        `)
        results.push('✅ Coluna isAIOnly criada com sucesso')
      } catch (error: any) {
        results.push(`❌ Erro ao criar isAIOnly: ${error.message}`)
      }
    } else {
      results.push('ℹ️ Coluna isAIOnly já existe')
    }

    // Adiciona aiBusinessDetails se não existir
    if (!existingColumns.includes('aiBusinessDetails')) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Workflow" 
          ADD COLUMN "aiBusinessDetails" TEXT;
        `)
        results.push('✅ Coluna aiBusinessDetails criada com sucesso')
      } catch (error: any) {
        results.push(`❌ Erro ao criar aiBusinessDetails: ${error.message}`)
      }
    } else {
      results.push('ℹ️ Coluna aiBusinessDetails já existe')
    }

    // Verifica novamente
    const finalCheck = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Workflow' 
      AND column_name IN ('isAIOnly', 'aiBusinessDetails');
    `) as Array<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>

    return NextResponse.json({
      success: true,
      message: 'Migration aplicada',
      results,
      columns: finalCheck,
    })
  } catch (error: any) {
    console.error('Erro ao aplicar migration:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro desconhecido',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}

