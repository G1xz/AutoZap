import { prisma } from './prisma'
import { executeWorkflows, WhatsAppMessage } from './workflow-executor'
import { getLocaltunnelUrl } from './localtunnel'

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

    if (!instance || !instance.accessToken || !instance.phoneId) {
      throw new Error('Instância não configurada ou token ausente')
    }

    if (instance.status !== 'connected' && instance.status !== 'verified') {
      throw new Error('Instância não está conectada')
    }

    const phoneNumberId = instance.phoneId
    const accessToken = instance.accessToken

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

    if (!instance || !instance.accessToken || !instance.phoneId) {
      throw new Error('Instância não configurada ou token ausente')
    }

    if (instance.status !== 'connected' && instance.status !== 'verified') {
      throw new Error('Instância não está conectada')
    }

    const phoneNumberId = instance.phoneId
    const accessToken = instance.accessToken

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

    if (!instance || !instance.accessToken || !instance.phoneId) {
      throw new Error('Instância não configurada ou token ausente')
    }

    if (instance.status !== 'connected' && instance.status !== 'verified') {
      throw new Error('Instância não está conectada')
    }

    const phoneNumberId = instance.phoneId
    const accessToken = instance.accessToken

    // Remove caracteres não numéricos do número
    const cleanPhoneNumber = to.replace(/\D/g, '')

    // Formata o número para o formato internacional (ex: 5511999999999)
    const formattedPhone = cleanPhoneNumber.startsWith('55')
      ? cleanPhoneNumber
      : `55${cleanPhoneNumber}`

    // Converte URL relativa para absoluta
    let absoluteUrl = imageUrl
    if (imageUrl.startsWith('/')) {
      // Busca URL do localtunnel do usuário
      const tunnelUrl = getLocaltunnelUrl(instance.userId)
      const baseUrl = tunnelUrl || 
                     process.env.NEXT_PUBLIC_BASE_URL || 
                     process.env.VERCEL_URL || 
                     'http://localhost:3000'
      absoluteUrl = `${baseUrl}${imageUrl}`
      console.log(`📸 Enviando imagem: ${absoluteUrl}`)
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

    if (!instance || !instance.accessToken || !instance.phoneId) {
      throw new Error('Instância não configurada ou token ausente')
    }

    const phoneNumberId = instance.phoneId
    const accessToken = instance.accessToken

    const cleanPhoneNumber = to.replace(/\D/g, '')
    const formattedPhone = cleanPhoneNumber.startsWith('55')
      ? cleanPhoneNumber
      : `55${cleanPhoneNumber}`

    let absoluteUrl = videoUrl
    if (videoUrl.startsWith('/')) {
      const tunnelUrl = getLocaltunnelUrl(instance.userId)
      const baseUrl = tunnelUrl || 
                     process.env.NEXT_PUBLIC_BASE_URL || 
                     process.env.VERCEL_URL || 
                     'http://localhost:3000'
      absoluteUrl = `${baseUrl}${videoUrl}`
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

    if (!instance || !instance.accessToken || !instance.phoneId) {
      throw new Error('Instância não configurada ou token ausente')
    }

    const phoneNumberId = instance.phoneId
    const accessToken = instance.accessToken

    const cleanPhoneNumber = to.replace(/\D/g, '')
    const formattedPhone = cleanPhoneNumber.startsWith('55')
      ? cleanPhoneNumber
      : `55${cleanPhoneNumber}`

    let absoluteUrl = documentUrl
    if (documentUrl.startsWith('/')) {
      const tunnelUrl = getLocaltunnelUrl(instance.userId)
      const baseUrl = tunnelUrl || 
                     process.env.NEXT_PUBLIC_BASE_URL || 
                     process.env.VERCEL_URL || 
                     'http://localhost:3000'
      absoluteUrl = `${baseUrl}${documentUrl}`
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
        messageId: message.messageId,
      },
    })

    // Executa workflows de automação
    await executeWorkflows(instanceId, message)
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



