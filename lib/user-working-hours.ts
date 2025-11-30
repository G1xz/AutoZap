/**
 * Utilitários para buscar horários de funcionamento globais do usuário
 */

import { prisma } from './prisma'
import { WorkingHoursConfig } from './working-hours'

/**
 * Busca horários de funcionamento globais do usuário
 */
export async function getUserWorkingHours(userId: string): Promise<WorkingHoursConfig | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { workingHoursConfig: true },
    })

    if (!user?.workingHoursConfig) {
      return null
    }

    try {
      return JSON.parse(user.workingHoursConfig) as WorkingHoursConfig
    } catch (error) {
      console.error('Erro ao parsear workingHoursConfig do usuário:', error)
      return null
    }
  } catch (error) {
    console.error('Erro ao buscar horários de funcionamento do usuário:', error)
    return null
  }
}

