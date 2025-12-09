import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const catalogUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      positionX: z.number(),
      positionY: z.number(),
      data: z.string(),
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const catalog = await prisma.catalog.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        nodes: {
          orderBy: { createdAt: 'asc' },
        },
        connections: true,
      },
    })

    if (!catalog) {
      return NextResponse.json({ error: 'Catálogo não encontrado' }, { status: 404 })
    }

    return NextResponse.json(catalog)
  } catch (error) {
    console.error('Erro ao buscar catálogo:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar catálogo' },
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

    const { id } = await params
    const body = await request.json()
    const data = catalogUpdateSchema.parse(body)

    // Verifica se o catálogo pertence ao usuário
    const catalog = await prisma.catalog.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!catalog) {
      return NextResponse.json({ error: 'Catálogo não encontrado' }, { status: 404 })
    }

    // Se apenas isActive está sendo atualizado, atualiza diretamente
    if (Object.keys(data).length === 1 && 'isActive' in data) {
      const updated = await prisma.catalog.update({
        where: { id },
        data: { isActive: data.isActive },
      })
      return NextResponse.json(updated)
    }

    // Atualiza informações básicas do catálogo
    const updateData: any = {}
    if (data.name) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    if (Object.keys(updateData).length > 0) {
      await prisma.catalog.update({
        where: { id },
        data: updateData,
      })
    }

    // Se nodes e edges foram fornecidos, atualiza a estrutura
    if (data.nodes && data.edges) {
      // Remove nós e conexões antigas
      await prisma.catalogConnection.deleteMany({
        where: { catalogId: id },
      })
      await prisma.catalogNode.deleteMany({
        where: { catalogId: id },
      })

      // Cria novos nós
      const nodeIdMap = new Map<string, string>()
      await Promise.all(
        data.nodes.map(async (nodeData) => {
          const createdNode = await prisma.catalogNode.create({
            data: {
              catalogId: id,
              type: nodeData.type,
              positionX: nodeData.positionX,
              positionY: nodeData.positionY,
              data: nodeData.data,
            },
          })
          nodeIdMap.set(nodeData.id, createdNode.id)
        })
      )

      // Cria novas conexões
      await Promise.all(
        data.edges.map(async (edgeData) => {
          const sourceId = nodeIdMap.get(edgeData.sourceNodeId) || edgeData.sourceNodeId
          const targetId = nodeIdMap.get(edgeData.targetNodeId) || edgeData.targetNodeId
          
          await prisma.catalogConnection.create({
            data: {
              catalogId: id,
              sourceNodeId: sourceId,
              targetNodeId: targetId,
              sourceHandle: edgeData.sourceHandle || null,
              targetHandle: edgeData.targetHandle || null,
            },
          })
        })
      )
    }

    const updated = await prisma.catalog.findUnique({
      where: { id },
      include: {
        nodes: true,
        connections: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar catálogo:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar catálogo' },
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

    const { id } = await params
    const catalog = await prisma.catalog.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!catalog) {
      return NextResponse.json({ error: 'Catálogo não encontrado' }, { status: 404 })
    }

    await prisma.catalog.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir catálogo:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir catálogo' },
      { status: 500 }
    )
  }
}

