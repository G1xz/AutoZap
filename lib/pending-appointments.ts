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
    
    console.log(`🔍 [getPendingAppointment] Formatos de número a tentar:`)
    console.log(`   Original: "${contactNumber}"`)
    console.log(`   Normalizado: "${normalizedNumber}"`)
    console.log(`   Com código país: "${withCountryCode}"`)
    console.log(`   Sem código país: "${withoutCountryCode}"`)
    
    // Busca TODOS os agendamentos pendentes para esta instância (para debug completo)
    const allPendingForInstance = await prisma.pendingAppointment.findMany({
      where: {
        instanceId,
      },
    })
    console.log(`🔍 [getPendingAppointment] Total de agendamentos pendentes para esta instância: ${allPendingForInstance.length}`)
    if (allPendingForInstance.length > 0) {
      allPendingForInstance.forEach((p, i) => {
        console.log(`   [${i + 1}] contactNumber: "${p.contactNumber}", Data: ${p.date}, Hora: ${p.time}, Expira: ${p.expiresAt.toISOString()}`)
      })
    }
    
    // Busca TODOS os agendamentos pendentes para este contato (para debug) - usa número normalizado
    const allPending = await prisma.pendingAppointment.findMany({
      where: {
        instanceId,
        contactNumber: normalizedNumber, // Usa número normalizado
      },
    })
    console.log(`🔍 [getPendingAppointment] Total de agendamentos pendentes encontrados com contactNumber exato: ${allPending.length}`)
    
    // Tenta primeiro com findUnique usando o número normalizado (formato padrão)
    let pending = await prisma.pendingAppointment.findUnique({
      where: {
        instanceId_contactNumber: {
          instanceId,
          contactNumber: normalizedNumber, // Usa número normalizado
        },
      },
    })

    // Se não encontrou, tenta com diferentes formatos do número
    if (!pending) {
      console.log(`⚠️ [getPendingAppointment] Não encontrado com número original, tentando formatos alternativos...`)
      
      // Se ainda não encontrou, tenta com outros formatos (para compatibilidade com dados antigos)
      // Tenta com código do país
      if (!pending && withCountryCode !== normalizedNumber) {
        pending = await prisma.pendingAppointment.findFirst({
          where: {
            instanceId,
            contactNumber: withCountryCode,
          },
        })
        if (pending) {
          console.log(`✅ [getPendingAppointment] Encontrado com código do país!`)
        }
      }
      
      // Tenta sem código do país
      if (!pending && withoutCountryCode !== normalizedNumber && withoutCountryCode !== withCountryCode) {
        pending = await prisma.pendingAppointment.findFirst({
          where: {
            instanceId,
            contactNumber: withoutCountryCode,
          },
        })
        if (pending) {
          console.log(`✅ [getPendingAppointment] Encontrado sem código do país!`)
        }
      }
      
      // Tenta com número original (caso tenha sido salvo com formatação)
      if (!pending && contactNumber !== normalizedNumber) {
        pending = await prisma.pendingAppointment.findFirst({
          where: {
            instanceId,
            contactNumber: contactNumber,
          },
        })
        if (pending) {
          console.log(`✅ [getPendingAppointment] Encontrado com número original!`)
        }
      }
      
      if (!pending) {
        console.log(`❌❌❌ [getPendingAppointment] NENHUM agendamento pendente encontrado após tentar todos os formatos`)
        console.log(`❌❌❌ [getPendingAppointment] Parâmetros usados:`)
        console.log(`   instanceId: "${instanceId}"`)
        console.log(`   contactNumber original: "${contactNumber}"`)
        console.log(`   contactNumber normalizado: "${normalizedNumber}"`)
        console.log(`   contactNumber com código: "${withCountryCode}"`)
        console.log(`   contactNumber sem código: "${withoutCountryCode}"`)
        
        // Busca todos os agendamentos pendentes da instância para comparar
        if (allPendingForInstance.length > 0) {
          console.log(`⚠️⚠️⚠️ [getPendingAppointment] Agendamentos pendentes encontrados para esta instância (mas com contactNumber diferente):`)
          allPendingForInstance.forEach((p, i) => {
            const pNormalized = p.contactNumber.replace(/\D/g, '')
            const pWithCode = pNormalized.startsWith('55') ? pNormalized : `55${pNormalized}`
            const pWithoutCode = pNormalized.startsWith('55') ? pNormalized.substring(2) : pNormalized
            
            const matches = 
              p.contactNumber === contactNumber ||
              p.contactNumber === normalizedNumber ||
              p.contactNumber === withCountryCode ||
              p.contactNumber === withoutCountryCode ||
              pNormalized === normalizedNumber ||
              pWithCode === withCountryCode ||
              pWithoutCode === withoutCountryCode
            
            console.log(`   [${i + 1}] contactNumber: "${p.contactNumber}" (normalizado: "${pNormalized}") ${matches ? '✅ PODE SER O MESMO!' : '❌'}`)
          })
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
