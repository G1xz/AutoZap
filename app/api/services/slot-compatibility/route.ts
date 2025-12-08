import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserSlotConfig } from '@/lib/user-slot-config'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Busca configuração de slot do usuário
    const slotConfig = await getUserSlotConfig(session.user.id)
    const slotSize = slotConfig.slotSizeMinutes

    const incompatibleServices: Array<{
      name: string
      duration: number
      location: 'service' | 'catalog'
      catalogName?: string
    }> = []

    // Verifica serviços do modelo Service
    const services = await prisma.service.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: {
        name: true,
        // Nota: Service não tem campo duration diretamente, mas pode ter em workflows/catálogos
      },
    })

    // Verifica serviços nos catálogos (CatalogNodes)
    const catalogs = await prisma.catalog.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        nodes: true,
      },
    })

    for (const catalog of catalogs) {
      for (const node of catalog.nodes) {
        if (node.type === 'service') {
          try {
            const nodeData = JSON.parse(node.data)
            if (nodeData.requiresAppointment && nodeData.appointmentDuration) {
              const duration = Number(nodeData.appointmentDuration)
              if (duration > 0 && duration % slotSize !== 0) {
                incompatibleServices.push({
                  name: nodeData.name || 'Serviço sem nome',
                  duration: duration,
                  location: 'catalog',
                  catalogName: catalog.name,
                })
              }
            }
          } catch (error) {
            console.error('Erro ao parsear nó do catálogo:', error)
          }
        }
      }
    }

    // Verifica serviços nos workflows (aiBusinessDetails)
    const workflows = await prisma.workflow.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
        aiBusinessDetails: {
          not: null,
        },
      },
      select: {
        aiBusinessDetails: true,
      },
    })

    for (const workflow of workflows) {
      if (workflow.aiBusinessDetails) {
        try {
          const businessDetails = JSON.parse(workflow.aiBusinessDetails)
          const servicesWithAppointment = businessDetails.servicesWithAppointment || []
          
          for (const service of servicesWithAppointment) {
            if (service.duration && service.duration > 0 && service.duration % slotSize !== 0) {
              incompatibleServices.push({
                name: service.name || 'Serviço sem nome',
                duration: service.duration,
                location: 'service',
              })
            }
          }
        } catch (error) {
          console.error('Erro ao parsear aiBusinessDetails:', error)
        }
      }
    }

    return NextResponse.json({
      incompatibleServices,
      slotSize,
      totalIncompatible: incompatibleServices.length,
    })
  } catch (error) {
    console.error('Erro ao verificar compatibilidade de slots:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar compatibilidade' },
      { status: 500 }
    )
  }
}

