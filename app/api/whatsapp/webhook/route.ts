import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyWebhook, processIncomingMessage } from '@/lib/whatsapp-cloud-api'

/**
 * GET - Verifica o webhook (requerido pelo WhatsApp)
 * POST - Recebe mensagens do WhatsApp
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    // Verificação do webhook - tenta com token global ou busca em todas as instâncias
    // Opção 1: Token global (se configurado)
    const globalWebhookToken = process.env.WEBHOOK_VERIFY_TOKEN
    
    if (globalWebhookToken && verifyWebhook(mode, token, globalWebhookToken)) {
      return new NextResponse(challenge, { status: 200 })
    }

    // Opção 2: Tenta verificar com qualquer instância que tenha o token correto
    // (útil se cada instância tiver seu próprio token)
    if (token) {
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { webhookVerifyToken: token },
      })

      if (instance && instance.webhookVerifyToken && verifyWebhook(mode, token, instance.webhookVerifyToken)) {
        return new NextResponse(challenge, { status: 200 })
      }
    }

    // Opção 3: Se passar instanceId como parâmetro (compatibilidade com versão antiga)
    const instanceId = searchParams.get('instanceId')
    if (instanceId) {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
      })

      if (instance && instance.webhookVerifyToken && verifyWebhook(mode, token, instance.webhookVerifyToken)) {
        return new NextResponse(challenge, { status: 200 })
      }
    }

    return NextResponse.json({ error: 'Token inválido' }, { status: 403 })
  } catch (error) {
    console.error('Erro ao verificar webhook:', error)
    return NextResponse.json({ error: 'Erro ao verificar webhook' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('📨 Webhook recebido:', JSON.stringify(body, null, 2))

    // WhatsApp envia notificações em um formato específico
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value) {
      console.log('⚠️ Sem value no webhook')
      return NextResponse.json({ success: true })
    }

    console.log('📱 Metadata:', value.metadata)

    // Processa mensagens recebidas
    const messages = value.messages || []
    console.log(`📬 Mensagens recebidas: ${messages.length}`)

    if (messages.length === 0) {
      console.log('⚠️ Nenhuma mensagem no webhook. Verificando status...')
      const statuses = value.statuses || []
      if (statuses.length > 0) {
        console.log('📊 Status recebidos:', statuses)
      }
      return NextResponse.json({ success: true })
    }

    for (const msg of messages) {
      console.log('📩 Processando mensagem:', msg)
      
      // Identifica a instância pelo número de telefone
      const phoneNumberId = value.metadata?.phone_number_id
      console.log(`🔍 Phone Number ID: ${phoneNumberId}`)
      
      if (!phoneNumberId) {
        console.log('⚠️ Phone Number ID não encontrado')
        continue
      }

      // Busca a instância pelo phoneId
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { phoneId: phoneNumberId },
      })

      if (!instance) {
        console.log(`❌ Instância não encontrada para phoneId: ${phoneNumberId}`)
        // Lista todos os phoneIds disponíveis para debug
        const allInstances = await prisma.whatsAppInstance.findMany({
          select: { id: true, phoneId: true, name: true },
        })
        console.log('📋 Instâncias disponíveis:', allInstances)
        continue
      }

      // Verifica se a instância está ativa
      if (!instance.active) {
        console.log(`⚠️ Instância ${instance.name} (${instance.id}) está desativada. Mensagem ignorada.`)
        return NextResponse.json({ success: true, message: 'Instância desativada' })
      }

      console.log(`✅ Instância encontrada: ${instance.name} (${instance.id})`)

      // Processa a mensagem
      // Verifica se é resposta de botão interativo
      let messageBody = msg.text?.body || ''
      let messageType = msg.type || 'text'
      let buttonTitle = null // Título do botão escolhido

      // Se for resposta de botão interativo
      if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
        const buttonId = msg.interactive.button_reply.id
        buttonTitle = msg.interactive.button_reply.title // Título do botão
        
        // Busca a mensagem interativa original para obter o texto do botão
        // Primeiro tenta usar o título que vem no webhook
        if (buttonTitle) {
          messageBody = buttonTitle // Usa o título do botão ao invés do ID
        } else {
          // Se não tiver título, busca na mensagem interativa mais recente
          const recentInteractiveMessage = await prisma.message.findFirst({
            where: {
              instanceId: instance.id,
              from: instance.phone || instance.phoneId || '',
              to: msg.from,
              messageType: 'interactive',
            },
            orderBy: { timestamp: 'desc' },
          })
          
          if (recentInteractiveMessage?.interactiveData) {
            try {
              const interactiveData = JSON.parse(recentInteractiveMessage.interactiveData)
              const button = interactiveData.buttons?.find((b: any) => b.id === buttonId)
              if (button) {
                messageBody = button.title
              } else {
                messageBody = buttonId // Fallback para o ID se não encontrar
              }
            } catch (e) {
              messageBody = buttonId // Fallback para o ID se erro ao parsear
            }
          } else {
            messageBody = buttonId // Fallback para o ID se não encontrar mensagem
          }
        }
        messageType = 'button'
      }

      // Tenta obter o nome do contato do webhook
      const contactName = value.contacts?.[0]?.profile?.name || null

      await processIncomingMessage(instance.id, {
        from: msg.from,
        to: value.metadata?.display_phone_number || '',
        body: messageBody,
        messageId: msg.id,
        timestamp: parseInt(msg.timestamp),
        type: messageType,
        contactName: contactName,
      })
    }

    // Processa status de mensagens (entregue, lida, etc.)
    const statuses = value.statuses || []
    // Aqui você pode processar status se necessário

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao processar webhook:', error)
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 })
  }
}

