import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const workflowUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  trigger: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  isAIOnly: z.boolean().optional(),
  aiBusinessDetails: z.string().nullable().optional(),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        positionX: z.number(),
        positionY: z.number(),
        data: z.string(),
      })
    )
    .optional(),
  edges: z
    .array(
      z.object({
        sourceNodeId: z.string(),
        targetNodeId: z.string(),
        sourceHandle: z.string().nullable().optional(),
        targetHandle: z.string().nullable().optional(),
      })
    )
    .optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const resolvedParams = await params
    const id = resolvedParams.id

    if (!id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 })
    }

    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
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
    })

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow não encontrado' }, { status: 404 })
    }

    const connections = await prisma.workflowConnection.findMany({
      where: { workflowId: workflow.id },
    })

    return NextResponse.json({
      ...workflow,
      connections,
    })
  } catch (error) {
    console.error('Erro ao buscar workflow:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar workflow' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const resolvedParams = await params
    const id = resolvedParams.id

    if (!id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 })
    }

    // Verifica se o workflow pertence ao usuário
    const existingWorkflow = await prisma.workflow.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingWorkflow) {
      return NextResponse.json(
        { error: 'Workflow não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const data = workflowUpdateSchema.parse(body)

    const isAIOnly = data.isAIOnly !== undefined ? data.isAIOnly : existingWorkflow.isAIOnly
    
    // Detecta se o workflow usa nós de IA (se nós foram fornecidos)
    let usesAI = existingWorkflow.usesAI
    if (isAIOnly) {
      usesAI = true
    } else if (data.nodes) {
      usesAI = data.nodes.some((node) => {
        try {
          const nodeData = typeof node.data === 'string' ? JSON.parse(node.data) : node.data
          return node.type === 'ai'
        } catch {
          return false
        }
      })
    }

    // Atualiza o workflow
    const updateData: any = {}
    if (data.name) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.trigger) updateData.trigger = data.trigger
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.isAIOnly !== undefined) updateData.isAIOnly = data.isAIOnly
    if (data.aiBusinessDetails !== undefined) updateData.aiBusinessDetails = data.aiBusinessDetails
    if (data.nodes) updateData.usesAI = usesAI

    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData,
    })

    // Se há nós e edges, atualiza toda a estrutura
    if (data.nodes && data.edges) {
      // Remove nós e conexões antigas
      await prisma.workflowConnection.deleteMany({
        where: { workflowId: id },
      })
      await prisma.workflowNode.deleteMany({
        where: { workflowId: id },
      })

      // Cria novos nós e mapeia IDs antigos para novos IDs do banco
      const nodeIdMap = new Map<string, string>() // Mapeia ID temporário -> ID do banco
      const nodes = await Promise.all(
        data.nodes.map(async (nodeData) => {
          const createdNode = await prisma.workflowNode.create({
            data: {
              workflowId: id,
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

      // Cria novas conexões usando os IDs mapeados do banco
      const connections = data.edges && data.edges.length > 0
        ? await Promise.all(
            data.edges.map((edgeData) => {
              const sourceNodeId = nodeIdMap.get(edgeData.sourceNodeId)
              const targetNodeId = nodeIdMap.get(edgeData.targetNodeId)
              
              // Verifica se os IDs foram mapeados corretamente
              if (!sourceNodeId || !targetNodeId) {
                throw new Error(`Nó não encontrado para conexão: source=${edgeData.sourceNodeId}, target=${edgeData.targetNodeId}`)
              }
              
              return prisma.workflowConnection.create({
                data: {
                  workflowId: id,
                  sourceNodeId: sourceNodeId,
                  targetNodeId: targetNodeId,
                  sourceHandle: edgeData.sourceHandle || null,
                  targetHandle: edgeData.targetHandle || null,
                },
              })
            })
          )
        : []

      return NextResponse.json({
        ...workflow,
        nodes,
        connections,
      })
    }

    return NextResponse.json(workflow)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar workflow:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar workflow' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const resolvedParams = await params
    const id = resolvedParams.id

    if (!id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 })
    }

    // Verifica se o workflow pertence ao usuário
    const workflow = await prisma.workflow.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow não encontrado' },
        { status: 404 }
      )
    }

    // As conexões e nós serão deletados automaticamente pelo cascade
    await prisma.workflow.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar workflow:', error)
    return NextResponse.json(
      { error: 'Erro ao deletar workflow' },
      { status: 500 }
    )
  }
}

