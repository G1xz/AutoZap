import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { nodeId } = await params

    const node = await prisma.catalogNode.findFirst({
      where: {
        id: nodeId,
        catalog: {
          userId: session.user.id,
        },
      },
      include: {
        catalog: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!node) {
      return NextResponse.json({ error: 'Nó do catálogo não encontrado' }, { status: 404 })
    }

    // Parse do JSON data para extrair imageUrl
    let imageUrl: string | null = null
    try {
      const nodeData = JSON.parse(node.data)
      imageUrl = nodeData.imageUrl || null
    } catch (error) {
      console.error('Erro ao parsear dados do nó:', error)
    }

    return NextResponse.json({
      id: node.id,
      type: node.type,
      imageUrl,
    })
  } catch (error) {
    console.error('Erro ao buscar nó do catálogo:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar nó do catálogo' },
      { status: 500 }
    )
  }
}

