import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { WorkingHoursConfig } from '@/lib/working-hours'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { workingHoursConfig: true },
      })

      let workingHoursConfig: WorkingHoursConfig | null = null
      if (user?.workingHoursConfig) {
        try {
          workingHoursConfig = JSON.parse(user.workingHoursConfig) as WorkingHoursConfig
        } catch (error) {
          console.error('Erro ao parsear workingHoursConfig:', error)
        }
      }

      return NextResponse.json({ workingHoursConfig })
    } catch (dbError: any) {
      // Se o erro for porque a coluna não existe, retorna null (coluna será criada no POST)
      if (dbError?.code === 'P2022' || 
          dbError?.code === 'P2010' ||
          dbError?.message?.includes('workingHoursConfig') || 
          dbError?.message?.includes('does not exist') ||
          dbError?.message?.includes('Unknown column')) {
        console.warn('⚠️ [GET /api/working-hours] Coluna workingHoursConfig não existe ainda, retornando null')
        return NextResponse.json({ workingHoursConfig: null })
      }
      throw dbError
    }
  } catch (error) {
    console.error('Erro ao buscar horários de funcionamento:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar horários de funcionamento' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { workingHoursConfig } = body

    console.log('📝 [POST /api/working-hours] Recebendo dados:', {
      userId: session.user.id,
      hasConfig: !!workingHoursConfig,
      configType: typeof workingHoursConfig,
    })

    // Valida que é um objeto válido
    if (workingHoursConfig && typeof workingHoursConfig !== 'object') {
      console.error('❌ [POST /api/working-hours] Formato inválido:', typeof workingHoursConfig)
      return NextResponse.json(
        { error: 'Formato de horários inválido' },
        { status: 400 }
      )
    }

    // Valida estrutura básica do objeto
    if (workingHoursConfig) {
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      for (const [key, value] of Object.entries(workingHoursConfig)) {
        if (!validDays.includes(key)) {
          console.warn(`⚠️ [POST /api/working-hours] Dia inválido ignorado: ${key}`)
          continue
        }
        
        if (value && typeof value === 'object') {
          // Valida que tem isOpen ou slots válidos
          const dayValue = value as any
          if (dayValue.isOpen === undefined && !dayValue.slots && !dayValue.openTime) {
            console.warn(`⚠️ [POST /api/working-hours] Dia ${key} sem configuração válida`)
          }
        }
      }
    }

    // Salva como JSON string
    let configJson: string | null = null
    try {
      configJson = workingHoursConfig ? JSON.stringify(workingHoursConfig) : null
      console.log('📝 [POST /api/working-hours] JSON gerado:', configJson ? `${configJson.length} caracteres` : 'null')
    } catch (jsonError) {
      console.error('❌ [POST /api/working-hours] Erro ao serializar JSON:', jsonError)
      return NextResponse.json(
        { error: 'Erro ao processar dados dos horários. Verifique se os dados estão corretos.' },
        { status: 400 }
      )
    }

    console.log('💾 [POST /api/working-hours] Verificando se colunas existem...')
    
    // Verifica e cria ambas as colunas se necessário (workingHoursConfig e slotConfig)
    try {
      const columnCheck = await prisma.$queryRawUnsafe(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' 
        AND column_name IN ('workingHoursConfig', 'slotConfig');
      `) as Array<{ column_name: string }>

      const existingColumns = columnCheck.map(c => c.column_name)
      const columnsToCreate: string[] = []

      if (!existingColumns.includes('workingHoursConfig')) {
        columnsToCreate.push('workingHoursConfig')
      }
      if (!existingColumns.includes('slotConfig')) {
        columnsToCreate.push('slotConfig')
      }

      if (columnsToCreate.length > 0) {
        console.warn(`⚠️ [POST /api/working-hours] Colunas faltando: ${columnsToCreate.join(', ')}, criando...`)
        
        for (const columnName of columnsToCreate) {
          try {
            await prisma.$executeRawUnsafe(`
              ALTER TABLE "User" 
              ADD COLUMN IF NOT EXISTS "${columnName}" TEXT;
            `)
            console.log(`✅ [POST /api/working-hours] Coluna ${columnName} criada com sucesso`)
          } catch (createError: any) {
            console.error(`❌ [POST /api/working-hours] Erro ao criar coluna ${columnName}:`, createError)
            // Continua tentando criar as outras colunas
          }
        }
      } else {
        console.log('✅ [POST /api/working-hours] Todas as colunas já existem')
      }
    } catch (checkError: any) {
      console.warn('⚠️ [POST /api/working-hours] Erro ao verificar colunas, tentando criar mesmo assim:', checkError.message)
      // Tenta criar ambas as colunas mesmo assim
      try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "User" 
          ADD COLUMN IF NOT EXISTS "workingHoursConfig" TEXT,
          ADD COLUMN IF NOT EXISTS "slotConfig" TEXT;
        `)
        console.log('✅ [POST /api/working-hours] Colunas criadas após erro na verificação')
      } catch (createError: any) {
        console.error('❌ [POST /api/working-hours] Erro ao criar colunas:', createError)
        // Tenta criar uma por uma
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workingHoursConfig" TEXT;`)
        } catch (e) {
          console.error('Erro ao criar workingHoursConfig:', e)
        }
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "slotConfig" TEXT;`)
        } catch (e) {
          console.error('Erro ao criar slotConfig:', e)
        }
      }
    }

    console.log('💾 [POST /api/working-hours] Salvando no banco...')
    
    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { workingHoursConfig: configJson },
      })

      console.log('✅ [POST /api/working-hours] Horários salvos com sucesso')
      return NextResponse.json({ success: true })
    } catch (dbError: any) {
      // Se ainda der erro, tenta criar ambas as colunas e salvar novamente
      if (dbError?.code === 'P2022' || 
          dbError?.code === 'P2010' ||
          dbError?.message?.includes('workingHoursConfig') || 
          dbError?.message?.includes('slotConfig') ||
          dbError?.message?.includes('does not exist') ||
          dbError?.message?.includes('Unknown column')) {
        console.warn('⚠️ [POST /api/working-hours] Erro ao salvar, tentando criar colunas novamente...')
        console.warn('⚠️ [POST /api/working-hours] Erro detalhado:', dbError.message)
        
        try {
          // Cria ambas as colunas
          await prisma.$executeRawUnsafe(`
            ALTER TABLE "User" 
            ADD COLUMN IF NOT EXISTS "workingHoursConfig" TEXT,
            ADD COLUMN IF NOT EXISTS "slotConfig" TEXT;
          `)
          
          console.log('✅ [POST /api/working-hours] Colunas criadas, tentando salvar novamente...')
          
          // Tenta salvar novamente
          await prisma.user.update({
            where: { id: session.user.id },
            data: { workingHoursConfig: configJson },
          })
          
          console.log('✅ [POST /api/working-hours] Horários salvos com sucesso após criar colunas')
          return NextResponse.json({ success: true })
        } catch (migrationError: any) {
          console.error('❌ [POST /api/working-hours] Erro ao criar colunas ou salvar:', migrationError)
          console.error('❌ [POST /api/working-hours] Stack:', migrationError.stack)
          
          // Tenta criar uma por uma como último recurso
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workingHoursConfig" TEXT;`)
            await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "slotConfig" TEXT;`)
            
            // Tenta salvar novamente
            await prisma.user.update({
              where: { id: session.user.id },
              data: { workingHoursConfig: configJson },
            })
            
            return NextResponse.json({ success: true })
          } catch (finalError: any) {
            return NextResponse.json(
              { error: `Erro ao salvar horários. As colunas workingHoursConfig e/ou slotConfig não existem no banco de dados. Por favor, execute a migration primeiro. Erro: ${finalError.message || 'Desconhecido'}` },
              { status: 500 }
            )
          }
        }
      }
      
      // Outro tipo de erro, propaga
      throw dbError
    }
  } catch (error) {
    console.error('❌ [POST /api/working-hours] Erro ao salvar horários de funcionamento:', error)
    console.error('❌ [POST /api/working-hours] Detalhes do erro:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code,
      stack: error instanceof Error ? error.stack : undefined,
    })
    
    const errorMessage = error instanceof Error 
      ? `Erro ao salvar horários: ${error.message}` 
      : 'Erro ao salvar horários de funcionamento'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

