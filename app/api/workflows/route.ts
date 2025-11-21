import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const workflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.string().min(1),
  isActive: z.boolean().optional(),
  instanceId: z.string().nullable().optional(),
  isAIOnly: z.boolean().optional(),
  aiBusinessDetails: z.string().nullable().optional(),
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      positionX: z.number(),
      positionY: z.number(),
      data: z.string(), // JSON stringificado
    })
  ).optional(),
  edges: z.array(
    z.object({
      sourceNodeId: z.string(),
      targetNodeId: z.string(),
      sourceHandle: z.string().nullable().optional(),
      targetHandle: z.string().nullable().optional(),
    })
  ).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const workflows = await prisma.workflow.findMany({
      where: { userId: session.user.id },
      include: {
        nodes: {
          orderBy: { createdAt: 'asc' },
        },
        instance: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Buscar conexões para cada workflow
    const workflowsWithConnections = await Promise.all(
      workflows.map(async (workflow) => {
        const connections = await prisma.workflowConnection.findMany({
          where: { workflowId: workflow.id },
        })

        return {
          ...workflow,
          connections,
        }
      })
    )

    return NextResponse.json(workflowsWithConnections)
  } catch (error) {
    console.error('Erro ao buscar workflows:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar workflows' },
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

    // Verificar se prisma está disponível
    if (!prisma || !prisma.workflow) {
      console.error('Prisma client não está disponível:', { prisma, hasWorkflow: !!prisma?.workflow })
      return NextResponse.json(
        { error: 'Erro de configuração do banco de dados', details: 'Prisma client não inicializado' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const data = workflowSchema.parse(body)

    // Verifica se instanceId pertence ao usuário (se fornecido)
    if (data.instanceId) {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: data.instanceId },
      })

      if (!instance || instance.userId !== session.user.id) {
        return NextResponse.json(
          { error: 'Instância inválida' },
          { status: 400 }
        )
      }
    }

    const isAIOnly = data.isAIOnly ?? false
    
    // Detecta se o workflow usa nós de IA (apenas para fluxos manuais)
    const usesAI = isAIOnly 
      ? true 
      : (data.nodes || []).some((node) => {
          try {
            const nodeData = typeof node.data === 'string' ? JSON.parse(node.data) : node.data
            return node.type === 'ai'
          } catch {
            return false
          }
        })

    // Tenta criar o workflow, se falhar por falta de colunas, tenta criar as colunas
    let workflow
    try {
      workflow = await prisma.workflow.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description || null,
        trigger: data.trigger,
        isActive: data.isActive ?? true,
        instanceId: data.instanceId || null,
          usesAI,
          isAIOnly,
          aiBusinessDetails: isAIOnly ? (data.aiBusinessDetails || null) : null,
      },
    })
    } catch (error: any) {
      // Se o erro for por coluna não existir, tenta criar as colunas
      if (error.message?.includes('isAIOnly') || error.message?.includes('isAlOnly')) {
        console.log('⚠️ Colunas não existem, tentando criar...')
        try {
          await prisma.$executeRawUnsafe(`
            ALTER TABLE "Workflow" 
            ADD COLUMN IF NOT EXISTS "isAIOnly" BOOLEAN NOT NULL DEFAULT false;
          `)
          await prisma.$executeRawUnsafe(`
            ALTER TABLE "Workflow" 
            ADD COLUMN IF NOT EXISTS "aiBusinessDetails" TEXT;
          `)
          console.log('✅ Colunas criadas, tentando novamente...')
          
          // Tenta criar novamente
          workflow = await prisma.workflow.create({
            data: {
              userId: session.user.id,
              name: data.name,
              description: data.description || null,
              trigger: data.trigger,
              isActive: data.isActive ?? true,
              instanceId: data.instanceId || null,
              usesAI,
              isAIOnly,
              aiBusinessDetails: isAIOnly ? (data.aiBusinessDetails || null) : null,
            },
          })
        } catch (migrationError: any) {
          console.error('Erro ao criar colunas:', migrationError)
          return NextResponse.json(
            {
              error: 'Erro ao aplicar migration. Acesse /api/migrate/apply para aplicar manualmente.',
              details: migrationError.message,
            },
            { status: 500 }
          )
        }
      } else {
        throw error
      }
    }

    // Cria os nós apenas se não for IA-only
    const nodeIdMap = new Map<string, string>() // Mapeia ID temporário -> ID do banco
    const nodes = isAIOnly 
      ? [] 
      : await Promise.all(
          (data.nodes || []).map(async (nodeData) => {
        const createdNode = await prisma.workflowNode.create({
          data: {
            workflowId: workflow.id,
            type: nodeData.type,
            positionX: nodeData.positionX,
            positionY: nodeData.positionY,
            data: nodeData.data,
          },
        })
        // Mapeia o ID temporário para o ID real do banco
        nodeIdMap.set(nodeData.id, createdNode.id)
        return createdNode
      })
    )

    // Cria as conexões apenas se não for IA-only
    const connections = isAIOnly || !data.edges || data.edges.length === 0
      ? []
      : await Promise.all(
          data.edges.map((edgeData) => {
            const sourceNodeId = nodeIdMap.get(edgeData.sourceNodeId)
            const targetNodeId = nodeIdMap.get(edgeData.targetNodeId)
            
            // Verifica se os IDs foram mapeados corretamente
            if (!sourceNodeId || !targetNodeId) {
              throw new Error(`Nó não encontrado para conexão: source=${edgeData.sourceNodeId}, target=${edgeData.targetNodeId}`)
            }
            
            return prisma.workflowConnection.create({
              data: {
                workflowId: workflow.id,
                sourceNodeId: sourceNodeId,
                targetNodeId: targetNodeId,
                sourceHandle: edgeData.sourceHandle || null,
                targetHandle: edgeData.targetHandle || null,
              },
            })
          })
        )

    return NextResponse.json(
      {
        ...workflow,
        nodes,
        connections,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro ao criar workflow:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { 
        error: 'Erro ao criar workflow',
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}

