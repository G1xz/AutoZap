import { Client, LocalAuth } from 'whatsapp-web.js'
import { prisma } from './prisma'

const clients = new Map<string, Client>()

export async function getWhatsAppClient(instanceId: string): Promise<Client | null> {
  const instance = await prisma.whatsAppInstance.findUnique({
    where: { id: instanceId }
  })

  if (!instance) {
    return null
  }

  // Se já existe um cliente ativo, retorna ele
  if (clients.has(instanceId)) {
    return clients.get(instanceId)!
  }

  // Cria novo cliente
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: instance.sessionId,
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    },
  })

  client.on('qr', async (qr) => {
    console.log('QR Code recebido para instância:', instanceId)
    console.log('Escaneie o QR Code na interface web do dashboard')
    
    // Salva QR code no banco
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: { 
        status: 'qr_code',
        qrCode: qr,
      },
    })
  })

  client.on('ready', async () => {
    console.log('WhatsApp conectado para instância:', instanceId)
    const info = client.info
    
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: {
        status: 'connected',
        phone: info?.wid?.user || null,
        qrCode: null,
      },
    })
  })

  client.on('authenticated', () => {
    console.log('Autenticado para instância:', instanceId)
  })

  client.on('auth_failure', async (msg) => {
    console.error('Falha na autenticação para instância:', instanceId, msg)
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: { status: 'disconnected' },
    })
    clients.delete(instanceId)
  })

  client.on('disconnected', async (reason) => {
    console.log('Desconectado da instância:', instanceId, reason)
    await prisma.whatsAppInstance.update({
      where: { id: instanceId },
      data: { status: 'disconnected' },
    })
    clients.delete(instanceId)
  })

  client.on('message', async (msg) => {
    // Processa mensagens recebidas
    await handleIncomingMessage(instanceId, msg)
  })

  clients.set(instanceId, client)
  
  // Inicia o cliente
  await client.initialize()

  return client
}

async function handleIncomingMessage(instanceId: string, msg: any) {
  try {
    // Salva a mensagem no banco
    const contact = await msg.getContact()
    const chat = await msg.getChat()
    
    await prisma.message.create({
      data: {
        instanceId,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        timestamp: new Date(msg.timestamp * 1000),
        isFromMe: msg.fromMe,
        isGroup: chat.isGroup,
        messageId: msg.id._serialized,
      },
    })

    // Verifica regras de automação apenas se não for do próprio usuário
    if (!msg.fromMe && !chat.isGroup) {
      await checkAutomationRules(instanceId, msg)
    }
  } catch (error) {
    console.error('Erro ao processar mensagem:', error)
  }
}

// Controle de rate limiting por contato
const lastMessageTime = new Map<string, number>()
const MIN_DELAY_BETWEEN_MESSAGES = 30000 // 30 segundos mínimo entre mensagens para o mesmo contato
const RESPONSE_DELAY_MIN = 2000 // 2 segundos mínimo antes de responder
const RESPONSE_DELAY_MAX = 8000 // 8 segundos máximo (simula tempo de leitura humana)

async function checkAutomationRules(instanceId: string, msg: any) {
  try {
    const now = Date.now()
    const contactId = msg.from
    
    // Verifica rate limiting - não responde muito rápido para o mesmo contato
    const lastMessage = lastMessageTime.get(contactId)
    if (lastMessage && (now - lastMessage) < MIN_DELAY_BETWEEN_MESSAGES) {
      console.log(`Rate limit: aguardando antes de responder para ${contactId}`)
      return
    }

    // Busca regras ativas para esta instância ou globais
    const rules = await prisma.automationRule.findMany({
      where: {
        isActive: true,
        OR: [
          { instanceId: null }, // Regras globais
          { instanceId }, // Regras específicas desta instância
        ],
      },
      orderBy: { priority: 'desc' },
    })

    const messageBody = msg.body.toLowerCase()

    // Verifica cada regra
    for (const rule of rules) {
      const trigger = rule.trigger.toLowerCase()
      
      // Verifica se a mensagem contém o trigger
      if (messageBody.includes(trigger)) {
        const client = clients.get(instanceId)
        if (client) {
          // Delay aleatório antes de responder (simula comportamento humano)
          const delay = Math.floor(
            Math.random() * (RESPONSE_DELAY_MAX - RESPONSE_DELAY_MIN) + RESPONSE_DELAY_MIN
          )
          
          console.log(`Regra "${rule.name}" acionada. Aguardando ${delay}ms antes de responder...`)
          
          // Aguarda antes de enviar a resposta
          await new Promise(resolve => setTimeout(resolve, delay))
          
          // Envia resposta automática
          await client.sendMessage(msg.from, rule.response)
          
          // Atualiza o timestamp da última mensagem para este contato
          lastMessageTime.set(contactId, Date.now())
          
          console.log(`Resposta automática enviada para ${msg.from}: ${rule.response}`)
          
          // Interrompe após a primeira regra correspondente
          break
        }
      }
    }
  } catch (error) {
    console.error('Erro ao verificar regras de automação:', error)
  }
}

export async function disconnectClient(instanceId: string) {
  const client = clients.get(instanceId)
  if (client) {
    await client.logout()
    await client.destroy()
    clients.delete(instanceId)
  }
}

