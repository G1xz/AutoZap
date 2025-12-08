/**
 * Utilitários para buscar configuração de slots do usuário
 */

import { prisma } from './prisma'
import { SlotConfig } from './appointment-slots'

/**
 * Busca configuração de slots do usuário
 * Se não houver configuração, retorna valores padrão (15 minutos, sem buffer)
 */
export async function getUserSlotConfig(userId: string): Promise<SlotConfig> {
  try {
    // Tenta buscar slotConfig, mas se o campo não existir ainda (não fez migration), retorna padrão
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        slotConfig: true,
        // Tenta buscar outros campos para verificar se a query funciona
        id: true,
      },
    })

    if (!user) {
      // Retorna valores padrão se usuário não existe
      return {
        slotSizeMinutes: 15,
        bufferMinutes: 0,
      }
    }

    // Se slotConfig não existe ou é null, retorna padrão
    if (!user.slotConfig) {
      return {
        slotSizeMinutes: 15,
        bufferMinutes: 0,
      }
    }

    try {
      const config = JSON.parse(user.slotConfig) as SlotConfig
      // Garante valores mínimos
      return {
        slotSizeMinutes: config.slotSizeMinutes || 15,
        bufferMinutes: config.bufferMinutes || 0,
      }
    } catch (error) {
      console.error('Erro ao parsear slotConfig do usuário:', error)
      return {
        slotSizeMinutes: 15,
        bufferMinutes: 0,
      }
    }
  } catch (error: any) {
    // Se o erro for porque o campo não existe no banco de dados (P2022), retorna padrão
    if (
      error?.code === 'P2022' || 
      error?.name === 'PrismaClientValidationError' || 
      error?.message?.includes('Unknown arg') ||
      error?.message?.includes('does not exist') ||
      error?.message?.includes('slotConfig')
    ) {
      console.warn('⚠️ Campo slotConfig não existe ainda no banco de dados. Usando valores padrão.')
      return {
        slotSizeMinutes: 15,
        bufferMinutes: 0,
      }
    }
    
    console.error('Erro ao buscar configuração de slots do usuário:', error)
    return {
      slotSizeMinutes: 15,
      bufferMinutes: 0,
    }
  }
}

