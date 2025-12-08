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

    // 2. Migration para User (slotConfig, workingHoursConfig e profilePictureUrl)
    const checkUserColumns = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name IN ('slotConfig', 'workingHoursConfig', 'profilePictureUrl');
    `) as Array<{ column_name: string }>

    const existingUserColumns = checkUserColumns.map(c => c.column_name)

    // Adiciona slotConfig se não existir
    if (!existingUserColumns.includes('slotConfig')) {
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

    // Adiciona workingHoursConfig se não existir
    if (!existingUserColumns.includes('workingHoursConfig')) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "User" 
          ADD COLUMN "workingHoursConfig" TEXT;
        `)
        results.push('✅ Coluna User.workingHoursConfig criada com sucesso')
      } catch (error: any) {
        results.push(`❌ Erro ao criar workingHoursConfig: ${error.message}`)
      }
    } else {
      results.push('ℹ️ Coluna User.workingHoursConfig já existe')
    }

    // Adiciona profilePictureUrl se não existir
    if (!existingUserColumns.includes('profilePictureUrl')) {
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "User" 
          ADD COLUMN "profilePictureUrl" TEXT;
        `)
        results.push('✅ Coluna User.profilePictureUrl criada com sucesso')
      } catch (error: any) {
        results.push(`❌ Erro ao criar profilePictureUrl: ${error.message}`)
      }
    } else {
      results.push('ℹ️ Coluna User.profilePictureUrl já existe')
    }

    // 3. Verifica se a tabela AIMetric existe
    const checkAIMetricTable = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'AIMetric';
    `) as Array<{ table_name: string }>

    if (checkAIMetricTable.length === 0) {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "AIMetric" (
            "id" TEXT NOT NULL,
            "userId" TEXT,
            "instanceId" TEXT,
            "model" TEXT NOT NULL,
            "promptTokens" INTEGER NOT NULL DEFAULT 0,
            "completionTokens" INTEGER NOT NULL DEFAULT 0,
            "totalTokens" INTEGER NOT NULL DEFAULT 0,
            "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "duration" INTEGER NOT NULL DEFAULT 0,
            "cached" BOOLEAN NOT NULL DEFAULT false,
            "endpoint" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "AIMetric_pkey" PRIMARY KEY ("id")
          );
        `)
        
        // Cria índices
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AIMetric_userId_idx" ON "AIMetric"("userId");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AIMetric_instanceId_idx" ON "AIMetric"("instanceId");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AIMetric_userId_createdAt_idx" ON "AIMetric"("userId", "createdAt");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AIMetric_createdAt_idx" ON "AIMetric"("createdAt");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AIMetric_model_idx" ON "AIMetric"("model");`)
        
        // Adiciona foreign keys
        await prisma.$executeRawUnsafe(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIMetric_userId_fkey') THEN
              ALTER TABLE "AIMetric" ADD CONSTRAINT "AIMetric_userId_fkey" 
                FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIMetric_instanceId_fkey') THEN
              ALTER TABLE "AIMetric" ADD CONSTRAINT "AIMetric_instanceId_fkey" 
                FOREIGN KEY ("instanceId") REFERENCES "WhatsAppInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;
          END $$;
        `)
        
        results.push('✅ Tabela AIMetric criada com sucesso')
      } catch (error: any) {
        results.push(`❌ Erro ao criar tabela AIMetric: ${error.message}`)
      }
    } else {
      results.push('ℹ️ Tabela AIMetric já existe')
    }

    // Verifica novamente todas as colunas
    const finalCheck = await prisma.$queryRawUnsafe(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE (table_name = 'Workflow' AND column_name IN ('isAIOnly', 'aiBusinessDetails'))
         OR (table_name = 'User' AND column_name IN ('slotConfig', 'workingHoursConfig', 'profilePictureUrl'))
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

