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

    console.log('🔍 Verificação webhook:', { mode, token: token ? '***' : null, challenge })

    // Verificação do webhook - tenta com token global ou busca em todas as instâncias
    // Opção 1: Token global (se configurado)
    const globalWebhookToken = process.env.WEBHOOK_VERIFY_TOKEN
    console.log('🔑 Token global configurado:', globalWebhookToken ? 'Sim' : 'Não')
    
    if (globalWebhookToken && verifyWebhook(mode, token, globalWebhookToken)) {
      console.log('✅ Verificação OK com token global')
      return new NextResponse(challenge, { status: 200 })
    }

    // Opção 2: Tenta verificar com qualquer instância que tenha o token correto
    // (útil se cada instância tiver seu próprio token)
    if (token) {
      console.log('🔍 Tentando verificar com token de instância...')
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { webhookVerifyToken: token },
      })

      if (instance && instance.webhookVerifyToken && verifyWebhook(mode, token, instance.webhookVerifyToken)) {
        console.log('✅ Verificação OK com token de instância:', instance.id)
        return new NextResponse(challenge, { status: 200 })
      } else {
        console.log('❌ Instância não encontrada ou token não corresponde')
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

    console.log('❌ Verificação falhou - token inválido ou não encontrado')
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
      let mediaUrl: string | null = null // URL da mídia (imagem, vídeo, etc)
      let interactiveData: string | null = null // Dados interativos (botões, etc)

      // Processa mídia recebida (imagem, vídeo, documento, áudio)
      if (msg.type === 'image' && msg.image?.id) {
        messageBody = msg.image.caption || '[Imagem]'
        messageType = 'image'
        // Baixa e salva a imagem no Cloudinary
        try {
          const { downloadAndSaveMedia } = await import('@/lib/whatsapp-cloud-api')
          mediaUrl = await downloadAndSaveMedia(instance.id, msg.image.id, 'image', instance.userId)
          console.log(`📸 Imagem recebida e salva no Cloudinary: ${mediaUrl}`)
        } catch (error) {
          console.error('Erro ao processar imagem recebida:', error)
        }
      } else if (msg.type === 'video' && msg.video?.id) {
        messageBody = msg.video.caption || '[Vídeo]'
        messageType = 'video'
        // Baixa e salva o vídeo no Cloudinary
        try {
          const { downloadAndSaveMedia } = await import('@/lib/whatsapp-cloud-api')
          mediaUrl = await downloadAndSaveMedia(instance.id, msg.video.id, 'video', instance.userId)
          console.log(`🎥 Vídeo recebido e salvo no Cloudinary: ${mediaUrl}`)
        } catch (error) {
          console.error('Erro ao processar vídeo recebido:', error)
        }
      } else if (msg.type === 'document' && msg.document?.id) {
        messageBody = msg.document.caption || `[Documento: ${msg.document.filename || 'arquivo'}]`
        messageType = 'document'
        // Baixa e salva o documento no Cloudinary
        try {
          const { downloadAndSaveMedia } = await import('@/lib/whatsapp-cloud-api')
          mediaUrl = await downloadAndSaveMedia(instance.id, msg.document.id, 'raw', instance.userId)
          console.log(`📄 Documento recebido e salvo no Cloudinary: ${mediaUrl}`)
        } catch (error) {
          console.error('Erro ao processar documento recebido:', error)
        }
      } else if (msg.type === 'audio' && msg.audio?.id) {
        messageBody = '[Áudio]'
        messageType = 'audio'
        // Baixa e salva o áudio no Cloudinary
        try {
          const { downloadAndSaveMedia } = await import('@/lib/whatsapp-cloud-api')
          mediaUrl = await downloadAndSaveMedia(instance.id, msg.audio.id, 'raw', instance.userId)
          console.log(`🎵 Áudio recebido e salvo no Cloudinary: ${mediaUrl}`)
        } catch (error) {
          console.error('Erro ao processar áudio recebido:', error)
        }
      }

      // Se for resposta de botão interativo
      if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
        const buttonId = msg.interactive.button_reply.id
        buttonTitle = msg.interactive.button_reply.title // Título do botão
        
        // Para exibição no chat, usa o título do botão
        // Para processamento do questionário, salva o buttonId no interactiveData
        messageBody = buttonTitle || buttonId // Prioriza título, fallback para ID
        
        // Se o buttonId não começar com "option-", tenta buscar na mensagem interativa original
        let actualButtonId = buttonId
        if (!buttonId.startsWith('option-')) {
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
              if (button && button.id && button.id.startsWith('option-')) {
                actualButtonId = button.id // Usa o ID do botão que começa com "option-"
              }
            } catch (e) {
              // Mantém o buttonId original
            }
          }
        } else {
          actualButtonId = buttonId
        }
        
        // Salva o buttonId no interactiveData para processamento do questionário
        // O título já está no messageBody para exibição
        interactiveData = JSON.stringify({
          buttonId: actualButtonId,
          buttonTitle: buttonTitle,
        })
        
        messageType = 'button'
        console.log(`🔘 Botão clicado: ID=${actualButtonId}, Título=${buttonTitle}, Exibição=${messageBody}`)
      }

      // Tenta obter o nome do contato do webhook
      const contactName = value.contacts?.[0]?.profile?.name || null

      // Salva informações do contato (nome e tenta buscar foto de perfil)
      if (contactName) {
        const { setContactInfo } = await import('@/lib/contacts')
        await setContactInfo(instance.id, msg.from, contactName)
      }

      // Tenta buscar foto de perfil em background (não bloqueia o processamento)
      // Nota: O WhatsApp Cloud API pode não ter endpoint para foto de perfil
      // Mas deixamos a função pronta para quando houver
      const { fetchAndSaveProfilePicture } = await import('@/lib/whatsapp-cloud-api')
      fetchAndSaveProfilePicture(instance.id, msg.from).catch((error) => {
        // Não é crítico se falhar - apenas loga
        console.log('ℹ️ Não foi possível buscar foto de perfil:', error)
      })

      await processIncomingMessage(instance.id, {
        from: msg.from,
        to: value.metadata?.display_phone_number || '',
        body: messageBody,
        messageId: msg.id,
        timestamp: parseInt(msg.timestamp),
        type: messageType,
        contactName: contactName,
        mediaUrl: mediaUrl || undefined, // URL da mídia salva no Cloudinary (se houver)
        interactiveData: interactiveData || undefined, // Dados interativos (botões, etc)
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

