import { prisma } from './prisma'
import { executeWorkflows, WhatsAppMessage } from './workflow-executor'
import { getBaseUrl } from './localtunnel'
import { getAccessToken } from './meta-config'

export type { WhatsAppMessage }

// WhatsApp Cloud API Base URL
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'

/**
 * Envia uma mensagem interativa com botões via WhatsApp Cloud API
 */
export async function sendWhatsAppInteractiveMessage(
  instanceId: string,
  to: string,
  message: string,
  buttons: Array<{ id: string; title: string }>
): Promise<boolean> {
  try {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || !instance.phoneId) {
      throw new Error('Instância não configurada ou phoneId ausente')
    }

    if (instance.status !== 'connected' && instance.status !== 'verified') {
      throw new Error('Instância não está conectada')
    }

    const phoneNumberId = instance.phoneId
    // 🔒 MODELO CHAKRA: Usa token fixo (você paga tudo)
    const accessToken = getAccessToken(instance.accessToken)

    // Remove caracteres não numéricos do número
    const cleanPhoneNumber = to.replace(/\D/g, '')

    // Formata o número para o formato internacional (ex: 5511999999999)
    const formattedPhone = cleanPhoneNumber.startsWith('55')
      ? cleanPhoneNumber
      : `55${cleanPhoneNumber}`

    const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`

    // Limita a 3 botões (limite do WhatsApp)
    const limitedButtons = buttons.slice(0, 3)

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: message,
        },
        action: {
          buttons: limitedButtons.map((btn) => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.title,
            },
          })),
        },
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Erro ao enviar mensagem interativa WhatsApp:', error)
      throw new Error(`Erro ao enviar mensagem: ${error.error?.message || 'Erro desconhecido'}`)
    }

    const data = await response.json()
    console.log('Mensagem interativa enviada com sucesso:', data)

    // Salva a mensagem no banco como enviada com dados dos botões
    try {
      await prisma.message.create({
        data: {
          instanceId,
          from: instance.phone || instance.phoneId || '',
          to: formattedPhone,
          body: message, // Mensagem com botões
          timestamp: new Date(),
          isFromMe: true,
          isGroup: false,
          messageType: 'interactive',
          interactiveData: JSON.stringify({
            buttons: limitedButtons.map(btn => ({
              id: btn.id,
              title: btn.title,
            })),
          }),
          messageId: data.messages?.[0]?.id || `interactive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
      })
    } catch (dbError) {
      console.error('Erro ao salvar mensagem interativa no banco:', dbError)
    }

    return true
  } catch (error) {
    console.error('Erro ao enviar mensagem interativa WhatsApp:', error)
    throw error
  }
}

/**
 * Envia uma mensagem via WhatsApp Cloud API
 */
export async function sendWhatsAppMessage(
  instanceId: string,
  to: string,
  message: string,
  messageType: 'service' | 'utility' | 'marketing' | 'authentication' = 'service'
): Promise<boolean> {
  try {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || !instance.phoneId) {
      throw new Error('Instância não configurada ou phoneId ausente')
    }

    // 🔒 PROTEÇÃO: Verificar se instância está ativa (cliente não cancelado)
    if (!instance.active) {
      throw new Error('Instância desativada. Contate o suporte para reativar.')
    }

    if (instance.status !== 'connected' && instance.status !== 'verified') {
      throw new Error('Instância não está conectada')
    }

    // 🔒 PROTEÇÃO: Resetar contador mensal se necessário
    const now = new Date()
    const lastReset = new Date(instance.lastResetDate)
    const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysSinceReset >= 30) {
      // Resetar contador mensal
      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: {
          messagesSentThisMonth: 0,
          lastResetDate: now,
        },
      })
      // Atualizar instância local
      instance.messagesSentThisMonth = 0
    }

    // 🔒 PROTEÇÃO: Verificar limite mensal
    if (instance.messagesSentThisMonth >= instance.monthlyLimit) {
      throw new Error(`Limite mensal de ${instance.monthlyLimit} mensagens excedido. Entre em contato para aumentar o limite.`)
    }

    const phoneNumberId = instance.phoneId
    // 🔒 MODELO CHAKRA: Usa token fixo (você paga tudo)
    const accessToken = getAccessToken(instance.accessToken)

    // Remove caracteres não numéricos do número
    const cleanPhoneNumber = to.replace(/\D/g, '')

    // Formata o número para o formato internacional (ex: 5511999999999)
    const formattedPhone = cleanPhoneNumber.startsWith('55')
      ? cleanPhoneNumber
      : `55${cleanPhoneNumber}`

    const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }

    // Adiciona o parâmetro de tipo de mensagem se necessário
    if (messageType !== 'service') {
      // Para mensagens que não são de serviço, pode ser necessário adicionar parâmetros específicos
      // Consulte a documentação da API para mais detalhes
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Erro ao enviar mensagem WhatsApp:', error)
      throw new Error(`Erro ao enviar mensagem: ${error.error?.message || 'Erro desconhecido'}`)
    }

    const data = await response.json()
    console.log('Mensagem enviada com sucesso:', data)

    // 🔒 PROTEÇÃO: Incrementar contador de mensagens após envio bem-sucedido
    try {
      await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: {
          messagesSentThisMonth: { increment: 1 },
        },
      })
    } catch (counterError) {
      console.error('Erro ao incrementar contador de mensagens:', counterError)
      // Não falha o envio se houver erro no contador
    }

    // Salva a mensagem no banco como enviada
    try {
      const savedMessage = await prisma.message.create({
        data: {
          instanceId,
          from: instance.phone || instance.phoneId || '', // Número da instância
          to: formattedPhone,
          body: message,
          timestamp: new Date(),
          isFromMe: true,
          isGroup: false,
          messageId: data.messages?.[0]?.id || `sent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
      })
      console.log(`✅ Mensagem enviada SALVA no banco: id=${savedMessage.id}, to=${formattedPhone}, isFromMe=${savedMessage.isFromMe}`)
    } catch (dbError) {
      // Loga erro mas não falha o envio se houver problema ao salvar
      console.error('❌ Erro ao salvar mensagem no banco:', dbError)
      console.error(`   Detalhes: instanceId=${instanceId}, to=${formattedPhone}, messageId=${data.messages?.[0]?.id}`)
    }

    return true
  } catch (error) {
    console.error('Erro ao enviar mensagem WhatsApp:', error)
    throw error
  }
}

/**
 * Envia uma imagem via WhatsApp Cloud API
 */
export async function sendWhatsAppImage(
  instanceId: string,
  to: string,
  imageUrl: string,
  caption?: string
): Promise<boolean> {
  try {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || !instance.phoneId) {
      throw new Error('Instância não configurada ou phoneId ausente')
    }

    if (instance.status !== 'connected' && instance.status !== 'verified') {
      throw new Error('Instância não está conectada')
    }

    const phoneNumberId = instance.phoneId
    // 🔒 MODELO CHAKRA: Usa token fixo (você paga tudo)
    const accessToken = getAccessToken(instance.accessToken)

    // Remove caracteres não numéricos do número
    const cleanPhoneNumber = to.replace(/\D/g, '')

    // Formata o número para o formato internacional (ex: 5511999999999)
    const formattedPhone = cleanPhoneNumber.startsWith('55')
      ? cleanPhoneNumber
      : `55${cleanPhoneNumber}`

    // Converte URL relativa para absoluta (compatibilidade com código antigo)
    // Se já for URL HTTPS (Cloudinary), usa diretamente
    let absoluteUrl = imageUrl
    if (imageUrl.startsWith('/')) {
      // URL relativa - converte para absoluta (fallback para código antigo)
      const { ensureLocaltunnelLoaded } = await import('./localtunnel')
      if (instance.userId) {
        await ensureLocaltunnelLoaded(instance.userId)
      }
      
      const baseUrl = getBaseUrl(instance.userId)
      absoluteUrl = `${baseUrl}${imageUrl}`
      console.log(`📸 Enviando imagem (URL relativa): ${absoluteUrl}`)
    } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // URL absoluta (Cloudinary ou outra) - usa diretamente
      console.log(`📸 Enviando imagem (URL absoluta): ${absoluteUrl}`)
    } else {
      throw new Error('URL de imagem inválida. Use URL completa (HTTPS) ou caminho relativo.')
    }

    const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'image',
      image: {
        link: absoluteUrl,
        caption: caption || '',
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Erro ao enviar imagem WhatsApp:', error)
      throw new Error(`Erro ao enviar imagem: ${error.error?.message || 'Erro desconhecido'}`)
    }

    const data = await response.json()
    console.log('Imagem enviada com sucesso:', data)

    // Salva a mensagem no banco como enviada
    try {
      await prisma.message.create({
        data: {
          instanceId,
          from: instance.phone || instance.phoneId || '',
          to: formattedPhone,
          body: caption || '[Imagem]',
          timestamp: new Date(),
          isFromMe: true,
          isGroup: false,
          messageId: data.messages?.[0]?.id || `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
      })
    } catch (dbError) {
      console.error('Erro ao salvar imagem no banco:', dbError)
    }

    return true
  } catch (error) {
    console.error('Erro ao enviar imagem WhatsApp:', error)
    throw error
  }
}

/**
 * Envia um vídeo via WhatsApp Cloud API
 */
export async function sendWhatsAppVideo(
  instanceId: string,
  to: string,
  videoUrl: string,
  caption?: string
): Promise<boolean> {
  try {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || !instance.phoneId) {
      throw new Error('Instância não configurada ou phoneId ausente')
    }

    const phoneNumberId = instance.phoneId
    // 🔒 MODELO CHAKRA: Usa token fixo (você paga tudo)
    const accessToken = getAccessToken(instance.accessToken)

    const cleanPhoneNumber = to.replace(/\D/g, '')
    const formattedPhone = cleanPhoneNumber.startsWith('55')
      ? cleanPhoneNumber
      : `55${cleanPhoneNumber}`

    // Converte URL relativa para absoluta (compatibilidade com código antigo)
    // Se já for URL HTTPS (Cloudinary), usa diretamente
    let absoluteUrl = videoUrl
    if (videoUrl.startsWith('/')) {
      // URL relativa - converte para absoluta (fallback para código antigo)
      const { ensureLocaltunnelLoaded } = await import('./localtunnel')
      if (instance.userId) {
        await ensureLocaltunnelLoaded(instance.userId)
      }
      
      const baseUrl = getBaseUrl(instance.userId)
      absoluteUrl = `${baseUrl}${videoUrl}`
      console.log(`🎥 Enviando vídeo (URL relativa): ${absoluteUrl}`)
    } else if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      // URL absoluta (Cloudinary ou outra) - usa diretamente
      console.log(`🎥 Enviando vídeo (URL absoluta): ${absoluteUrl}`)
    } else {
      throw new Error('URL de vídeo inválida. Use URL completa (HTTPS) ou caminho relativo.')
    }

    const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'video',
      video: {
        link: absoluteUrl,
        caption: caption || '',
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Erro ao enviar vídeo WhatsApp:', error)
      throw new Error(`Erro ao enviar vídeo: ${error.error?.message || 'Erro desconhecido'}`)
    }

    const data = await response.json()

    // Salva a mensagem no banco como enviada
    try {
      await prisma.message.create({
        data: {
          instanceId,
          from: instance.phone || instance.phoneId || '',
          to: formattedPhone,
          body: caption || '[Vídeo]',
          timestamp: new Date(),
          isFromMe: true,
          isGroup: false,
          messageId: data.messages?.[0]?.id || `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
      })
    } catch (dbError) {
      console.error('Erro ao salvar vídeo no banco:', dbError)
    }

    return true
  } catch (error) {
    console.error('Erro ao enviar vídeo WhatsApp:', error)
    throw error
  }
}

/**
 * Envia um documento via WhatsApp Cloud API
 */
export async function sendWhatsAppDocument(
  instanceId: string,
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
): Promise<boolean> {
  try {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || !instance.phoneId) {
      throw new Error('Instância não configurada ou phoneId ausente')
    }

    const phoneNumberId = instance.phoneId
    // 🔒 MODELO CHAKRA: Usa token fixo (você paga tudo)
    const accessToken = getAccessToken(instance.accessToken)

    const cleanPhoneNumber = to.replace(/\D/g, '')
    const formattedPhone = cleanPhoneNumber.startsWith('55')
      ? cleanPhoneNumber
      : `55${cleanPhoneNumber}`

    // Converte URL relativa para absoluta (compatibilidade com código antigo)
    // Se já for URL HTTPS (Cloudinary), usa diretamente
    let absoluteUrl = documentUrl
    if (documentUrl.startsWith('/')) {
      // URL relativa - converte para absoluta (fallback para código antigo)
      const { ensureLocaltunnelLoaded } = await import('./localtunnel')
      if (instance.userId) {
        await ensureLocaltunnelLoaded(instance.userId)
      }
      
      const baseUrl = getBaseUrl(instance.userId)
      absoluteUrl = `${baseUrl}${documentUrl}`
      console.log(`📄 Enviando documento (URL relativa): ${absoluteUrl}`)
    } else if (documentUrl.startsWith('http://') || documentUrl.startsWith('https://')) {
      // URL absoluta (Cloudinary ou outra) - usa diretamente
      console.log(`📄 Enviando documento (URL absoluta): ${absoluteUrl}`)
    } else {
      throw new Error('URL de documento inválida. Use URL completa (HTTPS) ou caminho relativo.')
    }

    const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'document',
      document: {
        link: absoluteUrl,
        caption: caption || '',
        filename: filename,
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Erro ao enviar documento WhatsApp:', error)
      throw new Error(`Erro ao enviar documento: ${error.error?.message || 'Erro desconhecido'}`)
    }

    const data = await response.json()

    // Salva a mensagem no banco como enviada
    try {
      await prisma.message.create({
        data: {
          instanceId,
          from: instance.phone || instance.phoneId || '',
          to: formattedPhone,
          body: caption || `[Documento: ${filename}]`,
          timestamp: new Date(),
          isFromMe: true,
          isGroup: false,
          messageId: data.messages?.[0]?.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
      })
    } catch (dbError) {
      console.error('Erro ao salvar documento no banco:', dbError)
    }

    return true
  } catch (error) {
    console.error('Erro ao enviar documento WhatsApp:', error)
    throw error
  }
}

/**
 * Busca o nome do usuário usando a API do WhatsApp Cloud API
 * Nota: O WhatsApp Cloud API não fornece um endpoint direto para buscar o nome
 * O nome geralmente vem no webhook quando o usuário envia mensagem
 * Esta função retorna null e esperamos que o nome venha do webhook
 */
export async function getUserProfileName(
  instanceId: string,
  phoneNumber: string
): Promise<string | null> {
  // O WhatsApp Cloud API não fornece um endpoint público para buscar o nome do usuário
  // O nome deve vir do webhook quando o usuário envia mensagem (campo contacts[0].profile.name)
  // Por isso, retornamos null aqui e esperamos que o nome venha do webhook
  return null
}

/**
 * Baixa mídia do WhatsApp e salva no Cloudinary
 */
export async function downloadAndSaveMedia(
  instanceId: string,
  mediaId: string,
  mediaType: 'image' | 'video' | 'raw',
  userId?: string | null
): Promise<string> {
  try {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance || !instance.phoneId) {
      throw new Error('Instância não configurada')
    }

    // 🔒 MODELO CHAKRA: Usa token fixo (você paga tudo)
    const accessToken = getAccessToken(instance.accessToken)

    // Obtém URL de download da mídia
    // A API do WhatsApp requer o phoneNumberId para baixar mídia
    const mediaUrl = `${WHATSAPP_API_URL}/${instance.phoneId}/media/${mediaId}`
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!mediaResponse.ok) {
      const error = await mediaResponse.json()
      throw new Error(`Erro ao obter URL de mídia: ${error.error?.message || 'Erro desconhecido'}`)
    }

    const mediaData = await mediaResponse.json()
    const downloadUrl = mediaData.url

    if (!downloadUrl) {
      throw new Error('URL de download não encontrada na resposta')
    }

    // Baixa o arquivo (a URL já é pública, mas pode precisar do token)
    const fileResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!fileResponse.ok) {
      throw new Error('Erro ao baixar arquivo da mídia')
    }

    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer())

    // Faz upload para Cloudinary
    const { uploadFileToCloudinary } = await import('./cloudinary')
    const folder = userId ? `autozap/${userId}/received` : 'autozap/received'
    const uploadResult = await uploadFileToCloudinary(
      fileBuffer,
      `${mediaId}.${mediaData.mime_type?.split('/')[1] || 'bin'}`,
      folder,
      mediaType
    )

    console.log(`✅ Mídia salva no Cloudinary: ${uploadResult.secure_url}`)
    return uploadResult.secure_url
  } catch (error) {
    console.error('Erro ao baixar e salvar mídia:', error)
    throw error
  }
}

/**
 * Verifica se o webhook é válido (usado na configuração inicial)
 */
export function verifyWebhook(
  mode: string | null,
  token: string | null,
  verifyToken: string
): boolean {
  return mode === 'subscribe' && token === verifyToken
}

/**
 * Processa mensagens recebidas via webhook
 */
export async function processIncomingMessage(
  instanceId: string,
  message: WhatsAppMessage
): Promise<void> {
  try {
    // Salva o nome do contato se disponível
    if (message.contactName) {
      const { setContactName } = await import('./contacts')
      setContactName(instanceId, message.from, message.contactName)
    }

    // Garante que a conversa tem um status (padrão: active)
    const { ensureConversationStatus } = await import('./conversation-status')
    await ensureConversationStatus(instanceId, message.from)

    // Salva a mensagem no banco
    await prisma.message.create({
      data: {
        instanceId,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: new Date(message.timestamp * 1000),
        isFromMe: false,
        isGroup: false, // A API Cloud não suporta grupos da mesma forma
        messageType: message.type || 'text',
        messageId: message.messageId,
        mediaUrl: message.mediaUrl || null, // URL da mídia salva no Cloudinary (se houver)
      },
    })

    // Verifica se a mensagem contém um gatilho de workflow
    const { getConversationStatus, updateConversationStatus } = await import('./conversation-status')
    const { executeWorkflows } = await import('./workflow-executor')
    const status = await getConversationStatus(instanceId, message.from)
    
    // Busca workflows ativos para verificar se a mensagem contém algum gatilho
    const workflows = await prisma.workflow.findMany({
      where: {
        isActive: true,
        OR: [
          { instanceId: null },
          { instanceId },
        ],
      },
      select: { trigger: true },
    })
    
    const messageBody = message.body.toLowerCase().trim()
    const hasTrigger = workflows.some(w => messageBody.includes(w.trigger.toLowerCase().trim()))
    
    // Se a conversa está encerrada mas a mensagem contém um gatilho, reinicia a conversa
    if (status === 'closed' && hasTrigger) {
      console.log(`🔄 Conversa encerrada, mas gatilho detectado. Reiniciando conversa para ${message.from}`)
      await updateConversationStatus(instanceId, message.from, 'active')
      await executeWorkflows(instanceId, message)
    } else if (status !== 'closed') {
      await executeWorkflows(instanceId, message)
    } else {
      console.log(`⚠️ Conversa encerrada, ignorando workflow para ${message.from}`)
    }
  } catch (error) {
    console.error('Erro ao processar mensagem recebida:', error)
  }
}

// Função checkAutomationRules removida - agora usamos executeWorkflows

/**
 * Obtém informações sobre a instância
 */
export async function getInstanceInfo(instanceId: string) {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      name: true,
      phone: true,
      phoneId: true,
      status: true,
      createdAt: true,
    },
  })

  return instance
}



