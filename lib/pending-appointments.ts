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
    console.log(`📅 [storePendingAppointment] Armazenando agendamento pendente para ${instanceId}-${contactNumber}`)
    console.log(`📅 [storePendingAppointment] Dados:`, JSON.stringify(data, null, 2))
    console.log(`📅 [storePendingAppointment] userId: ${userId}`)
    
    // Define expiração para 1 hora a partir de agora
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)
    
    // Usa upsert para garantir que só há um agendamento pendente por contato
    // Se já existir, atualiza; se não existir, cria
    const result = await prisma.pendingAppointment.upsert({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
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
        contactNumber,
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
    
    // Verifica se foi salvo corretamente
    const verification = await getPendingAppointment(instanceId, contactNumber)
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
    console.log(`🔍🔍🔍 [getPendingAppointment] ========== BUSCANDO AGENDAMENTO PENDENTE ==========`)
    console.log(`   instanceId: ${instanceId}`)
    console.log(`   contactNumber: ${contactNumber}`)
    
    // Busca TODOS os agendamentos pendentes para este contato (para debug)
    const allPending = await prisma.pendingAppointment.findMany({
      where: {
        instanceId,
        contactNumber,
      },
    })
    console.log(`🔍 [getPendingAppointment] Total de agendamentos pendentes encontrados: ${allPending.length}`)
    if (allPending.length > 0) {
      allPending.forEach((p, i) => {
        console.log(`   [${i + 1}] ID: ${p.id}, Data: ${p.date}, Hora: ${p.time}, Expira: ${p.expiresAt.toISOString()}`)
      })
    }
    
    // Tenta primeiro com findUnique (mais eficiente)
    let pending = await prisma.pendingAppointment.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
        },
      },
    })

    // Se não encontrou com findUnique, tenta com findFirst (pode haver problemas de formatação)
    if (!pending) {
      console.log(`⚠️ [getPendingAppointment] Não encontrado com findUnique, tentando findFirst...`)
      pending = await prisma.pendingAppointment.findFirst({
        where: {
          instanceId,
          contactNumber,
        },
      })
      
      if (pending) {
        console.log(`✅ [getPendingAppointment] Encontrado com findFirst!`)
      } else {
        console.log(`❌❌❌ [getPendingAppointment] NENHUM agendamento pendente encontrado`)
        console.log(`❌❌❌ [getPendingAppointment] Parâmetros usados:`)
        console.log(`   instanceId: "${instanceId}"`)
        console.log(`   contactNumber: "${contactNumber}"`)
        
        // Tenta buscar com busca parcial para debug
        const anyPending = await prisma.pendingAppointment.findFirst({
          where: {
            instanceId: {
              contains: instanceId,
            },
            contactNumber: {
              contains: contactNumber,
            },
          },
        })
        
        if (anyPending) {
          console.log(`⚠️⚠️⚠️ [getPendingAppointment] Encontrado agendamento com busca parcial:`)
          console.log(`   instanceId esperado: "${instanceId}", encontrado: "${anyPending.instanceId}"`)
          console.log(`   contactNumber esperado: "${contactNumber}", encontrado: "${anyPending.contactNumber}"`)
        }
        
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
    console.log(`🗑️ [clearPendingAppointment] Removendo agendamento pendente para ${instanceId}-${contactNumber}`)
    
    // Verifica se existe antes de remover
    const before = await prisma.pendingAppointment.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
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
          contactNumber,
        },
      },
    })
    
    // Verifica se foi removido corretamente
    const after = await prisma.pendingAppointment.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber,
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
