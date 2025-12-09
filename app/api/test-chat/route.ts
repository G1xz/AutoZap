import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { setTestMode, processIncomingMessage } from '@/lib/whatsapp-cloud-api'

// Captura logs do console
const capturedLogs: string[] = []

// Intercepta console.log temporariamente
function captureLogs(callback: () => Promise<void>): Promise<string[]> {
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn
  
  capturedLogs.length = 0 // Limpa logs anteriores
  
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    capturedLogs.push(`[LOG] ${message}`)
    originalLog.apply(console, args)
  }
  
  console.error = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    capturedLogs.push(`[ERROR] ${message}`)
    originalError.apply(console, args)
  }
  
  console.warn = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    capturedLogs.push(`[WARN] ${message}`)
    originalWarn.apply(console, args)
  }
  
  return callback().finally(() => {
    console.log = originalLog
    console.error = originalError
    console.warn = originalWarn
  }).then(() => [...capturedLogs])
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { contactNumber, contactName, message } = body

    if (!contactNumber || !message) {
      return NextResponse.json(
        { error: 'contactNumber e message são obrigatórios' },
        { status: 400 }
      )
    }

    // Busca automaticamente a primeira instância do usuário (ou cria uma temporária para teste)
    let instance
    try {
      instance = await prisma.whatsAppInstance.findFirst({
        where: { userId: session.user.id },
        select: { id: true, userId: true },
      })
    } catch (dbError: any) {
      console.error('Erro ao buscar instância:', dbError)
      return NextResponse.json(
        {
          error: 'Erro de conexão com o banco de dados. Tente novamente em alguns instantes.',
          details: dbError.message,
        },
        { status: 503 }
      )
    }

    // Se não tiver instância, cria uma temporária apenas para teste
    if (!instance) {
      try {
        instance = await prisma.whatsAppInstance.create({
          data: {
            userId: session.user.id,
            name: 'Test Chat Instance',
            phoneId: 'test-phone-id',
            phone: contactNumber,
            accessToken: 'test-token',
            status: 'active',
          },
          select: { id: true, userId: true },
        })
      } catch (dbError: any) {
        console.error('Erro ao criar instância temporária:', dbError)
        return NextResponse.json(
          {
            error: 'Erro de conexão com o banco de dados. Tente novamente em alguns instantes.',
            details: dbError.message,
          },
          { status: 503 }
        )
      }
    }

    const instanceId = instance.id

    // Busca todos os workflows IA-only ativos para esta instância
    let workflows: any[] = []
    try {
      workflows = await prisma.workflow.findMany({
        where: {
          userId: session.user.id,
          isActive: true,
          isAIOnly: true,
          OR: [
            { instanceId: null },
            { instanceId },
          ],
        },
        orderBy: { createdAt: 'desc' },
      })
    } catch (dbError: any) {
      console.error('Erro ao buscar workflows:', dbError)
      return NextResponse.json(
        {
          error: 'Erro de conexão com o banco de dados. Tente novamente em alguns instantes.',
          details: dbError.message,
        },
        { status: 503 }
      )
    }

    // Normaliza a mensagem para verificar triggers
    const messageLower = message.toLowerCase().trim()
    
    // Procura workflow cujo trigger está na mensagem
    let workflow = workflows.find(w => {
      const trigger = (w.trigger || '').toLowerCase().trim()
      return trigger && messageLower.includes(trigger)
    })

    // Se não encontrou por trigger, usa o primeiro workflow IA-only encontrado
    if (!workflow && workflows.length > 0) {
      workflow = workflows[0]
      console.log(`[test-chat] Usando primeiro workflow IA-only encontrado: ${workflow.id} - ${workflow.name}`)
    }

    // Se não tiver workflow, cria um temporário para teste
    if (!workflow) {
      console.log(`[test-chat] Criando workflow temporário para teste`)
      try {
        workflow = await prisma.workflow.create({
          data: {
            userId: session.user.id,
            name: 'Test Chat - IA Only',
            trigger: 'message',
            isActive: true,
            isAIOnly: true,
            instanceId,
            aiBusinessDetails: JSON.stringify({
              businessName: 'Loja de Teste',
              businessDescription: 'Esta é uma loja de teste para o chat de desenvolvimento',
              products: [],
              services: [],
            }),
          },
        })
        console.log(`[test-chat] Workflow criado: ${workflow.id}`)
      } catch (dbError: any) {
        console.error('Erro ao criar workflow temporário:', dbError)
        return NextResponse.json(
          {
            error: 'Erro de conexão com o banco de dados. Tente novamente em alguns instantes.',
            details: dbError.message,
          },
          { status: 503 }
        )
      }
    } else {
      const triggerMatch = workflows.find(w => {
        const trigger = (w.trigger || '').toLowerCase().trim()
        return trigger && messageLower.includes(trigger)
      })
      
      if (triggerMatch) {
        console.log(`[test-chat] Workflow encontrado por trigger "${triggerMatch.trigger}": ${workflow.id} - ${workflow.name}`)
      } else {
        console.log(`[test-chat] Workflow encontrado (primeiro IA-only): ${workflow.id} - ${workflow.name}`)
      }
    }

    // Normaliza o número de contato (mesma lógica do WhatsApp)
    const normalizedContact = contactNumber.replace(/\D/g, '')
    const formattedPhone = normalizedContact.startsWith('55')
      ? normalizedContact
      : `55${normalizedContact}`

    // Busca o número da instância para usar como "to"
    let instancePhone = instanceId
    try {
      const instanceData = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
        select: { phone: true, phoneId: true },
      })
      instancePhone = instanceData?.phone || instanceData?.phoneId || instanceId
    } catch (dbError: any) {
      console.error('Erro ao buscar dados da instância:', dbError)
      // Continua com instanceId como fallback
    }

    // Cria mensagem simulada do WhatsApp (mesmo formato que o webhook recebe)
    const whatsappMessage = {
      from: formattedPhone,
      to: instancePhone,
      body: message,
      messageId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Math.floor(Date.now() / 1000), // Timestamp em segundos (como o WhatsApp envia)
      type: 'text' as const,
      contactName: contactName || 'Teste',
    }

    // ATIVA MODO DE TESTE: Faz com que as funções do WhatsApp apenas salvem no banco
    setTestMode(true)
    
    // Processa a mensagem capturando logs (USA A MESMA FUNÇÃO DO WHATSAPP!)
    let logs: string[] = []
    try {
      logs = await captureLogs(async () => {
        // USA EXATAMENTE A MESMA FUNÇÃO QUE O WHATSAPP USA!
        await processIncomingMessage(instanceId, whatsappMessage)
        
        // Aguarda um pouco para garantir que todos os logs sejam capturados
        await new Promise(resolve => setTimeout(resolve, 500))
      })
    } catch (error) {
      console.error('Erro ao processar mensagem:', error)
      logs.push(`[ERROR] Erro ao processar mensagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
      logs.push(`[ERROR] Stack: ${error instanceof Error ? error.stack : 'N/A'}`)
    } finally {
      // DESATIVA MODO DE TESTE após processar
      setTestMode(false)
    }

    // Aguarda um pouco para garantir que a mensagem foi salva no banco
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Busca a resposta mais recente do banco (última mensagem enviada pela IA)
    let response = 'Nenhuma resposta gerada. Verifique os logs para mais detalhes.'
    let mediaUrl: string | null = null
    try {
      // Busca as últimas 2 mensagens (pode ter imagem + texto)
      const recentMessages = await prisma.message.findMany({
        where: {
          instanceId,
          to: formattedPhone,
          isFromMe: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 2,
      })
      
      if (recentMessages.length > 0) {
        // Pega a mensagem mais recente (texto)
        const latestMessage = recentMessages[0]
        response = latestMessage.body || response
        
        // Se a mensagem mais recente tem imagem, usa ela
        // Senão, verifica se a mensagem anterior (segunda mais recente) tem imagem
        if (latestMessage.mediaUrl) {
          mediaUrl = latestMessage.mediaUrl
        } else if (recentMessages.length > 1 && recentMessages[1].mediaUrl) {
          // Se a mensagem anterior tem imagem e foi enviada há menos de 5 segundos, associa à resposta atual
          const timeDiff = latestMessage.timestamp.getTime() - recentMessages[1].timestamp.getTime()
          if (timeDiff < 5000) { // 5 segundos
            mediaUrl = recentMessages[1].mediaUrl
          }
        }
      }
    } catch (dbError: any) {
      console.error('Erro ao buscar resposta do banco:', dbError)
      // Continua com mensagem padrão
    }

    // Filtra logs relevantes (apenas os que contêm palavras-chave importantes)
    const relevantLogs = logs.filter(log => 
      log.includes('add_to_cart') ||
      log.includes('remove_from_cart') ||
      log.includes('update_cart_item_quantity') ||
      log.includes('view_cart') ||
      log.includes('checkout') ||
      log.includes('clear_cart') ||
      log.includes('interceptedFunctionCall') ||
      log.includes('handleFunctionCall') ||
      log.includes('getCart') ||
      log.includes('addToCart') ||
      log.includes('removeFromCart') ||
      log.includes('updateCartItemQuantity') ||
      log.includes('executeAIOnlyWorkflow') ||
      log.includes('ERROR') ||
      log.includes('WARN')
    )

    return NextResponse.json({
      success: true,
      response,
      mediaUrl, // URL da imagem se houver
      logs: relevantLogs.slice(-50), // Últimos 50 logs relevantes
    })
  } catch (error) {
    console.error('Erro no chat de teste:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        logs: capturedLogs.slice(-20),
      },
      { status: 500 }
    )
  }
}

