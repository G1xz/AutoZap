/**
 * Sistema de agendamentos pendentes de confirmação
 * Agora usa uma tabela dedicada PendingAppointment no banco de dados
 */

import { prisma } from './prisma'

export interface PendingAppointmentData {
  date: string // Data formatada (DD/MM/YYYY)
  time: string // Hora formatada (HH:MM)
  duration?: number // Duração em minutos
  service: string // Nome do serviço
  description?: string
}

/**
 * Armazena um agendamento pendente de confirmação
 * Usa a tabela PendingAppointment - muito mais confiável que ConversationStatus
 */
export async function storePendingAppointment(
  instanceId: string,
  contactNumber: string,
  data: PendingAppointmentData,
  userId: string
): Promise<void> {
  try {
    // CRÍTICO: Normaliza o número para garantir consistência
    // Remove tudo que não é dígito e garante formato consistente
    const normalizedNumber = contactNumber.replace(/\D/g, '')
    
    console.log(`📅 [storePendingAppointment] Armazenando agendamento pendente para ${instanceId}-${contactNumber}`)
    console.log(`📅 [storePendingAppointment] Número original: "${contactNumber}"`)
    console.log(`📅 [storePendingAppointment] Número normalizado: "${normalizedNumber}"`)
    console.log(`📅 [storePendingAppointment] Dados:`, JSON.stringify(data, null, 2))
    console.log(`📅 [storePendingAppointment] userId: ${userId}`)
    
    // Define expiração para 1 hora a partir de agora
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)
    
    // Usa upsert para garantir que só há um agendamento pendente por contato
    // Se já existir, atualiza; se não existir, cria
    // CRÍTICO: Usa o número normalizado para garantir consistência
    const result = await prisma.pendingAppointment.upsert({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber: normalizedNumber, // Usa número normalizado
        },
      },
      update: {
        userId,
        date: data.date,
        time: data.time,
        duration: data.duration || null,
        service: data.service,
        description: data.description || null,
        expiresAt,
        createdAt: new Date(), // Atualiza a data de criação também
      },
      create: {
        userId,
        instanceId,
        contactNumber: normalizedNumber, // Usa número normalizado
        date: data.date,
        time: data.time,
        duration: data.duration || null,
        service: data.service,
        description: data.description || null,
        expiresAt,
      },
    })
    
    console.log(`✅ [storePendingAppointment] Agendamento pendente armazenado com SUCESSO`)
    console.log(`✅ [storePendingAppointment] ID: ${result.id}`)
    console.log(`✅ [storePendingAppointment] Expira em: ${expiresAt.toISOString()}`)
    
    // Verifica se foi salvo corretamente (usa número normalizado)
    const verification = await getPendingAppointment(instanceId, normalizedNumber)
    if (verification) {
      console.log(`✅ [storePendingAppointment] VERIFICAÇÃO: Agendamento pendente confirmado no banco`)
      console.log(`✅ [storePendingAppointment] Dados verificados:`, JSON.stringify(verification, null, 2))
    } else {
      console.error(`❌ [storePendingAppointment] ERRO: Agendamento pendente NÃO encontrado após salvar!`)
    }
  } catch (error) {
    console.error('❌ [storePendingAppointment] Erro ao armazenar agendamento pendente:', error)
    console.error('❌ [storePendingAppointment] Stack trace:', error instanceof Error ? error.stack : 'N/A')
    throw error // Propaga o erro para que o chamador saiba que falhou
  }
}

/**
 * Obtém um agendamento pendente
 * Retorna null se não encontrar ou se estiver expirado
 */
export async function getPendingAppointment(
  instanceId: string,
  contactNumber: string
): Promise<PendingAppointmentData | null> {
  try {
    // CRÍTICO: Normaliza o número ANTES de qualquer busca para garantir consistência
    const normalizedNumber = contactNumber.replace(/\D/g, '') // Remove tudo que não é dígito
    
    console.log(`🔍🔍🔍 [getPendingAppointment] ========== BUSCANDO AGENDAMENTO PENDENTE ==========`)
    console.log(`   instanceId: ${instanceId}`)
    console.log(`   contactNumber original: "${contactNumber}"`)
    console.log(`   contactNumber normalizado: "${normalizedNumber}"`)
    const withCountryCode = normalizedNumber.startsWith('55') ? normalizedNumber : `55${normalizedNumber}`
    const withoutCountryCode = normalizedNumber.startsWith('55') ? normalizedNumber.substring(2) : normalizedNumber
    
    // OTIMIZAÇÃO: Tenta primeiro com findUnique usando o número normalizado (formato padrão)
    // Esta é a busca mais rápida e eficiente (usa índice único)
    let pending = await prisma.pendingAppointment.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber: normalizedNumber, // Usa número normalizado
        },
      },
    })

    // OTIMIZAÇÃO: Se não encontrou, tenta apenas com formatos alternativos se necessário
    // (removido logs excessivos e queries de debug para melhorar performance)
    if (!pending) {
      // Tenta com código do país (se diferente do normalizado)
      if (withCountryCode !== normalizedNumber) {
        pending = await prisma.pendingAppointment.findFirst({
          where: {
            instanceId,
            contactNumber: withCountryCode,
          },
        })
      }
      
      // Tenta sem código do país (se diferente)
      if (!pending && withoutCountryCode !== normalizedNumber && withoutCountryCode !== withCountryCode) {
        pending = await prisma.pendingAppointment.findFirst({
          where: {
            instanceId,
            contactNumber: withoutCountryCode,
          },
        })
      }
      
      // Tenta com número original (se diferente do normalizado)
      if (!pending && contactNumber !== normalizedNumber) {
        pending = await prisma.pendingAppointment.findFirst({
          where: {
            instanceId,
            contactNumber: contactNumber,
          },
        })
      }
      
      if (!pending) {
        return null
      }
    }

    // Verifica se expirou
    if (new Date() > pending.expiresAt) {
      console.log(`⚠️ [getPendingAppointment] Agendamento pendente encontrado mas EXPIRADO (expirou em ${pending.expiresAt.toISOString()})`)
      // Remove o agendamento expirado
      await prisma.pendingAppointment.delete({
        where: {
          id: pending.id,
        },
      })
      console.log(`🗑️ [getPendingAppointment] Agendamento expirado removido`)
      return null
    }

    console.log(`✅ [getPendingAppointment] Agendamento pendente encontrado:`, {
      date: pending.date,
      time: pending.time,
      service: pending.service,
      expiresAt: pending.expiresAt.toISOString(),
    })

    return {
      date: pending.date,
      time: pending.time,
      duration: pending.duration || undefined,
      service: pending.service,
      description: pending.description || undefined,
    }
  } catch (error) {
    console.error('❌ [getPendingAppointment] Erro ao buscar agendamento pendente:', error)
    return null
  }
}

/**
 * Remove um agendamento pendente (após confirmar ou cancelar)
 */
export async function clearPendingAppointment(
  instanceId: string,
  contactNumber: string
): Promise<void> {
  try {
    // CRÍTICO: Normaliza o número para garantir consistência
    const normalizedNumber = contactNumber.replace(/\D/g, '')
    
    console.log(`🗑️ [clearPendingAppointment] Removendo agendamento pendente para ${instanceId}-${contactNumber}`)
    console.log(`🗑️ [clearPendingAppointment] Número original: "${contactNumber}"`)
    console.log(`🗑️ [clearPendingAppointment] Número normalizado: "${normalizedNumber}"`)
    
    // Verifica se existe antes de remover (usa número normalizado)
    const before = await prisma.pendingAppointment.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber: normalizedNumber, // Usa número normalizado
        },
      },
    })
    
    if (before) {
      console.log(`🗑️ [clearPendingAppointment] Agendamento pendente encontrado antes de remover:`, {
        date: before.date,
        time: before.time,
        service: before.service,
      })
    } else {
      console.log(`⚠️ [clearPendingAppointment] Nenhum agendamento pendente encontrado antes de remover`)
      return // Não há nada para remover
    }
    
    await prisma.pendingAppointment.delete({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber: normalizedNumber, // Usa número normalizado
        },
      },
    })
    
    // Verifica se foi removido corretamente (usa número normalizado)
    const after = await prisma.pendingAppointment.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber: normalizedNumber, // Usa número normalizado
        },
      },
    })
    
    if (!after) {
      console.log(`✅ [clearPendingAppointment] Agendamento pendente removido com SUCESSO`)
    } else {
      console.error(`❌ [clearPendingAppointment] ERRO: Agendamento pendente ainda existe após remover!`)
    }
  } catch (error) {
    console.error('❌ [clearPendingAppointment] Erro ao remover agendamento pendente:', error)
    console.error('❌ [clearPendingAppointment] Stack trace:', error instanceof Error ? error.stack : 'N/A')
    // Não propaga o erro - se falhar, não é crítico
  }
}

/**
 * Limpa agendamentos pendentes expirados (pode ser chamado periodicamente)
 */
export async function cleanupExpiredPendingAppointments(): Promise<number> {
  try {
    const now = new Date()
    const result = await prisma.pendingAppointment.deleteMany({
      where: {
        expiresAt: {
          lt: now, // Menor que agora = expirado
        },
      },
    })
    
    console.log(`🧹 [cleanupExpiredPendingAppointments] Removidos ${result.count} agendamentos pendentes expirados`)
    return result.count
  } catch (error) {
    console.error('❌ [cleanupExpiredPendingAppointments] Erro ao limpar agendamentos expirados:', error)
    return 0
  }
}
