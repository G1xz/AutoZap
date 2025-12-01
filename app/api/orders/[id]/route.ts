import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const { id } = params
        const body = await request.json()
        const { status } = body

        // Valida se o status é válido
        const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'picked_up', 'cancelled']
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { error: 'Status inválido' },
                { status: 400 }
            )
        }

        // Verifica se o pedido pertence ao usuário
        const order = await prisma.order.findFirst({
            where: {
                id,
                userId: session.user.id,
            },
        })

        if (!order) {
            return NextResponse.json(
                { error: 'Pedido não encontrado' },
                { status: 404 }
            )
        }

        // Atualiza o status
        const updatedOrder = await prisma.order.update({
            where: { id },
            data: {
                status,
                // Se o status for delivered ou picked_up, marca como completado
                completedAt: ['delivered', 'picked_up'].includes(status)
                    ? new Date()
                    : order.completedAt,
            },
            include: {
                items: true,
                instance: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        })

        return NextResponse.json({ order: updatedOrder })
    } catch (error) {
        console.error('Erro ao atualizar pedido:', error)
        return NextResponse.json(
            { error: 'Erro ao atualizar pedido' },
            { status: 500 }
        )
    }
}
