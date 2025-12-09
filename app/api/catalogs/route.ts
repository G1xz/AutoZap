import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const catalogSchema = z.object({
  name: z.string().min(1),
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
  ),
  edges: z.array(
    z.object({
      sourceNodeId: z.string(),
      targetNodeId: z.string(),
      sourceHandle: z.string().nullable().optional(),
      targetHandle: z.string().nullable().optional(),
    })
  ),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const catalogs = await prisma.catalog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(catalogs)
  } catch (error) {
    console.error('Erro ao buscar catálogos:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar catálogos' },
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
    const data = catalogSchema.parse(body)

    // Cria o catálogo
    const catalog = await prisma.catalog.create({
      data: {
        userId: session.user.id,
        name: data.name,
        description: data.description || null,
        imageUrl: data.imageUrl || null,
        isActive: data.isActive ?? true,
      },
    })

    // Cria os nós e mapeia IDs temporários para IDs do banco
    const nodeIdMap = new Map<string, string>()
    const nodes = await Promise.all(
      data.nodes.map(async (nodeData) => {
        const createdNode = await prisma.catalogNode.create({
          data: {
            catalogId: catalog.id,
            type: nodeData.type,
            positionX: nodeData.positionX,
            positionY: nodeData.positionY,
            data: nodeData.data,
          },
        })
        nodeIdMap.set(nodeData.id, createdNode.id)
        return createdNode
      })
    )

    // Cria as conexões usando os IDs reais do banco
    await Promise.all(
      data.edges.map(async (edgeData) => {
        const sourceId = nodeIdMap.get(edgeData.sourceNodeId) || edgeData.sourceNodeId
        const targetId = nodeIdMap.get(edgeData.targetNodeId) || edgeData.targetNodeId
        
        await prisma.catalogConnection.create({
          data: {
            catalogId: catalog.id,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            sourceHandle: edgeData.sourceHandle || null,
            targetHandle: edgeData.targetHandle || null,
          },
        })
      })
    )

    return NextResponse.json(catalog, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro ao criar catálogo:', error)
    return NextResponse.json(
      { error: 'Erro ao criar catálogo' },
      { status: 500 }
    )
  }
}

