import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface AppointmentService {
  name: string
  duration?: number | null
  imageUrl?: string | null
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const services: AppointmentService[] = []

    const workflow = await prisma.workflow.findFirst({
      where: {
        userId: session.user.id,
        isAIOnly: true,
      },
      select: {
        aiBusinessDetails: true,
      },
    })

    if (workflow?.aiBusinessDetails) {
      try {
        const details = JSON.parse(workflow.aiBusinessDetails)

        if (Array.isArray(details.servicesWithAppointment) && details.servicesWithAppointment.length > 0) {
          details.servicesWithAppointment.forEach((service: any) => {
            if (service?.name) {
              services.push({
                name: service.name,
                duration: service.duration ?? null,
                imageUrl: service.imageUrl ?? null,
              })
            }
          })
        } else if (details.catalogId) {
          const catalog = await prisma.catalog.findFirst({
            where: {
              id: details.catalogId,
              userId: session.user.id,
            },
            include: {
              nodes: true,
            },
          })

          if (catalog) {
            catalog.nodes.forEach((node: any) => {
              try {
                const nodeData = JSON.parse(node.data)
                if (node.type === 'service' && nodeData?.requiresAppointment && nodeData?.name) {
                  services.push({
                    name: nodeData.name,
                    duration: nodeData.appointmentDuration ?? null,
                    imageUrl: nodeData.imageUrl ?? null,
                  })
                }
              } catch (error) {
                console.error('Erro ao parsear nó do catálogo para serviços de agendamento:', error)
              }
            })
          }
        }
      } catch (error) {
        console.error('Erro ao parsear aiBusinessDetails para serviços de agendamento:', error)
      }
    }

    // Remove duplicados por nome
    const uniqueServices = services.filter(
      (service, index, self) => index === self.findIndex((s) => s.name === service.name)
    )

    return NextResponse.json({ services: uniqueServices })
  } catch (error) {
    console.error('Erro ao buscar serviços com agendamento:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar serviços com agendamento' },
      { status: 500 }
    )
  }
}

