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

    console.log('🔄 Aplicando migrations pendentes...')

    const results: string[] = []

    // 1. Migration para Workflow (isAIOnly e aiBusinessDetails)
    const checkWorkflowColumns = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Workflow' 
      AND column_name IN ('isAIOnly', 'aiBusinessDetails');
    `) as Array<{ column_name: string }>

    const existingWorkflowColumns = checkWorkflowColumns.map(c => c.column_name)

    // Adiciona isAIOnly se não existir
    if (!existingWorkflowColumns.includes('isAIOnly')) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Workflow" 
          ADD COLUMN "isAIOnly" BOOLEAN NOT NULL DEFAULT false;
        `)
        results.push('✅ Coluna Workflow.isAIOnly criada com sucesso')
      } catch (error: any) {
        results.push(`❌ Erro ao criar isAIOnly: ${error.message}`)
      }
    } else {
      results.push('ℹ️ Coluna Workflow.isAIOnly já existe')
    }

    // Adiciona aiBusinessDetails se não existir
    if (!existingWorkflowColumns.includes('aiBusinessDetails')) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "Workflow" 
          ADD COLUMN "aiBusinessDetails" TEXT;
        `)
        results.push('✅ Coluna Workflow.aiBusinessDetails criada com sucesso')
      } catch (error: any) {
        results.push(`❌ Erro ao criar aiBusinessDetails: ${error.message}`)
      }
    } else {
      results.push('ℹ️ Coluna Workflow.aiBusinessDetails já existe')
    }

    // 2. Migration para User (slotConfig)
    const checkUserColumns = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name = 'slotConfig';
    `) as Array<{ column_name: string }>

    if (checkUserColumns.length === 0) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "User" 
          ADD COLUMN "slotConfig" TEXT;
        `)
        results.push('✅ Coluna User.slotConfig criada com sucesso')
      } catch (error: any) {
        results.push(`❌ Erro ao criar slotConfig: ${error.message}`)
      }
    } else {
      results.push('ℹ️ Coluna User.slotConfig já existe')
    }

    // Verifica novamente todas as colunas
    const finalCheck = await prisma.$queryRawUnsafe(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE (table_name = 'Workflow' AND column_name IN ('isAIOnly', 'aiBusinessDetails'))
         OR (table_name = 'User' AND column_name = 'slotConfig')
      ORDER BY table_name, column_name;
    `) as Array<{ table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }>

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

