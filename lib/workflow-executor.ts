import { prisma } from './prisma'
import { sendWhatsAppMessage, sendWhatsAppInteractiveMessage, sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppDocument, getUserProfileName } from './whatsapp-cloud-api'
import { generateAIResponse } from './openai'
import { createAppointment, checkAvailability, getAvailableTimes, getUserAppointments, updateAppointment, cancelAppointment } from './appointments'
import { buildSystemPrompt } from './_prompts/build-system-prompt'
import { generateEnhancedAppointmentContext } from './_context/enhanced-appointment-context'
import { getBrazilDate, parseRelativeDate } from './utils/date'
import { log } from './logger'
import { normalizeText, matchesTrigger } from './workflow-helpers'

export interface WhatsAppMessage {
  from: string
  to: string
  body: string
  messageId: string
  timestamp: number
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'button'
  contactName?: string // Nome do contato se disponível
  mediaUrl?: string // URL da mídia salva no Cloudinary (se houver)
  interactiveData?: string | null // Dados interativos (botões, etc) em formato JSON
}

interface WorkflowNode {
  id: string
  type: string
  data: any
}

interface WorkflowConnection {
  sourceNodeId: string
  targetNodeId: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

interface WorkflowExecutionContext {
  instanceId: string
  workflowId: string // Adicionar workflowId para rastrear qual workflow está executando
  contactNumber: string
  currentNodeId: string
  userResponse?: string
  variables: Record<string, any>
}

interface MediaAttachment {
  type: 'image'
  url: string
  caption?: string
}

function isImageAttachment(media: MediaAttachment | null): media is MediaAttachment {
  return !!media && media.type === 'image' && !!media.url
}

interface ServiceWithAppointment {
  name: string
  duration?: number
  imageUrl?: string
}

// Armazena o estado de execução de workflows por contato
const workflowExecutions = new Map<string, WorkflowExecutionContext>()

// Fila de mensagens por contato para garantir ordem de envio
// Evita que mensagens sejam enviadas fora de ordem (ex: imagem depois de texto)
const messageQueues = new Map<string, Promise<void>>()

/**
 * Adiciona uma mensagem à fila sequencial do contato
 * Garante que mensagens sejam enviadas em ordem, mesmo que uma demore mais
 */
async function queueMessage(
  contactKey: string,
  sendFunction: () => Promise<void>
): Promise<void> {
  // Pega a última promise da fila (ou cria uma nova se não existir)
  const previousPromise = messageQueues.get(contactKey) || Promise.resolve()
  
  // Cria uma nova promise que aguarda a anterior e então executa a função
  const newPromise = previousPromise
    .then(() => sendFunction())
    .catch((error) => {
      log.error(`Erro ao enviar mensagem na fila para ${contactKey}`, error)
      throw error
    })
    .finally(() => {
      // Limpa a fila se não houver mais mensagens pendentes
      // (a promise atual é a última)
      if (messageQueues.get(contactKey) === newPromise) {
        messageQueues.delete(contactKey)
      }
    })
  
  // Atualiza a fila com a nova promise
  messageQueues.set(contactKey, newPromise)
  
  // Aguarda a execução completa
  await newPromise
}

/**
 * Substitui variáveis no texto (ex: {{nome}}, {{telefone}}, {{data}}, etc)
 */
function replaceVariables(text: string, variables: Record<string, any>): string {
  if (!text) return text

  let result = text

  // Substitui variáveis do formato {{variavel}}
  result = result.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = variables[varName.toLowerCase()]
    return value !== undefined ? String(value) : match
  })

  // Adiciona variáveis de data/hora
  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR')
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  
  result = result.replace(/\{\{data\}\}/g, dateStr)
  result = result.replace(/\{\{hora\}\}/g, timeStr)
  result = result.replace(/\{\{datahora\}\}/g, `${dateStr} às ${timeStr}`)

  return result
}

/**
 * Executa workflows em vez de regras simples
 */
export async function executeWorkflows(
  instanceId: string,
  message: WhatsAppMessage
): Promise<void> {
  try {
    const contactNumber = message.from
    const messageBody = message.body.toLowerCase().trim()

    // ⚠️ CRÍTICO: Processa confirmação/cancelamento de agendamento ANTES de qualquer lógica de workflow
    // Isso garante que confirmações sejam processadas imediatamente e não entrem em loop
    log.debug('Verificando confirmação de agendamento antes de processar workflows')
    
    try {
      // Busca userId da instância para processar agendamento
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { id: instanceId },
        select: { userId: true },
      })
      
      if (instance?.userId) {
        log.debug('userId encontrado para verificação de agendamento', { userId: instance.userId })
        
        // Processa confirmação/cancelamento de agendamento pendente
        // Usa a mensagem ORIGINAL (não lowercase) para melhor detecção
        const processedAppointment = await processAppointmentConfirmation(
          instanceId,
          contactNumber,
          message.body, // Mensagem original, não lowercase
          instance.userId,
          message.contactName
        )
        
        if (processedAppointment) {
          log.debug('Agendamento processado, retornando sem processar workflows')
          return // CRÍTICO: Retorna aqui se processou confirmação/cancelamento - NÃO PROCESSA WORKFLOWS
        } else {
          log.debug('Nenhum agendamento pendente processado, continuando com workflows')
        }
      } else {
        log.warn('userId não encontrado para instância, pulando verificação de agendamento', { instanceId })
      }
    } catch (error) {
      log.error('Erro ao verificar agendamento pendente', error)
      // Continua com workflows mesmo se houver erro na verificação de agendamento
    }

    // Busca workflows ativos para esta instância
    const workflows = await prisma.workflow.findMany({
      where: {
        isActive: true,
        OR: [
          { instanceId: null }, // Workflows globais
          { instanceId }, // Workflows específicos desta instância
        ],
      },
      include: {
        nodes: true,
        connections: true,
      },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Array<{
      id: string
      name: string
      trigger: string
      isActive: boolean
      isAIOnly: boolean
      aiBusinessDetails: string | null
      nodes: any[]
      connections: any[]
    }>

    // Verifica se há uma execução em andamento para este contato
    const executionKey = `${instanceId}-${contactNumber}`
    const currentExecution = workflowExecutions.get(executionKey)

    if (currentExecution) {
      // CRÍTICO: Verifica se a execução ainda é válida antes de continuar
      // Se o workflow não existe mais ou não está ativo, limpa a execução
      if (currentExecution.workflowId) {
        const workflow = workflows.find(w => w.id === currentExecution.workflowId)
        
        // Se o workflow não existe mais ou não está ativo, limpa a execução
        if (!workflow || !workflow.isActive) {
          log.debug('Limpando execução inválida: workflow não existe ou não está ativo')
          workflowExecutions.delete(executionKey)
          // Continua o fluxo normalmente abaixo
        } else if (workflow.isAIOnly) {
          // Se há execução IA-only válida em andamento, sempre responde
          await executeAIOnlyWorkflow(workflow, instanceId, contactNumber, messageBody, message.contactName)
          return
        } else {
          // Workflow manual ainda válido, continua execução existente
      await processQuestionnaireResponse(instanceId, contactNumber, messageBody)
      return
        }
      } else {
        // Execução sem workflowId válido, limpa
        log.debug('Limpando execução sem workflowId válido')
        workflowExecutions.delete(executionKey)
        // Continua o fluxo normalmente abaixo
      }
    }

    // Para fluxos IA-only: verifica se há algum ativo e responde sempre
    const aiOnlyWorkflows = workflows.filter(w => w.isAIOnly && w.isActive)
    if (aiOnlyWorkflows.length > 0) {
      const workflow = aiOnlyWorkflows[0] // Usa o primeiro workflow IA-only encontrado
      
      // Verifica se já houve interação anterior com este workflow
      const recentMessages = await prisma.message.findMany({
        where: {
          instanceId,
          OR: [
            { from: contactNumber },
            { to: contactNumber },
          ],
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      })
      
      // Se há mensagens recentes OU se a mensagem atual contém o trigger, responde sempre
      const hasRecentInteraction = recentMessages.length > 0
      const matchesTrigger = messageBody.includes(workflow.trigger.toLowerCase().trim())
      
      if (hasRecentInteraction || matchesTrigger) {
        log.debug('Workflow IA-only respondendo', {
          workflowName: workflow.name,
          contactNumber,
          hasRecentInteraction,
          matchesTrigger,
        })
        
        // Cria execução contínua para manter a IA ativa
        const execution: WorkflowExecutionContext = {
          instanceId,
          workflowId: workflow.id,
          contactNumber,
          currentNodeId: 'ai-only-continuous',
          variables: {},
        }
        workflowExecutions.set(executionKey, execution)
        
        await executeAIOnlyWorkflow(workflow, instanceId, contactNumber, messageBody, message.contactName)
        return
      }
    }

    // Procura workflow que corresponde ao trigger
    for (const workflow of workflows) {
      const trigger = workflow.trigger.toLowerCase().trim()
      
      if (messageBody.includes(trigger)) {
        log.event('workflow_triggered', {
          workflowId: workflow.id,
          workflowName: workflow.name,
          contactNumber,
        })
        
        // Se for fluxo IA-only, executar de forma autônoma e criar execução contínua
        if (workflow.isAIOnly) {
          // Cria execução contínua para manter a IA ativa
          const execution: WorkflowExecutionContext = {
            instanceId,
            workflowId: workflow.id,
            contactNumber,
            currentNodeId: 'ai-only-continuous',
            variables: {},
          }
          workflowExecutions.set(executionKey, execution)
          
          await executeAIOnlyWorkflow(workflow, instanceId, contactNumber, messageBody, message.contactName)
          return
        }
        
        // Para fluxos manuais, executar normalmente
        // Cria novo contexto de execução
        const triggerNode = workflow.nodes.find((n) => n.type === 'trigger')
        if (!triggerNode) {
          log.warn('Nenhum nó trigger encontrado no workflow', { workflowId: workflow.id })
          continue
        }

        // Busca informações do contato (nome, etc)
        // Usa o nome do webhook se disponível, senão tenta buscar da API
        let contactName = message.contactName || undefined
        if (!contactName) {
          const profileName = await getUserProfileName(instanceId, contactNumber)
          contactName = profileName || undefined
        }
        
        const formattedPhone = contactNumber.replace(/\D/g, '')
        const formattedPhoneFormatted = formattedPhone.startsWith('55')
          ? formattedPhone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '+55 ($1) $2-$3')
          : formattedPhone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')

        const execution: WorkflowExecutionContext = {
          instanceId,
          workflowId: workflow.id, // Adicionar workflowId
          contactNumber,
          currentNodeId: triggerNode.id,
          variables: {
            nome: contactName || formattedPhoneFormatted || 'Usuário',
            telefone: formattedPhoneFormatted || contactNumber,
            telefoneNumero: formattedPhone || contactNumber,
          },
        }

        workflowExecutions.set(executionKey, execution)

        // Executa o workflow começando do nó trigger
        await executeWorkflow(workflow, execution, instanceId, contactNumber)
        return
      }
    }
  } catch (error) {
    log.error('Erro ao executar workflows', error)
  }
}

/**
 * Continua execução de workflow existente (para questionários, etc)
 */
async function continueWorkflowExecution(
  execution: WorkflowExecutionContext,
  messageBody: string,
  instanceId: string,
  contactNumber: string
): Promise<void> {
  try {
    const workflow = await prisma.workflow.findFirst({
      where: { id: instanceId }, // TODO: melhorar isso
      include: {
        nodes: true,
        connections: true,
      },
    })

    if (!workflow) {
      workflowExecutions.delete(`${instanceId}-${contactNumber}`)
      return
    }

    // Atualiza a resposta do usuário
    execution.userResponse = messageBody

    // Continua execução do workflow
    await executeWorkflow(workflow, execution, instanceId, contactNumber)
  } catch (error) {
    log.error('Erro ao continuar execução', error)
  }
}

/**
 * Executa um workflow a partir de um nó específico
 */
async function executeWorkflow(
  workflow: any,
  execution: WorkflowExecutionContext,
  instanceId: string,
  contactNumber: string
): Promise<void> {
  try {
    const nodes = workflow.nodes.reduce((acc: Record<string, WorkflowNode>, node: any) => {
      acc[node.id] = {
        id: node.id,
        type: node.type,
        data: JSON.parse(node.data),
      }
      return acc
    }, {})

    const connections = workflow.connections as WorkflowConnection[]

    let currentNodeId = execution.currentNodeId
    let maxIterations = 100 // Previne loops infinitos
    let iterations = 0

    while (currentNodeId && iterations < maxIterations) {
      iterations++
      const currentNode = nodes[currentNodeId]

      if (!currentNode) {
        log.warn('Nó não encontrado no workflow', { currentNodeId, workflowId: workflow.id })
        break
      }

      log.debug('Executando nó do workflow', { nodeType: currentNode.type, nodeId: currentNodeId })

      // Executa o nó atual
      const nextNodeId = await executeNode(
        currentNode,
        execution,
        instanceId,
        contactNumber,
        connections,
        nodes
      )

      if (nextNodeId === null) {
        // Workflow terminou ou aguardando resposta do usuário
        execution.currentNodeId = currentNodeId
        return
      }

      currentNodeId = nextNodeId
      execution.currentNodeId = currentNodeId
    }

    // Limpa execução quando termina
    workflowExecutions.delete(`${instanceId}-${contactNumber}`)
  } catch (error) {
    log.error('Erro ao executar workflow', error)
    workflowExecutions.delete(`${instanceId}-${contactNumber}`)
  }
}

/**
 * Executa um nó específico e retorna o próximo nó ou null se aguardar resposta
 */
async function executeNode(
  node: WorkflowNode,
  execution: WorkflowExecutionContext,
  instanceId: string,
  contactNumber: string,
  connections: WorkflowConnection[],
  nodes: Record<string, WorkflowNode>
): Promise<string | null> {
  const { type, data } = node

  switch (type) {
    case 'trigger':
      // Nó trigger apenas inicia o fluxo, vai para o próximo
      return getNextNode(node.id, connections, null)

      case 'message':
        // Substitui variáveis na mensagem
        const messageText = replaceVariables(data.message || '', execution.variables)
        
        // Cria uma chave única para a fila deste contato
        const messageContactKey = `${instanceId}-${contactNumber}`
        
        // Adiciona à fila sequencial para garantir ordem de envio
        await queueMessage(messageContactKey, async () => {
          // Envia arquivo primeiro se houver (imagem, vídeo ou documento)
          if (data.fileUrl) {
            try {
              if (data.fileType === 'image') {
                await sendWhatsAppImage(
                  instanceId,
                  contactNumber,
                  data.fileUrl,
                  messageText // Caption com a mensagem (com variáveis substituídas)
                )
              } else if (data.fileType === 'video') {
                await sendWhatsAppVideo(
                  instanceId,
                  contactNumber,
                  data.fileUrl,
                  messageText
                )
              } else if (data.fileType === 'document') {
                await sendWhatsAppDocument(
                  instanceId,
                  contactNumber,
                  data.fileUrl,
                  data.fileName || 'documento',
                  messageText
                )
              }
            } catch (error) {
              log.error('Erro ao enviar arquivo', error)
              // Se falhar, tenta enviar pelo menos a mensagem de texto
              if (messageText) {
                await sendWhatsAppMessage(instanceId, contactNumber, messageText, 'service')
              }
              throw error // Propaga o erro para a fila
            }
          } else {
            // Se não houver arquivo, envia apenas a mensagem de texto
            if (messageText) {
              await sendWhatsAppMessage(instanceId, contactNumber, messageText, 'service')
            }
          }
        })

        return getNextNode(node.id, connections, null)

    case 'wait':
      // Aguarda o tempo especificado
      const duration = data.duration || 60
      const unit = data.unit || 'seconds'
      let waitMs = duration * 1000

      if (unit === 'minutes') waitMs = duration * 60 * 1000
      if (unit === 'hours') waitMs = duration * 60 * 60 * 1000

      await new Promise((resolve) => setTimeout(resolve, waitMs))

      return getNextNode(node.id, connections, null)

      case 'questionnaire':
        // Substitui variáveis na pergunta
        const questionText = replaceVariables(data.question || '', execution.variables)
        const questionnaireContactKey = `${instanceId}-${contactNumber}`
        
        // Adiciona à fila sequencial para garantir ordem
        await queueMessage(questionnaireContactKey, async () => {
          // Envia a pergunta com botões interativos se houver opções
          if (data.options && data.options.length > 0 && data.options.length <= 3) {
            // Usa botões interativos (máximo 3 botões)
            const buttons = data.options.map((opt: any) => ({
              id: `option-${opt.id}`, // Prefixo para identificar como resposta de botão
              title: replaceVariables(opt.label, execution.variables).slice(0, 20), // Máximo 20 caracteres
            }))
            
            await sendWhatsAppInteractiveMessage(
              instanceId,
              contactNumber,
              questionText,
              buttons
            )
          } else {
            // Fallback para texto simples se tiver mais de 3 opções ou nenhuma
            await sendWhatsAppMessage(instanceId, contactNumber, questionText, 'service')
            
            if (data.options && data.options.length > 0) {
              const optionsText = data.options
                .map((opt: any, index: number) => `${index + 1}. ${replaceVariables(opt.label, execution.variables)}`)
                .join('\n')
              await sendWhatsAppMessage(instanceId, contactNumber, optionsText, 'service')
            }
          }
        })

        // Aguarda resposta do usuário
        return null // Retorna null para pausar execução

    case 'transfer_to_human':
      // Transfere conversa para atendente humano
      const { updateConversationStatus } = await import('./conversation-status')
      await updateConversationStatus(instanceId, contactNumber, 'waiting_human')
      
      // Envia mensagem informando que será atendido por humano
      const transferMessage = data.message || 'Nossa equipe entrará em contato em breve. Aguarde um momento, por favor.'
      const contactKeyTransfer = `${instanceId}-${contactNumber}`
      await queueMessage(contactKeyTransfer, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, transferMessage, 'service')
      })
      
      // Encerra o workflow atual
      workflowExecutions.delete(`${instanceId}-${contactNumber}`)
      return null

    case 'close_chat':
      // Encerra a conversa
      const { updateConversationStatus: updateStatus } = await import('./conversation-status')
      await updateStatus(instanceId, contactNumber, 'closed')
      
      // Envia mensagem de encerramento
      const closeMessage = data.message || 'Obrigado pelo contato! Esta conversa foi encerrada. Se precisar de mais alguma coisa, é só nos chamar novamente.'
      const contactKeyClose = `${instanceId}-${contactNumber}`
      await queueMessage(contactKeyClose, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, closeMessage, 'service')
      })
      
      // Encerra o workflow atual
      workflowExecutions.delete(`${instanceId}-${contactNumber}`)
      return null

    case 'ai':
      // Implementação de integração com IA usando ChatGPT
      try {
        const { generateAIResponse } = await import('./openai')
        
        const prompt = data.prompt || 'Responda à mensagem do usuário de forma amigável e útil.'
        const systemPrompt = data.systemPrompt
        const temperature = data.temperature ?? 0.7
        const maxTokens = data.maxTokens ?? 500
        
        // Busca histórico recente da conversa para contexto
        const recentMessages = await prisma.message.findMany({
          where: {
            instanceId,
            OR: [
              { from: contactNumber },
              { to: contactNumber },
            ],
          },
          orderBy: { timestamp: 'desc' },
          take: 10, // Últimas 10 mensagens
        })
        
        // Converte mensagens para formato de histórico
        const conversationHistory = recentMessages
          .reverse() // Inverte para ordem cronológica
          .map((msg) => ({
            role: msg.isFromMe ? 'assistant' : 'user' as 'user' | 'assistant',
            content: msg.body,
          }))
        
        // Gera resposta usando IA
        const aiResponse = await generateAIResponse(prompt, {
          systemPrompt,
          conversationHistory,
          variables: execution.variables,
          temperature,
          maxTokens,
        })
        
        // Substitui variáveis na resposta gerada
        const finalResponse = replaceVariables(aiResponse, execution.variables)
        
        // Envia a resposta gerada pela IA
        const aiContactKey = `${instanceId}-${contactNumber}`
        await queueMessage(aiContactKey, async () => {
          await sendWhatsAppMessage(instanceId, contactNumber, finalResponse, 'service')
        })
        
        log.debug('Resposta de IA gerada', { contactNumber })
      } catch (error) {
        log.error('Erro ao gerar resposta de IA', error)
        
        // Envia mensagem de erro amigável
        const errorMessage = 'Desculpe, ocorreu um erro ao processar sua mensagem. Nossa equipe foi notificada.'
        const errorContactKey = `${instanceId}-${contactNumber}`
        await queueMessage(errorContactKey, async () => {
          await sendWhatsAppMessage(instanceId, contactNumber, errorMessage, 'service')
        })
      }
      
      return getNextNode(node.id, connections, null)

    case 'condition':
      // Avalia condição e escolhe o caminho
      const condition = data.condition || ''
      const userResponse = execution.userResponse || ''
      
      // Avaliação simples - pode ser melhorada
      let conditionResult = false
      try {
        // Exemplo: resposta.includes('sim') ou outras condições
        if (condition.includes('includes')) {
          const match = condition.match(/includes\(['"](.*?)['"]\)/)
          if (match) {
            conditionResult = userResponse.includes(match[1])
          }
        } else {
          // Avaliação direta
          conditionResult = eval(condition.replace(/resposta/g, `'${userResponse}'`))
        }
      } catch (e) {
        log.error('Erro ao avaliar condição', e)
      }

      const handleId = conditionResult ? 'true' : 'false'
      return getNextNode(node.id, connections, handleId)

    default:
      log.warn('Tipo de nó desconhecido', { type, nodeId: node.id })
      return getNextNode(node.id, connections, null)
  }
}

/**
 * Encontra o próximo nó baseado nas conexões
 */
function getNextNode(
  currentNodeId: string,
  connections: WorkflowConnection[],
  sourceHandle: string | null
): string | null {
  // Encontra conexões que saem deste nó
  const outgoingConnections = connections.filter(
    (conn) => conn.sourceNodeId === currentNodeId
  )

  if (outgoingConnections.length === 0) {
    return null // Fim do workflow
  }

  // Se há sourceHandle específico (ex: condição ou questionário), usa ele
  if (sourceHandle) {
    const connection = outgoingConnections.find(
      (conn) => conn.sourceHandle === sourceHandle
    )
    if (connection) {
      return connection.targetNodeId
    }
  }

  // Caso contrário, pega a primeira conexão
  return outgoingConnections[0]?.targetNodeId || null
}

/**
 * Processa resposta de questionário e continua workflow
 */
export async function processQuestionnaireResponse(
  instanceId: string,
  contactNumber: string,
  messageBody: string
): Promise<void> {
  const executionKey = `${instanceId}-${contactNumber}`
  const execution = workflowExecutions.get(executionKey)

  if (!execution) {
    log.warn('Nenhuma execução encontrada para processar resposta', { contactNumber, instanceId })
    return
  }

  // Busca a mensagem mais recente para obter o interactiveData (se for resposta de botão)
  const recentMessage = await prisma.message.findFirst({
    where: {
      instanceId,
      from: contactNumber,
      messageType: 'button',
    },
    orderBy: { timestamp: 'desc' },
  })

  // Tenta obter o buttonId do interactiveData
  let buttonIdFromData: string | null = null
  if (recentMessage?.interactiveData) {
    try {
      const interactiveData = JSON.parse(recentMessage.interactiveData)
      buttonIdFromData = interactiveData.buttonId || null
    } catch (e) {
      // Ignora erro de parsing
    }
  }

  // Busca workflow específico pelo ID da execução
  const workflows = await prisma.workflow.findMany({
    where: {
      id: execution.workflowId, // Buscar pelo workflowId específico
      isActive: true,
    },
    include: {
      nodes: true,
      connections: true,
    },
  })

  const workflow = workflows[0]
  if (!workflow) {
    workflowExecutions.delete(executionKey)
    return
  }

  const nodes = workflow.nodes.reduce((acc: Record<string, WorkflowNode>, node: any) => {
    acc[node.id] = {
      id: node.id,
      type: node.type,
      data: JSON.parse(node.data),
    }
    return acc
  }, {})

  const currentNode = nodes[execution.currentNodeId]

  if (currentNode?.type === 'questionnaire') {
    // Tenta identificar qual opção foi escolhida
    const options = currentNode.data.options || []
    const messageLower = messageBody.toLowerCase().trim()
    
    let optionId: string | null = null
    
    // PRIORIDADE 1: Se temos o buttonId do interactiveData, usa diretamente
    if (buttonIdFromData && buttonIdFromData.startsWith('option-')) {
      const extractedId = buttonIdFromData.replace('option-', '')
      const foundOption = options.find((opt: any) => opt.id === extractedId)
      if (foundOption) {
        optionId = extractedId
        log.debug('Opção identificada pelo buttonId do interactiveData', { optionId })
      }
    }
    
    // PRIORIDADE 2: Se a mensagem é um ID de botão (começa com "option-"), usa diretamente
    if (!optionId && messageBody.startsWith('option-')) {
      const extractedId = messageBody.replace('option-', '')
      const foundOption = options.find((opt: any) => opt.id === extractedId)
      if (foundOption) {
        optionId = extractedId
        log.debug('Opção identificada pelo ID do botão', { optionId })
      }
    }
    
    // PRIORIDADE 3: Se ainda não encontrou, procura pelo título do botão (messageBody agora tem o título)
    if (!optionId) {
      const foundOptionByLabel = options.find((opt: any) => {
        const optLabel = opt.label.toLowerCase().trim()
        return messageLower === optLabel || messageLower.includes(optLabel) || optLabel.includes(messageLower)
      })
      if (foundOptionByLabel) {
        optionId = foundOptionByLabel.id
        log.debug('Opção identificada pelo título', { optionId })
      }
    }
    
    // PRIORIDADE 4: Verifica se respondeu com número (ex: "1", "2", etc)
    if (!optionId) {
      const numberMatch = messageLower.match(/^(\d+)/)
      if (numberMatch) {
        const optionIndex = parseInt(numberMatch[1]) - 1
        if (options[optionIndex]) {
          optionId = options[optionIndex].id
          log.debug('Opção identificada pelo número', { optionId, optionIndex })
        }
      }
    }

    if (optionId) {
      // Encontra conexão baseada na opção escolhida
      const connections = workflow.connections as WorkflowConnection[]
      const nextNodeId = getNextNode(execution.currentNodeId, connections, `option-${optionId}`)

      if (nextNodeId) {
        execution.currentNodeId = nextNodeId
        execution.userResponse = messageBody
        await executeWorkflow(workflow, execution, instanceId, contactNumber)
      } else {
        console.log('⚠️ Nenhuma conexão encontrada para a opção escolhida')
        workflowExecutions.delete(executionKey)
      }
    } else {
      // Opção não reconhecida, envia mensagem de erro
      const contactKeyError = `${instanceId}-${contactNumber}`
      await queueMessage(contactKeyError, async () => {
        await sendWhatsAppMessage(
          instanceId, 
          contactNumber, 
          'Desculpe, não entendi sua resposta. Por favor, responda com o número ou texto da opção.',
          'service'
        )
      })
    }
  }
}

/**
 * Processa confirmação ou cancelamento de agendamento pendente
 * Retorna true se processou algo (confirmação ou cancelamento), false caso contrário
 */
export async function processAppointmentConfirmation(
  instanceId: string,
  contactNumber: string,
  userMessage: string,
  userId: string,
  contactName?: string
): Promise<boolean> {
  // CRÍTICO: Normaliza o número ANTES de qualquer processamento
  const normalizedContactNumber = contactNumber.replace(/\D/g, '')
  
  console.log(`🔍🔍🔍 [processAppointmentConfirmation] ========== INICIANDO PROCESSAMENTO ==========`)
  console.log(`   instanceId: ${instanceId}`)
  console.log(`   contactNumber original: ${contactNumber}`)
  console.log(`   contactNumber normalizado: ${normalizedContactNumber}`)
  console.log(`   userMessage: "${userMessage}"`)
  console.log(`   userId: ${userId}`)
  
  // Normaliza a mensagem para comparação (remove espaços extras e caracteres especiais)
  // Remove todos os espaços, acentos e caracteres especiais para comparação mais robusta
  const userMessageLower = userMessage.toLowerCase().trim()
  const normalizedMessage = userMessageLower
    .replace(/\s+/g, '') // Remove todos os espaços
    .replace(/[.,!?;:]/g, '') // Remove pontuação
    .normalize('NFD') // Normaliza caracteres Unicode
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
  
  // CRÍTICO: Verifica se o usuário quer encerrar o chat ANTES de verificar agendamento pendente
  const wantsToCloseChat = 
    userMessageLower.includes('encerrar') ||
    userMessageLower.includes('fechar') ||
    userMessageLower.includes('finalizar') ||
    userMessageLower.includes('terminar') ||
    normalizedMessage.includes('encerrar') ||
    normalizedMessage.includes('fechar') ||
    normalizedMessage.includes('finalizar') ||
    normalizedMessage.includes('terminar') ||
    (userMessageLower.includes('chat') && (userMessageLower.includes('encerrar') || userMessageLower.includes('fechar'))) ||
    (userMessageLower.includes('conversa') && (userMessageLower.includes('encerrar') || userMessageLower.includes('fechar')))
  
  // Verifica se está aguardando confirmação de encerramento
  const conversationStatus = await prisma.conversationStatus.findUnique({
    where: {
      instanceId_contactNumber: {
        instanceId,
        contactNumber,
      },
    },
  })
  
  if (conversationStatus?.status === 'pending_close_confirmation') {
    // Usuário está respondendo à confirmação de encerramento
    const isConfirmation = 
      userMessageLower === 'sim' ||
      userMessageLower === 'confirmar' ||
      userMessageLower === 'confirmo' ||
      userMessageLower === 'ok' ||
      normalizedMessage === 'sim' ||
      normalizedMessage === 'confirmar'
    
    const isCancellation = 
      userMessageLower === 'não' ||
      userMessageLower === 'nao' ||
      userMessageLower === 'cancelar' ||
      normalizedMessage === 'nao' ||
      normalizedMessage === 'cancelar'
    
    if (isConfirmation) {
      // Confirma encerramento - cancela agendamento pendente se houver e encerra
      const { getPendingAppointment, clearPendingAppointment } = await import('./pending-appointments')
      const pendingToCancel = await getPendingAppointment(instanceId, normalizedContactNumber)
      
      if (pendingToCancel) {
        await clearPendingAppointment(instanceId, normalizedContactNumber)
        console.log(`🚪 [processAppointmentConfirmation] Agendamento pendente cancelado ao encerrar chat`)
      }
      
      const { updateConversationStatus } = await import('./conversation-status')
      await updateConversationStatus(instanceId, contactNumber, 'closed')
      
      const closeMessage = 'Obrigado pelo contato! Esta conversa foi encerrada. Se precisar de mais alguma coisa, é só nos chamar novamente.'
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, closeMessage, 'service')
      })
      
      // Limpa execução do workflow
      const executionKey = `${instanceId}-${contactNumber}`
      if (workflowExecutions.has(executionKey)) {
        workflowExecutions.delete(executionKey)
      }
      
      return true
    } else if (isCancellation) {
      // Cancela encerramento - volta para ativo
      const { updateConversationStatus } = await import('./conversation-status')
      await updateConversationStatus(instanceId, contactNumber, 'active')
      
      const cancelCloseMessage = 'Entendido! A conversa continuará ativa. Como posso ajudar?'
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, cancelCloseMessage, 'service')
      })
      
      return true
    }
  }
  
  if (wantsToCloseChat) {
    console.log(`🚪 [processAppointmentConfirmation] Usuário quer encerrar o chat`)
    
    // Verifica se há agendamento pendente antes de encerrar
    const { getPendingAppointment } = await import('./pending-appointments')
    const pendingBeforeClose = await getPendingAppointment(instanceId, normalizedContactNumber)
    
    if (pendingBeforeClose) {
      // Se há agendamento pendente, pergunta se quer encerrar mesmo assim
      const confirmCloseMessage = `Você tem um agendamento pendente de confirmação:\n\n📅 Data: ${pendingBeforeClose.date}\n🕐 Hora: ${pendingBeforeClose.time}\n🛠️ Serviço: ${pendingBeforeClose.service}\n\nDeseja realmente encerrar o chat? Se encerrar, o agendamento pendente será cancelado.\n\nDigite "sim" para confirmar o encerramento ou "não" para continuar.`
      
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, confirmCloseMessage, 'service')
      })
      
      // Armazena temporariamente que está aguardando confirmação de encerramento
      await prisma.conversationStatus.upsert({
        where: {
          instanceId_contactNumber: {
            instanceId,
            contactNumber,
          },
        },
        update: {
          status: 'pending_close_confirmation',
        },
        create: {
          instanceId,
          contactNumber,
          status: 'pending_close_confirmation',
        },
      })
      
      return true // Processou, não deve chamar IA
    } else {
      // Não há agendamento pendente, pode encerrar diretamente
      const { updateConversationStatus } = await import('./conversation-status')
      await updateConversationStatus(instanceId, contactNumber, 'closed')
      
      const closeMessage = 'Obrigado pelo contato! Esta conversa foi encerrada. Se precisar de mais alguma coisa, é só nos chamar novamente.'
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, closeMessage, 'service')
      })
      
      // Limpa execução do workflow
      const executionKey = `${instanceId}-${contactNumber}`
      if (workflowExecutions.has(executionKey)) {
        workflowExecutions.delete(executionKey)
      }
      
      return true // Processou, não deve chamar IA
    }
  }
  
  let pendingAppointment: any = null
  let clearPendingAppointment: any = null
  
  try {
    const pendingAppointmentsModule = await import('./pending-appointments')
    const { getPendingAppointment } = pendingAppointmentsModule
    clearPendingAppointment = pendingAppointmentsModule.clearPendingAppointment
    
    // Busca agendamento pendente na tabela dedicada PendingAppointment
    // Tenta múltiplas vezes com delays para lidar com problemas de sincronização
    console.log(`🔍 [processAppointmentConfirmation] Buscando agendamento pendente...`)
    console.log(`   Parâmetros de busca:`)
    console.log(`   - instanceId: "${instanceId}"`)
    console.log(`   - contactNumber: "${contactNumber}"`)
    
    // CRÍTICO: Aumenta tentativas e delays para lidar com race conditions
    // Quando o usuário confirma muito rápido após criar o agendamento pendente,
    // pode haver um delay de sincronização do banco de dados
    const maxSearchRetries = 5 // Aumentado de 3 para 5
    for (let attempt = 1; attempt <= maxSearchRetries; attempt++) {
      // Usa número normalizado para busca
      pendingAppointment = await getPendingAppointment(instanceId, normalizedContactNumber)
    
    if (pendingAppointment) {
        console.log(`✅ [processAppointmentConfirmation] Agendamento pendente encontrado na tentativa ${attempt}/${maxSearchRetries}`)
        break
      } else if (attempt < maxSearchRetries) {
        console.log(`⚠️ [processAppointmentConfirmation] Tentativa ${attempt}/${maxSearchRetries} não encontrou agendamento, tentando novamente...`)
        // Delay crescente mais agressivo: 200ms, 400ms, 600ms, 800ms
        await new Promise(resolve => setTimeout(resolve, 200 * attempt))
      }
    }
    
    console.log(`🔍 [processAppointmentConfirmation] Resultado da busca:`)
    console.log(`   Agendamento pendente:`, pendingAppointment ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO')
    if (pendingAppointment) {
      console.log(`   ✅ Dados do agendamento pendente encontrado:`)
      console.log(`      - Data: ${pendingAppointment.date}`)
      console.log(`      - Hora: ${pendingAppointment.time}`)
      console.log(`      - Serviço: ${pendingAppointment.service}`)
      console.log(`   JSON completo:`, JSON.stringify(pendingAppointment, null, 2))
    } else {
      console.log(`   ❌ NENHUM agendamento pendente encontrado para:`)
      console.log(`      instanceId: ${instanceId}`)
      console.log(`      contactNumber: ${contactNumber}`)
      
      // Busca diretamente no banco para debug
      try {
        const directCheck = await (prisma as any).pendingAppointment.findMany({
          where: {
            instanceId,
          },
        })
        console.log(`   🔍 Debug: Total de agendamentos pendentes para esta instância: ${directCheck.length}`)
        directCheck.forEach((p: any, i: number) => {
          console.log(`      [${i + 1}] contactNumber: "${p.contactNumber}" (esperado: "${contactNumber}")`)
          console.log(`          Data: ${p.date}, Hora: ${p.time}, Serviço: ${p.service}`)
        })
      } catch (dbError) {
        console.error(`   ❌ Erro ao buscar diretamente no banco:`, dbError)
      }
    }
    
    // Verifica se a mensagem parece confirmação ANTES de verificar se há agendamento pendente
    const looksLikeConfirmation = 
        userMessageLower === 'confirmar' || 
        normalizedMessage === 'confirmar' ||
        userMessageLower === 'sim' || 
        userMessageLower === 'confirmo' ||
        userMessageLower === 'ok' ||
        userMessageLower === 'tá certo' ||
        userMessageLower === 'ta certo' ||
        userMessageLower === 'esta certo' ||
        userMessageLower === 'está certo' ||
        userMessageLower.startsWith('confirmar') ||
        normalizedMessage.startsWith('confirmar') ||
      (userMessageLower.length <= 20 && (userMessageLower.includes('confirm') || normalizedMessage.includes('confirm')))
    
    if (!pendingAppointment) {
      if (looksLikeConfirmation) {
        console.log(`⚠️⚠️⚠️ [processAppointmentConfirmation] Mensagem parece confirmação mas NÃO há agendamento pendente!`)
        console.log(`   Verificando se há agendamento criado recentemente...`)
        
        // Verifica se há um agendamento criado recentemente (últimos 5 minutos)
        // Isso pode indicar que o agendamento já foi confirmado
        try {
          // Usa select explícito para evitar erro se endDate não existir no banco
          const recentAppointment = await prisma.appointment.findFirst({
            where: {
              instanceId,
              contactNumber,
              createdAt: {
                gte: new Date(Date.now() - 300000), // Últimos 5 minutos
              },
            },
            select: {
              id: true,
              createdAt: true,
              date: true,
              description: true,
              status: true,
              // endDate e duration podem não existir no banco ainda
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
          
          if (recentAppointment) {
            console.log(`✅ Agendamento criado recentemente encontrado (há ${Math.round((Date.now() - recentAppointment.createdAt.getTime()) / 1000)}s)`)
            const infoMessage = `✅ Seu agendamento já foi confirmado com sucesso! Se precisar de mais alguma coisa, estou à disposição.`
            const contactKey = `${instanceId}-${contactNumber}`
            await queueMessage(contactKey, async () => {
              await sendWhatsAppMessage(instanceId, contactNumber, infoMessage, 'service')
            })
            return true
          }
        } catch (error) {
          console.error(`❌ Erro ao verificar agendamento recente:`, error)
        }
        
        console.log(`   Isso pode indicar que o agendamento foi confirmado ou cancelado anteriormente.`)
        console.log(`   Enviando mensagem informativa e RETORNANDO TRUE para evitar loop.`)
        
        const infoMessage = `Não há agendamento pendente para confirmar. Se você acabou de confirmar um agendamento, ele já foi processado com sucesso! Se precisar de mais alguma coisa, estou à disposição.`
        const contactKey = `${instanceId}-${contactNumber}`
        await queueMessage(contactKey, async () => {
          await sendWhatsAppMessage(instanceId, contactNumber, infoMessage, 'service')
        })
        return true // Retorna true para evitar que a IA seja chamada e cause loop
      }
      
      console.log(`❌ [processAppointmentConfirmation] Nenhum agendamento pendente encontrado - RETORNANDO FALSE`)
      return false // Não há agendamento pendente e não parece confirmação, não processou nada
    }
  } catch (error) {
    console.error(`❌ [processAppointmentConfirmation] ERRO ao buscar agendamento pendente:`, error)
    return false
  }

  // Se chegou aqui, há agendamento pendente - continua processamento
  console.log(`🔍 [processAppointmentConfirmation] Analisando mensagem (há agendamento pendente):`)
      console.log(`   Mensagem original: "${userMessage}"`)
      console.log(`   Mensagem lowercase: "${userMessageLower}"`)
      console.log(`   Mensagem normalizada: "${normalizedMessage}"`)
      
  // Detecção MUITO robusta de confirmação - verifica múltiplas variações
  // Primeiro verifica correspondências exatas
  const exactMatch = 
        userMessageLower === 'confirmar' || 
        normalizedMessage === 'confirmar' ||
        userMessageLower === 'sim' || 
        userMessageLower === 'confirmo' ||
        userMessageLower === 'ok' ||
        userMessageLower === 'tá certo' ||
        userMessageLower === 'ta certo' ||
        userMessageLower === 'esta certo' ||
        userMessageLower === 'está certo' ||
    normalizedMessage === 'sim' ||
    normalizedMessage === 'confirmo' ||
    normalizedMessage === 'ok' ||
    normalizedMessage === 'tacerto' ||
    normalizedMessage === 'estacerto'
  
  // Depois verifica se começa com "confirmar"
  const startsWithConfirm = 
        userMessageLower.startsWith('confirmar') ||
    normalizedMessage.startsWith('confirmar')
  
  // Por último verifica se contém "confirm" (para pegar variações)
  const containsConfirm = 
    userMessageLower.length <= 20 && 
    (userMessageLower.includes('confirm') || normalizedMessage.includes('confirm'))
  
  const isConfirmation = exactMatch || startsWithConfirm || containsConfirm
      
  console.log(`🔍 [processAppointmentConfirmation] Detecção detalhada:`)
  console.log(`   Exact match: ${exactMatch}`)
  console.log(`   Starts with confirm: ${startsWithConfirm}`)
  console.log(`   Contains confirm: ${containsConfirm}`)
  console.log(`   RESULTADO FINAL - É confirmação? ${isConfirmation}`)
  
  // Detecção de cancelamento
  const isCancellation = 
    userMessageLower === 'cancelar' ||
    normalizedMessage === 'cancelar' ||
    (userMessageLower.includes('cancelar') && userMessageLower.length <= 20) ||
    (userMessageLower === 'não' && userMessageLower.length <= 5) ||
    (userMessageLower === 'nao' && userMessageLower.length <= 5)

  console.log(`🔍 [processAppointmentConfirmation] Resultado da análise:`)
      console.log(`   É confirmação? ${isConfirmation}`)
  console.log(`   É cancelamento? ${isCancellation}`)
      
  // Processa confirmação
      if (isConfirmation) {
    console.log(`✅ [processAppointmentConfirmation] PROCESSANDO CONFIRMAÇÃO DE AGENDAMENTO`)
    console.log(`   Dados do agendamento pendente:`, JSON.stringify(pendingAppointment, null, 2))
        
        // Converte a data formatada de volta para Date
        const [day, month, year] = pendingAppointment.date.split('/').map(Number)
        const [hour, minute] = pendingAppointment.time.split(':').map(Number)
        
    console.log(`📅 Convertendo dados: ${day}/${month}/${year} às ${hour}:${minute}`)
        
    // Função auxiliar para criar data UTC no fuso do Brasil
        const createBrazilianDateAsUTC = (year: number, month: number, day: number, hour: number, minute: number): Date => {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`
          return new Date(dateStr)
        }
        
        const appointmentDateUTC = createBrazilianDateAsUTC(year, month - 1, day, hour, minute)
        console.log(`📅 Data UTC criada: ${appointmentDateUTC.toISOString()}`)
        
    // CRÍTICO: Verifica novamente se o agendamento pendente ainda existe antes de processar
    // Isso evita race conditions quando múltiplas confirmações chegam simultaneamente
    const { getPendingAppointment: getPendingAppointmentFn } = await import('./pending-appointments')
    const doubleCheckPending = await getPendingAppointmentFn(instanceId, normalizedContactNumber)
    if (!doubleCheckPending) {
      console.log(`⚠️⚠️⚠️ [processAppointmentConfirmation] Agendamento pendente não encontrado na verificação dupla!`)
      console.log(`   Isso pode indicar que já foi confirmado por outra requisição simultânea.`)
      
      // Verifica se há um agendamento criado recentemente
      try {
        // Usa select explícito para evitar erro se endDate não existir no banco
        const recentAppointment = await prisma.appointment.findFirst({
          where: {
            instanceId,
            contactNumber,
            createdAt: {
              gte: new Date(Date.now() - 10000), // Últimos 10 segundos
            },
          },
          select: {
            id: true,
            createdAt: true,
            date: true,
            description: true,
            status: true,
            // endDate e duration podem não existir no banco ainda
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
        
        if (recentAppointment) {
          console.log(`✅ Agendamento já foi confirmado recentemente!`)
          const infoMessage = `✅ Seu agendamento já foi confirmado com sucesso! Se precisar de mais alguma coisa, estou à disposição.`
          const contactKey = `${instanceId}-${contactNumber}`
          await queueMessage(contactKey, async () => {
            await sendWhatsAppMessage(instanceId, contactNumber, infoMessage, 'service')
          })
          return true
        }
      } catch (error) {
        console.error(`❌ Erro ao verificar agendamento recente:`, error)
      }
      
      const infoMessage = `Não há agendamento pendente para confirmar no momento. Se você acabou de confirmar um agendamento, ele já foi processado. Se precisar de mais alguma coisa, estou à disposição.`
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, infoMessage, 'service')
      })
      return true
    }
    
    // CRÍTICO: Busca a duração do serviço antes de criar o agendamento
    // A duração DEVE vir do serviço, não pode ser um padrão fixo
    let serviceDuration: number | undefined = pendingAppointment.duration
    
    // Se não tem duração no pendente, busca do workflow
    if (!serviceDuration || serviceDuration <= 0) {
      const workflow = await prisma.workflow.findFirst({
        where: {
          instanceId,
          isActive: true,
          isAIOnly: true,
        },
      })
      
      if (workflow?.aiBusinessDetails) {
        try {
          const businessDetails = JSON.parse(workflow.aiBusinessDetails)
          const servicesWithAppointment = businessDetails.servicesWithAppointment || []
          const serviceName = pendingAppointment.service?.toLowerCase() || ''
          
          for (const service of servicesWithAppointment) {
            if (serviceName.includes(service.name.toLowerCase())) {
              serviceDuration = service.duration
              console.log(`✅ [processAppointmentConfirmation] Duração do serviço encontrada: ${service.name} = ${serviceDuration} minutos`)
              break
            }
          }
        } catch (error) {
          console.error('❌ [processAppointmentConfirmation] Erro ao buscar duração do serviço:', error)
        }
      }
    }
    
    // CRÍTICO: Se ainda não tem duração, retorna erro
    if (!serviceDuration || serviceDuration <= 0) {
      console.error('❌ [processAppointmentConfirmation] Duração do serviço não encontrada!')
      const errorMessage = `Não foi possível determinar a duração do serviço "${pendingAppointment.service}". Por favor, verifique se o serviço tem duração configurada.`
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, errorMessage, 'service')
      })
      return true // Processou (com erro), não deve chamar IA
    }
    
    // CRÍTICO: Cria o agendamento PRIMEIRO, só remove o pendente depois de sucesso
    // Isso evita perder o agendamento pendente se houver erro na criação
        // CRÍTICO: Passa a duração do serviço, não padrão fixo
        const { createAppointment } = await import('./appointments')
        
        // Horários agora são globais do usuário, não precisam ser passados
        // A função createAppointment busca automaticamente do usuário
        const result = await createAppointment({
          userId,
          instanceId,
          contactNumber,
          contactName: contactName,
          date: appointmentDateUTC,
          duration: serviceDuration, // CRÍTICO: Duração do serviço, não padrão fixo
          description: pendingAppointment.description || `Agendamento para ${pendingAppointment.service}`,
        })
        
        console.log(`📅 Resultado do createAppointment:`, result)
        
        if (result.success) {
      // Só remove o agendamento pendente APÓS criar o agendamento com sucesso
      // Verifica novamente antes de remover para evitar remover um que já foi removido
      const { getPendingAppointment: getPendingAppointmentFinal } = await import('./pending-appointments')
      const finalCheck = await getPendingAppointmentFinal(instanceId, normalizedContactNumber)
      if (finalCheck) {
        if (clearPendingAppointment) {
          await clearPendingAppointment(instanceId, normalizedContactNumber)
        } else {
          const { clearPendingAppointment: clearFn } = await import('./pending-appointments')
          await clearFn(instanceId, normalizedContactNumber)
        }
        console.log(`📅 Agendamento pendente removido APÓS criar agendamento com sucesso`)
      } else {
        console.log(`⚠️ Agendamento pendente já foi removido (possível race condition)`)
      }
      
      // CRÍTICO: Limpa a execução do workflow após confirmar agendamento
      // Isso permite que novas mensagens iniciem um novo fluxo limpo
      const executionKey = `${instanceId}-${contactNumber}`
      if (workflowExecutions.has(executionKey)) {
        console.log(`🧹 [processAppointmentConfirmation] Limpando execução do workflow após confirmação de agendamento`)
        workflowExecutions.delete(executionKey)
      }
      
          let confirmationMessage = `✅ Agendamento confirmado com sucesso!\n\n📅 Data: ${pendingAppointment.date}\n🕐 Hora: ${pendingAppointment.time}`
          if (pendingAppointment.duration) {
            confirmationMessage += `\n⏱️ Duração: ${pendingAppointment.duration} minutos`
          }
          confirmationMessage += `\n🛠️ Serviço: ${pendingAppointment.service}`
          
          const contactKey = `${instanceId}-${contactNumber}`
          await queueMessage(contactKey, async () => {
            await sendWhatsAppMessage(instanceId, contactNumber, confirmationMessage, 'service')
          })
      console.log(`✅ Confirmação processada e mensagem enviada - RETORNANDO TRUE`)
      return true // Processou confirmação, não deve chamar IA
        } else {
      // Se houve erro, mantém o agendamento pendente para que o usuário possa tentar novamente
          console.error(`❌ Erro ao confirmar agendamento:`, result)
      console.error(`⚠️ Agendamento pendente MANTIDO para nova tentativa`)
          const errorMessage = `❌ Erro ao confirmar agendamento: ${result.error}. Por favor, tente novamente.`
          const contactKey = `${instanceId}-${contactNumber}`
          await queueMessage(contactKey, async () => {
            await sendWhatsAppMessage(instanceId, contactNumber, errorMessage, 'service')
          })
      console.log(`❌ Erro ao confirmar - RETORNANDO TRUE`)
      return true // Processou (mesmo com erro), não deve chamar IA
    }
  }
  
  // Processa cancelamento
      if (isCancellation) {
    console.log(`❌ PROCESSANDO CANCELAMENTO DE AGENDAMENTO`)
    
    // Primeiro tenta cancelar agendamento pendente
    let cancelledPending = false
    if (pendingAppointment) {
        if (clearPendingAppointment) {
        await clearPendingAppointment(instanceId, normalizedContactNumber)
        } else {
          const { clearPendingAppointment: clearFn } = await import('./pending-appointments')
        await clearFn(instanceId, normalizedContactNumber)
      }
      cancelledPending = true
      console.log(`✅ Agendamento pendente cancelado`)
    }
    
    // Também verifica se há agendamentos confirmados recentes para cancelar
    // Usa select explícito para evitar erro se endDate não existir no banco
    const recentAppointments = await prisma.appointment.findMany({
      where: {
        instanceId,
        contactNumber: normalizedContactNumber,
        status: {
          in: ['pending', 'confirmed'],
        },
        date: {
          gte: new Date(), // Apenas agendamentos futuros
        },
      },
      select: {
        id: true,
        date: true,
        description: true,
        status: true,
        // endDate e duration podem não existir no banco ainda
      },
      orderBy: {
        date: 'asc',
      },
      take: 5, // Limita a 5 agendamentos mais próximos
    })
    
    if (recentAppointments.length > 0) {
      // Cancela o agendamento mais próximo
      const appointmentToCancel = recentAppointments[0]
      await prisma.appointment.update({
        where: { id: appointmentToCancel.id },
        data: { status: 'cancelled' },
      })
      
      const appointmentDate = new Date(appointmentToCancel.date)
      const formattedDate = appointmentDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      const formattedTime = appointmentDate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
      
      const cancelMessage = cancelledPending
        ? `✅ Agendamento pendente cancelado e agendamento confirmado para ${formattedDate} às ${formattedTime} também foi cancelado. Se precisar de mais alguma coisa, estou à disposição!`
        : `✅ Agendamento confirmado para ${formattedDate} às ${formattedTime} foi cancelado. Se precisar de mais alguma coisa, estou à disposição!`
      
        const contactKey = `${instanceId}-${contactNumber}`
        await queueMessage(contactKey, async () => {
          await sendWhatsAppMessage(instanceId, contactNumber, cancelMessage, 'service')
        })
      console.log(`✅ Cancelamento de agendamento confirmado processado`)
    } else if (cancelledPending) {
      const cancelMessage = `✅ Agendamento pendente cancelado. Se precisar de mais alguma coisa, estou à disposição!`
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, cancelMessage, 'service')
      })
    } else {
      const cancelMessage = `Não encontrei agendamentos para cancelar. Se precisar de mais alguma coisa, estou à disposição!`
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, cancelMessage, 'service')
      })
    }
    
      // CRÍTICO: Limpa a execução do workflow após cancelar agendamento
      // Isso permite que novas mensagens iniciem um novo fluxo limpo
      const executionKeyCancel = `${instanceId}-${contactNumber}`
      if (workflowExecutions.has(executionKeyCancel)) {
        console.log(`🧹 [processAppointmentConfirmation] Limpando execução do workflow após cancelamento de agendamento`)
        workflowExecutions.delete(executionKeyCancel)
      }
      
      console.log(`❌ Cancelamento processado - RETORNANDO TRUE`)
    return true // Processou cancelamento, não deve chamar IA
      }
      
      // Se há agendamento pendente mas não confirmou nem cancelou, relembra
      console.log(`⚠️ Há agendamento pendente mas mensagem não é confirmação nem cancelamento`)
      let reminderMessage = `Você tem um agendamento pendente de confirmação:\n\n📅 Data: ${pendingAppointment.date}\n🕐 Hora: ${pendingAppointment.time}`
      if (pendingAppointment.duration) {
        reminderMessage += `\n⏱️ Duração: ${pendingAppointment.duration} minutos`
      }
      reminderMessage += `\n🛠️ Serviço: ${pendingAppointment.service}\n\nDigite "confirmar" para confirmar ou "cancelar" para cancelar.`
      
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, reminderMessage, 'service')
      })
  console.log(`📅 Relembrando agendamento pendente - RETORNANDO TRUE`)
  return true // Relembrou, não deve chamar IA
}

/**
 * Executa um workflow IA-only de forma autônoma
 * A IA conversa diretamente com o cliente usando os detalhes do negócio
 */
async function executeAIOnlyWorkflow(
  workflow: any,
  instanceId: string,
  contactNumber: string,
  userMessage: string,
  contactName?: string
): Promise<void> {
  try {
    // Busca informações do contato
    let contactNameFinal = contactName || undefined
    if (!contactNameFinal) {
      const profileName = await getUserProfileName(instanceId, contactNumber)
      contactNameFinal = profileName || undefined
    }
    
    const formattedPhone = contactNumber.replace(/\D/g, '')
    const formattedPhoneFormatted = formattedPhone.startsWith('55')
      ? formattedPhone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '+55 ($1) $2-$3')
      : formattedPhone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')

    // Buscar userId do workflow primeiro (precisa para confirmar agendamentos e buscar catálogo)
    const fullWorkflow = await prisma.workflow.findUnique({
      where: { id: workflow.id },
      select: { userId: true },
    })
    const userId = fullWorkflow?.userId

    if (!userId) {
      console.error('❌ userId não encontrado para o workflow')
      return
    }

    // PRIMEIRO: Processa confirmação/cancelamento de agendamento pendente
    // Se processou algo, retorna imediatamente SEM chamar a IA
    console.log(`🔍 [executeAIOnlyWorkflow] Verificando agendamento pendente antes de chamar IA`)
    console.log(`   Mensagem do usuário: "${userMessage}"`)
    
    const processedAppointment = await processAppointmentConfirmation(
      instanceId,
      contactNumber,
      userMessage,
      userId,
      contactNameFinal
    )
    
    console.log(`🔍 [executeAIOnlyWorkflow] Resultado processAppointmentConfirmation: ${processedAppointment}`)
    
    if (processedAppointment) {
      console.log(`✅✅✅ [executeAIOnlyWorkflow] Agendamento processado, RETORNANDO SEM CHAMAR IA ✅✅✅`)
      console.log(`✅✅✅ [executeAIOnlyWorkflow] FUNÇÃO RETORNADA - IA NÃO SERÁ CHAMADA ✅✅✅`)
      
      // CRÍTICO: Limpa a execução do workflow após processar agendamento
      // Isso permite que novas mensagens iniciem um novo fluxo limpo
      const executionKeyAI = `${instanceId}-${contactNumber}`
      if (workflowExecutions.has(executionKeyAI)) {
        console.log(`🧹 [executeAIOnlyWorkflow] Limpando execução do workflow após processar agendamento`)
        workflowExecutions.delete(executionKeyAI)
      }
      
      return // CRÍTICO: Retorna aqui se processou confirmação/cancelamento - NÃO CHAMA IA
    }
    
    // PROTEÇÃO CRÍTICA: Verifica se acabou de confirmar um agendamento
    // Mesmo que processAppointmentConfirmation retornou false, pode ser que o agendamento
    // já foi confirmado em uma execução anterior. Verifica agendamentos muito recentes.
    const userMessageLower = userMessage.toLowerCase().trim()
    const normalizedMsg = userMessageLower
      .replace(/\s+/g, '')
      .replace(/[.,!?;:]/g, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    
    const looksLikeConfirmation = 
      userMessageLower === 'confirmar' || 
      normalizedMsg === 'confirmar' ||
      userMessageLower === 'sim' ||
      normalizedMsg === 'sim' ||
      userMessageLower.startsWith('confirmar') ||
      normalizedMsg.startsWith('confirmar') ||
      (userMessageLower.length <= 20 && (userMessageLower.includes('confirm') || normalizedMsg.includes('confirm')))
    
    if (looksLikeConfirmation) {
      console.log(`⚠️⚠️⚠️ [executeAIOnlyWorkflow] ATENÇÃO: Mensagem parece confirmação!`)
      console.log(`   Verificando se há agendamento criado recentemente...`)
      
      // Verifica se há um agendamento criado recentemente (últimos 120 segundos)
      // Usa select explícito para evitar erro se endDate não existir no banco
      const recentAppointment = await prisma.appointment.findFirst({
        where: {
          instanceId,
          contactNumber,
          createdAt: {
            gte: new Date(Date.now() - 120000), // Últimos 120 segundos
          },
        },
        select: {
          id: true,
          createdAt: true,
          date: true,
          description: true,
          status: true,
          // endDate e duration podem não existir no banco ainda
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      
      if (recentAppointment) {
        console.log(`✅✅✅ [executeAIOnlyWorkflow] BLOQUEADO: Agendamento criado há ${Math.round((Date.now() - recentAppointment.createdAt.getTime()) / 1000)}s`)
        console.log(`✅✅✅ [executeAIOnlyWorkflow] NÃO CHAMARÁ IA para evitar duplicação`)
        console.log(`✅✅✅ [executeAIOnlyWorkflow] RETORNANDO SEM CHAMAR IA`)
        
        // CRÍTICO: Limpa a execução do workflow após detectar agendamento recente
        // Isso permite que novas mensagens iniciem um novo fluxo limpo
        const executionKeyRecent = `${instanceId}-${contactNumber}`
        if (workflowExecutions.has(executionKeyRecent)) {
          console.log(`🧹 [executeAIOnlyWorkflow] Limpando execução do workflow após detectar agendamento recente`)
          workflowExecutions.delete(executionKeyRecent)
        }
        
        return // Não chama IA se acabou de confirmar um agendamento
      } else {
        console.log(`   Nenhum agendamento recente encontrado, continuando...`)
      }
    }
    
    console.log(`📝 [executeAIOnlyWorkflow] Continuando com processamento normal da IA`)

    // Busca histórico recente da conversa
    const recentMessages = await prisma.message.findMany({
      where: {
        instanceId,
        OR: [
          { from: contactNumber },
          { to: contactNumber },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 20, // Últimas 20 mensagens para contexto
    })

    // Converte mensagens para formato de histórico
    const conversationHistory = recentMessages
      .reverse() // Inverte para ordem cronológica
      .map((msg) => ({
        role: msg.isFromMe ? 'assistant' : 'user' as 'user' | 'assistant',
        content: msg.body,
      }))

    // Parse dos detalhes do negócio
    let businessDetails: any = {}
    if (workflow.aiBusinessDetails) {
      try {
        businessDetails = JSON.parse(workflow.aiBusinessDetails)
      } catch {
        console.error('Erro ao parsear detalhes do negócio')
      }
    }

    console.log(`🔍 Detalhes do negócio ANTES de buscar catálogo:`, {
      catalogId: businessDetails.catalogId,
      productsManuais: businessDetails.products,
      servicesManuais: businessDetails.services
    })

    // Se houver um catalogId, buscar produtos/serviços do catálogo e SUBSTITUIR os manuais
    if (businessDetails.catalogId) {
      try {
        const catalog = await prisma.catalog.findFirst({
          where: {
            id: businessDetails.catalogId,
            userId: userId, // Garantir que é do mesmo usuário
          },
          include: {
            nodes: true,
          },
        })

        if (catalog) {
          console.log(`📚 Catálogo encontrado: "${catalog.name}" com ${catalog.nodes.length} nós`)
          
          // Extrair produtos e serviços do catálogo
          const catalogProducts: string[] = []
          const catalogServices: string[] = []
          const servicesWithAppointment: ServiceWithAppointment[] = []

          // Processa nós do catálogo de forma assíncrona
          for (const node of catalog.nodes) {
            try {
              const nodeData = JSON.parse(node.data)
              console.log(`🔍 Processando nó do catálogo:`, {
                type: node.type,
                name: nodeData.name,
                hasPrice: !!nodeData.price,
                price: nodeData.price,
                requiresAppointment: nodeData.requiresAppointment,
                appointmentDuration: nodeData.appointmentDuration
              })
              
              if (node.type === 'product' && nodeData.name) {
                let productName = nodeData.name
                if (nodeData.price) {
                  productName += ` - R$ ${nodeData.price.toFixed(2).replace('.', ',')}`
                }
                catalogProducts.push(productName)
                console.log(`✅ Produto adicionado: ${productName}`)
                
                // Registra interesse se cliente visualizou produto
                if (contactNumber) {
                  try {
                    const { registerProductInterest } = await import('./promotions')
                    await registerProductInterest({
                      userId,
                      instanceId,
                      contactNumber,
                      productId: node.id,
                      productType: 'catalog',
                      productName: nodeData.name,
                      interestType: 'viewed',
                    })
                  } catch (error) {
                    // Ignora erros de registro de interesse
                    console.error('Erro ao registrar interesse do produto:', error)
                  }
                }
              } else if (node.type === 'service' && nodeData.name) {
                let serviceName = nodeData.name
                if (nodeData.price) {
                  serviceName += ` - R$ ${nodeData.price.toFixed(2).replace('.', ',')}`
                }
                catalogServices.push(serviceName)
                
                // Coleta informações de agendamento do serviço
                if (nodeData.requiresAppointment) {
                  servicesWithAppointment.push({
                    name: nodeData.name,
                    duration: nodeData.appointmentDuration,
                    imageUrl: nodeData.imageUrl,
                  })
                  console.log(`📅 Serviço com agendamento: ${nodeData.name} (duração: ${nodeData.appointmentDuration || 'não especificada'} min)`)
                }
                
                // Coleta informações de agendamento do serviço
                if (nodeData.requiresAppointment) {
                  servicesWithAppointment.push({
                    name: nodeData.name,
                    duration: nodeData.appointmentDuration,
                    imageUrl: nodeData.imageUrl,
                  })
                  console.log(`📅 Serviço com agendamento: ${nodeData.name} (duração: ${nodeData.appointmentDuration || 'não especificada'} min)`)
                }
                
                console.log(`✅ Serviço adicionado: ${serviceName}`)
                
                // Registra interesse se cliente visualizou serviço
                if (contactNumber) {
                  try {
                    const { registerProductInterest } = await import('./promotions')
                    await registerProductInterest({
                      userId,
                      instanceId,
                      contactNumber,
                      productId: node.id,
                      productType: 'catalog',
                      productName: nodeData.name,
                      interestType: 'viewed',
                    })
                  } catch (error) {
                    // Ignora erros de registro de interesse
                    console.error('Erro ao registrar interesse do serviço:', error)
                  }
                }
              } else {
                console.log(`⚠️ Nó ignorado: tipo=${node.type}, tem nome=${!!nodeData.name}`)
              }
            } catch (e) {
              console.error('❌ Erro ao parsear dados do nó do catálogo:', e, 'Node data:', node.data)
            }
          }

          // Se há catalogId, SEMPRE usar produtos/serviços do catálogo (substitui os manuais)
          // Limpa produtos/serviços manuais quando há catálogo
          businessDetails.products = catalogProducts.length > 0 ? catalogProducts : []
          businessDetails.services = catalogServices.length > 0 ? catalogServices : []
          
          // Armazena informações de agendamento dos serviços
          businessDetails.servicesWithAppointment = servicesWithAppointment
          
          console.log(`📦 Produtos do catálogo carregados: ${catalogProducts.length} produtos`, catalogProducts)
          console.log(`🛠️ Serviços do catálogo carregados: ${catalogServices.length} serviços`, catalogServices)
          console.log(`🔄 Produtos/Serviços manuais foram SUBSTITUÍDOS pelos do catálogo`)
          
          // Log para debug
          console.log(`📊 Catálogo processado:`, {
            catalogId: businessDetails.catalogId,
            catalogName: catalog.name,
            nodesCount: catalog.nodes.length,
            productsFound: catalogProducts.length,
            servicesFound: catalogServices.length,
            products: catalogProducts,
            services: catalogServices
          })
        } else {
          console.error(`❌ Catálogo não encontrado: catalogId=${businessDetails.catalogId}, userId=${userId}`)
          console.error(`⚠️ Usando produtos/serviços manuais porque catálogo não foi encontrado`)
        }
      } catch (error) {
        console.error('❌ Erro ao buscar catálogo:', error)
        console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A')
      }
    } else {
      console.log(`ℹ️ Nenhum catalogId configurado. Usando produtos/serviços manuais.`)
    }

    console.log(`📊 Dados do negócio carregados:`, {
      hasBusinessDetails: !!workflow.aiBusinessDetails,
      businessName: businessDetails.businessName,
      catalogId: businessDetails.catalogId,
      hasServices: !!(businessDetails.services && businessDetails.services.length > 0),
      servicesCount: businessDetails.services?.length || 0,
      services: businessDetails.services,
      hasProducts: !!(businessDetails.products && businessDetails.products.length > 0),
      productsCount: businessDetails.products?.length || 0,
      products: businessDetails.products,
      hasHowToBuy: !!businessDetails.howToBuy,
      hasPricing: !!businessDetails.pricingInfo
    })

    // Gera contexto aprimorado de agendamentos (similar ao Midas)
    let appointmentContext = ''
    try {
      appointmentContext = await generateEnhancedAppointmentContext(
        workflow.userId,
        instanceId,
        contactNumber
      )
    } catch (error) {
      console.error('Erro ao gerar contexto de agendamentos:', error)
      // Continua sem contexto de agendamentos se houver erro
    }

    // Monta o prompt do sistema com os detalhes do negócio usando a nova estrutura modular
    const systemPrompt = buildSystemPrompt(
      businessDetails,
      contactNameFinal || formattedPhoneFormatted,
      appointmentContext
    )

    // Verifica se é a primeira interação (poucas mensagens na conversa ou nenhuma resposta da IA ainda)
    // Considera primeira interação se há menos de 3 mensagens OU se não há nenhuma mensagem da IA ainda
    const hasAIResponse = recentMessages.some(msg => msg.isFromMe)
    const isFirstInteraction = conversationHistory.length <= 2 || !hasAIResponse
    
    console.log(`🔍 Debug primeira interação:`, {
      conversationHistoryLength: conversationHistory.length,
      hasAIResponse,
      isFirstInteraction,
      recentMessagesCount: recentMessages.length,
      businessName: businessDetails.businessName,
      hasBusinessDetails: !!workflow.aiBusinessDetails
    })
    
    // SEMPRE usa resposta pré-definida se:
    // 1. É primeira interação E tem nome do negócio
    // 2. OU se não há resposta da IA ainda (primeira vez que o workflow responde)
    // Isso garante que sempre apresente o negócio corretamente, sem depender da IA
    const shouldUsePredefined = (isFirstInteraction || !hasAIResponse) && businessDetails.businessName
    
    console.log(`🤖 Decisão de resposta:`, {
      shouldUsePredefined,
      isFirstInteraction,
      hasBusinessName: !!businessDetails.businessName,
      businessName: businessDetails.businessName
    })
    
    if (shouldUsePredefined) {
      const servicesList = businessDetails.services?.join(', ') || ''
      const productsList = businessDetails.products?.join(', ') || ''
      const howToBuyText = businessDetails.howToBuy || ''
      const pricingText = businessDetails.pricingInfo || ''
      const businessDesc = businessDetails.businessDescription || ''
      
      // Monta resposta pré-definida para garantir que sempre apresente o negócio
      let predefinedResponse = ''
      
      // Monta resposta mais natural e conversacional
      if (howToBuyText && howToBuyText.trim().length > 10) {
        predefinedResponse = `${howToBuyText}`
      } else {
        // Não precisa sempre mencionar "assistente da..." - seja mais natural
        predefinedResponse = `Olá! 👋`
        if (businessDesc) {
          predefinedResponse += ` ${businessDesc}`
        }
      }
      
      if (servicesList || productsList) {
        predefinedResponse += `\n\n`
        if (servicesList && productsList) {
          predefinedResponse += `Oferecemos os seguintes serviços:\n${servicesList.split(', ').map((s: string) => `- ${s}`).join('\n')}\n\nTambém temos os seguintes produtos:\n${productsList.split(', ').map((p: string) => `- ${p}`).join('\n')}`
        } else if (servicesList) {
          const servicesArray = servicesList.split(', ')
          predefinedResponse += `Oferecemos os seguintes serviços:\n${servicesArray.map((s: string) => `- ${s}`).join('\n')}`
        } else if (productsList) {
          const productsArray = productsList.split(', ')
          predefinedResponse += `Temos os seguintes produtos:\n${productsArray.map((p: string) => `- ${p}`).join('\n')}`
        }
      }
      
      if (pricingText) {
        predefinedResponse += `\n\n${pricingText}`
      }
      
      // Finalização mais natural e variada
      const closings = [
        'Em que posso ajudar?',
        'Tem alguma dúvida?',
        'Quer saber mais sobre algum deles?',
        'Qual te interessa?'
      ]
      const randomClosing = closings[Math.floor(Math.random() * closings.length)]
      predefinedResponse += `\n\n${randomClosing}`
      
      // Envia imagem primeiro se configurado
      if (businessDetails.businessImage && businessDetails.sendImageInFirstMessage) {
        const { sendWhatsAppImage } = await import('./whatsapp-cloud-api')
        const contactKeyImage = `${instanceId}-${contactNumber}`
        await queueMessage(contactKeyImage, async () => {
          await sendWhatsAppImage(instanceId, contactNumber, businessDetails.businessImage!, predefinedResponse.trim())
        })
        console.log(`🖼️ Imagem do negócio enviada na primeira mensagem para ${contactNumber}`)
      } else {
        // Envia apenas a mensagem de texto
        const contactKey = `${instanceId}-${contactNumber}`
        await queueMessage(contactKey, async () => {
          await sendWhatsAppMessage(instanceId, contactNumber, predefinedResponse.trim(), 'service')
        })
      }
      
      console.log(`🤖 Resposta pré-definida enviada para ${contactNumber} (primeira interação)`)
      return // Não gera resposta da IA na primeira vez, usa a pré-definida
    }
    
    // Para mensagens seguintes, usa IA normalmente
    // MAS sempre força mencionar o negócio mesmo em mensagens seguintes
    let userMessageWithContext = userMessage
    
    // Adiciona contexto FORTE mesmo em mensagens seguintes para garantir que sempre mencione o negócio
    if (businessDetails.businessName) {
      const servicesList = businessDetails.services?.join('\n- ') || ''
      const productsList = businessDetails.products?.join('\n- ') || ''
      
      let listFormatting = ''
      if (servicesList || productsList) {
        listFormatting = `\n\n⚠️ IMPORTANTE: Quando listar produtos ou serviços, SEMPRE use formato de lista:\n`
        if (servicesList) {
          listFormatting += `- ${servicesList}\n`
        }
        if (productsList) {
          listFormatting += `- ${productsList}\n`
        }
        listFormatting += `NUNCA use vírgulas. SEMPRE use marcadores (-) e quebra de linha.`
      }
      
      userMessageWithContext = `[CONTEXTO: Você representa ${businessDetails.businessName}. Seja NATURAL e CONVERSACIONAL como uma pessoa real. Não precisa se apresentar repetidamente - apenas na primeira mensagem se necessário. Fale de forma natural, como em uma conversa normal. Varie suas respostas - não termine sempre com "Como posso te ajudar?". Seja direto e objetivo. NUNCA seja genérico como "teste de eco".${listFormatting}]\n\nMensagem do cliente: ${userMessage}`
    }

    // Registra interesse quando cliente menciona produto/serviço ou pede desconto
    try {
      const { registerProductInterest } = await import('./promotions')
      const { detectDiscountRequest } = await import('./ai-promotions')
      
      // Detecta se cliente pediu desconto
      if (detectDiscountRequest(userMessage)) {
        // Tenta identificar qual produto/serviço o cliente está interessado
        // Busca serviços do usuário para ver se algum foi mencionado
        const userServices = await prisma.service.findMany({
          where: { userId: workflow.userId },
          select: { id: true, name: true },
        })
        
        for (const service of userServices) {
          if (userMessage.toLowerCase().includes(service.name.toLowerCase())) {
            await registerProductInterest({
              userId: workflow.userId,
              instanceId,
              contactNumber,
              productId: service.id,
              productType: 'service',
              productName: service.name,
              interestType: 'requested_discount',
            })
            break
          }
        }
      }
    } catch (error) {
      log.error('Erro ao registrar interesse', error)
      // Continua mesmo se houver erro
    }

    // Gera resposta usando IA
    const { generateAIResponse } = await import('./openai')
    
    // Se for primeira interação, não usa histórico para forçar seguir o template
    // E aumenta temperatura para ser mais criativo seguindo as instruções
    const finalConversationHistory = isFirstInteraction ? [] : conversationHistory
    const temperature = isFirstInteraction ? 0.9 : 0.8 // Mais criativo e natural
    
    console.log(`🤖 Gerando resposta IA-only. Primeira interação: ${isFirstInteraction}, Histórico: ${finalConversationHistory.length} mensagens`)
    
    // Define funções de agendamento para a IA usar quando necessário
    // Função principal: criar agendamento
    const appointmentFunction = {
      name: 'create_appointment',
      description: 'Cria um agendamento na agenda quando o cliente quer marcar um horário. Use esta função APENAS quando você tiver coletado tanto a DATA quanto a HORA do cliente. A função verifica automaticamente se o horário está disponível antes de criar.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Data do agendamento. Você pode passar no formato DD/MM/YYYY (ex: "24/11/2025") OU linguagem natural em português (ex: "amanhã", "próxima segunda-feira", "terça que vem"). ⚠️ CRÍTICO: SEMPRE repasse exatamente o que o cliente disse ("amanhã", "próxima terça", etc.) que o sistema converte automaticamente usando a data atual.',
          },
          time: {
            type: 'string',
            description: 'Hora do agendamento no formato HH:MM em horário de 24 horas (ex: "14:00", "16:00", "19:00"). Se o cliente disser "4 da tarde", converta para "16:00". Se disser "7 da manhã", converta para "07:00". Se disser "9 da noite", converta para "21:00". Se não especificar hora, use "14:00" como padrão.',
          },
          description: {
            type: 'string',
            description: 'Descrição do agendamento, incluindo o que será feito, serviço solicitado, ou motivo do agendamento.',
          },
        },
        required: ['date', 'time', 'description'],
      },
    }

    // Função auxiliar para criar uma data no fuso horário do Brasil e converter para UTC
    // Recebe componentes de data/hora no horário do Brasil e retorna um Date em UTC
    const createBrazilianDateAsUTC = (year: number, month: number, day: number, hour: number, minute: number): Date => {
      // Cria uma string ISO assumindo que é no fuso do Brasil (UTC-3)
      // Formato: YYYY-MM-DDTHH:mm:ss-03:00
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`
      
      // Cria a data a partir da string ISO (JavaScript converte automaticamente para UTC)
      return new Date(dateStr)
    }
    
    // Função auxiliar para converter data de UTC para componentes do Brasil
    const utcToBrazilianComponents = (utcDate: Date): { year: number; month: number; day: number; hour: number; minute: number } => {
      const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(utcDate)
      
      return {
        year: parseInt(parts.find(p => p.type === 'year')!.value),
        month: parseInt(parts.find(p => p.type === 'month')!.value) - 1,
        day: parseInt(parts.find(p => p.type === 'day')!.value),
        hour: parseInt(parts.find(p => p.type === 'hour')!.value),
        minute: parseInt(parts.find(p => p.type === 'minute')!.value),
      }
    }

    // Função auxiliar para converter datas relativas em português
    const parsePortugueseDate = (dateStr: string): Date | null => {
      const lower = dateStr.toLowerCase().trim()
      const nowBrazilian = getBrazilDate() // Usa horário do Brasil
      
      // Extrai hora se mencionada (ex: "5 da tarde", "17h", "17:00", "meio-dia")
      let targetHour = 14 // Padrão: 14:00
      let targetMinute = 0
      
      // Verifica "meio-dia" primeiro
      if (lower.includes('meio-dia') || lower.includes('meio dia')) {
        targetHour = 12
        targetMinute = 0
      } else {
      // Procura por padrões de hora - MELHORADO para entender mais variações
      const hourPatterns = [
        /às?\s*(\d{1,2})\s*(?:da\s*)?(?:tarde|manhã|manha|noite)/i, // "às 4 da tarde", "as 5 da tarde"
        /(\d{1,2})\s*(?:da\s*)?(?:tarde|manhã|manha|noite)/i, // "5 da tarde", "17 da tarde"
        /às?\s*(\d{1,2})(?:\s*h)?/i, // "às 4", "as 4h", "às 16"
        /(\d{1,2}):(\d{2})/, // "17:30"
        /(\d{1,2})h/i, // "17h", "4h"
      ]
      
      for (const pattern of hourPatterns) {
        const match = lower.match(pattern)
        if (match) {
          targetHour = parseInt(match[1])
          if (match[2]) {
            targetMinute = parseInt(match[2])
          }
          
          // Se mencionou "tarde" ou "noite" e hora < 12, adiciona 12 (ex: "5 da tarde" = 17h, "às 4" = 16h se contexto for tarde)
          if ((lower.includes('tarde') || lower.includes('noite')) && targetHour < 12) {
            targetHour += 12
          } else if (lower.includes('às') || lower.includes('as')) {
            // Se disse "às X" sem especificar manhã/tarde/noite, assume tarde se X < 12
            // Mas se X >= 12, já está em formato 24h
            if (targetHour < 12 && !lower.includes('manhã') && !lower.includes('manha')) {
              // Se não especificou manhã e é < 12, assume tarde (mais comum)
            targetHour += 12
            }
          }
          break
          }
        }
      }
      
      // Usa utilitário compartilhado (estilo Midas) para converter datas relativas
      const relativeDate = parseRelativeDate(lower)
      if (relativeDate) {
        const year = relativeDate.getFullYear()
        const month = relativeDate.getMonth()
        const day = relativeDate.getDate()
        const utcDate = createBrazilianDateAsUTC(year, month, day, targetHour, targetMinute)
        console.log(`📅 parseRelativeDate → ${day}/${month + 1}/${year} às ${targetHour}:${targetMinute.toString().padStart(2, '0')}`)
        return utcDate
      }

      // Tenta parsear como ISO primeiro
      const isoDate = new Date(dateStr)
      if (!isNaN(isoDate.getTime())) {
        // Se a data ISO tem ano anterior ao atual, corrige para o ano atual
        const currentYear = nowBrazilian.getFullYear()
        if (isoDate.getFullYear() < currentYear) {
          isoDate.setFullYear(currentYear)
          console.log(`⚠️ Corrigindo ano de ${isoDate.getFullYear() - 1} para ${currentYear}`)
        }
        return isoDate
      }
      
      // Tenta parsear formatos comuns
      const formats = [
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
        /(\d{1,2})\/(\d{1,2})/, // DD/MM (sem ano, assume ano atual)
      ]
      
      for (const format of formats) {
        const match = dateStr.match(format)
        if (match) {
          if (format === formats[0]) {
            // DD/MM/YYYY
            const day = parseInt(match[1])
            const month = parseInt(match[2]) - 1
            let year = parseInt(match[3])
            // Se ano < ano atual, corrige
            if (year < nowBrazilian.getFullYear()) {
              year = nowBrazilian.getFullYear()
            }
            const date = new Date(year, month, day, targetHour, targetMinute, 0, 0)
            return date
          } else if (format === formats[1]) {
            // YYYY-MM-DD
            let year = parseInt(match[1])
            const month = parseInt(match[2]) - 1
            const day = parseInt(match[3])
            // Se ano < ano atual, corrige
            if (year < nowBrazilian.getFullYear()) {
              year = nowBrazilian.getFullYear()
            }
            const date = new Date(year, month, day, targetHour, targetMinute, 0, 0)
            return date
          } else if (format === formats[2]) {
            // DD/MM (sem ano)
            const day = parseInt(match[1])
            const month = parseInt(match[2]) - 1
            const year = nowBrazilian.getFullYear()
            const date = new Date(year, month, day, targetHour, targetMinute, 0, 0)
            return date
          }
        }
      }
      
      return null
    }

    // Handler para quando a IA chamar a função de agendamento
    // Agora recebe data e hora separadamente para processamento mais simples e confiável
    const handleFunctionCall = async (functionName: string, args: any) => {
      console.log(`🔧 handleFunctionCall chamado: functionName="${functionName}", userId=${userId}, instanceId=${instanceId}`)
      
      // CRÍTICO: Normaliza o número ANTES de qualquer processamento
      const normalizedContactNumber = contactNumber.replace(/\D/g, '')
      console.log(`🔧 handleFunctionCall - contactNumber original: "${contactNumber}"`)
      console.log(`🔧 handleFunctionCall - contactNumber normalizado: "${normalizedContactNumber}"`)
      
      if (functionName === 'create_appointment' && userId) {
        try {
          console.log(`📅 Tentando criar agendamento com args:`, args)
          console.log(`📅 Contexto: userId=${userId}, instanceId=${instanceId}, contactNumber=${normalizedContactNumber}`)
          
          // CRÍTICO: Verifica se já há um agendamento pendente antes de criar um novo (usa número normalizado)
          const { getPendingAppointment } = await import('./pending-appointments')
          const existingPending = await getPendingAppointment(instanceId, normalizedContactNumber)
          if (existingPending) {
            console.log(`⚠️ Já existe um agendamento pendente. Não criando novo. Retornando mensagem de relembrança.`)
            let reminderMessage = `Você já tem um agendamento pendente de confirmação:\n\n📅 Data: ${existingPending.date}\n🕐 Hora: ${existingPending.time}`
            if (existingPending.duration) {
              reminderMessage += `\n⏱️ Duração: ${existingPending.duration} minutos`
            }
            reminderMessage += `\n🛠️ Serviço: ${existingPending.service}\n\nDigite "confirmar" para confirmar ou "cancelar" para cancelar.`
            return {
              success: false,
              pending: true,
              error: reminderMessage,
              message: reminderMessage,
            }
          }
          
          // CRÍTICO: Verifica se acabou de confirmar um agendamento (últimos 60 segundos)
          // Se sim, não cria novo agendamento para evitar loop (usa número normalizado)
          // Usa select explícito para evitar erro se endDate não existir no banco
          const recentConfirmedAppointment = await prisma.appointment.findFirst({
            where: {
              instanceId,
              contactNumber: normalizedContactNumber, // Usa número normalizado
              createdAt: {
                gte: new Date(Date.now() - 60000), // Últimos 60 segundos
              },
            },
            select: {
              id: true,
              createdAt: true,
              date: true,
              description: true,
              status: true,
              // endDate e duration podem não existir no banco ainda
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
          
          if (recentConfirmedAppointment) {
            console.log(`⚠️ Agendamento confirmado recentemente encontrado. Não criando novo agendamento para evitar loop.`)
            return {
              success: false,
              error: 'Você acabou de confirmar um agendamento. Se precisar fazer outro agendamento, aguarde alguns instantes.',
            }
          }
          
          // Validações iniciais
          if (!userId) {
            console.error('❌ userId não está definido')
            return {
              success: false,
              error: 'Erro interno: userId não está definido',
            }
          }
          
          if (!instanceId) {
            console.error('❌ instanceId não está definido')
            return {
              success: false,
              error: 'Erro interno: instanceId não está definido',
            }
          }
          
          if (!contactNumber) {
            console.error('❌ contactNumber não está definido')
            return {
              success: false,
              error: 'Erro interno: contactNumber não está definido',
            }
          }
          
          // Valida que temos data e hora
          if (!args.date || !args.time) {
            return {
              success: false,
              error: 'É necessário informar tanto a data quanto a hora do agendamento.',
            }
          }
          
          // Processa a hora primeiro - MELHORADO para aceitar mais formatos
          let hour: number
          let minute: number
          
          const timeLower = args.time.toLowerCase().trim()
          
          // Verifica se é "meio-dia"
          if (timeLower.includes('meio-dia') || timeLower.includes('meio dia')) {
            hour = 12
            minute = 0
          } else {
            // Tenta múltiplos formatos de hora
            let timeMatch: RegExpMatchArray | null = null
            
            // Formato HH:MM (ex: "16:00", "4:00")
            timeMatch = args.time.match(/(\d{1,2}):(\d{2})/)
            
            // Se não encontrou, tenta formato "Xh" ou "X" (ex: "16h", "4", "às 4")
          if (!timeMatch) {
              // Remove "às" ou "as" se presente
              const cleanedTime = timeLower.replace(/^às?\s*/, '').replace(/\s*h$/, '')
              const numberMatch = cleanedTime.match(/^(\d{1,2})$/)
              if (numberMatch) {
                hour = parseInt(numberMatch[1])
                minute = 0
                
                // Se hora < 12 e não especificou manhã, assume tarde (mais comum)
                // Mas se hora >= 12, já está em formato 24h
                if (hour < 12) {
                  // Verifica contexto da mensagem original para decidir se é manhã ou tarde
                  // Por padrão, assume tarde se não especificado
                  hour += 12
                }
              } else {
            return {
              success: false,
                  error: `Hora inválida: "${args.time}". Use formato HH:MM (ex: 16:00), apenas o número (ex: 16), ou "meio-dia".`,
            }
          }
            } else {
            hour = parseInt(timeMatch[1])
            minute = parseInt(timeMatch[2])
            }
          
          // Valida valores
            if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            return {
              success: false,
                error: 'Hora inválida. Verifique os valores informados.',
              }
            }
          }
          
          console.log(`🕐 [handleFunctionCall] Hora parseada: "${args.time}" → ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
          
          // Tenta primeiro parsear como data em português (dias da semana, "amanhã", etc)
          // Mas agora passamos a hora também para parsePortugueseDate considerar
          let appointmentDateUTC: Date | null = null
          
          // Cria uma string combinada de data e hora para parsePortugueseDate processar
          const dateTimeStr = `${args.date} ${args.time}`
          let parsedPortugueseDate = parsePortugueseDate(dateTimeStr)
          
          // Fallback: se a IA mandou data já convertida (ex: DD/MM) mas o cliente falou em linguagem natural,
          // tenta interpretar a data direto da mensagem original para evitar erros como "próxima segunda = 29/11".
          if (!parsedPortugueseDate && userMessage) {
            const parsedFromUserMessage = parsePortugueseDate(`${userMessage} ${args.time}`)
            if (parsedFromUserMessage) {
              parsedPortugueseDate = parsedFromUserMessage
              console.log(`📅 [handleFunctionCall] Data reinterpretada a partir da mensagem original do cliente: "${userMessage}"`)
            }
          }
          
          if (parsedPortugueseDate) {
            // Se conseguiu parsear como data em português, já vem em UTC com hora
            appointmentDateUTC = parsedPortugueseDate
            const brazilianCheck = utcToBrazilianComponents(appointmentDateUTC)
            console.log(`📅 Data parseada do português (UTC): ${appointmentDateUTC.toISOString()}`)
            console.log(`📅 Data parseada do português (Brasil): ${brazilianCheck.day}/${brazilianCheck.month + 1}/${brazilianCheck.year} às ${brazilianCheck.hour}:${brazilianCheck.minute.toString().padStart(2, '0')}`)
          }
          
          // Se não conseguiu parsear como português, tenta formato DD/MM/YYYY
          if (!appointmentDateUTC) {
            const dateMatch = args.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
            if (!dateMatch) {
              return {
                success: false,
                error: `Data inválida: "${args.date}". Use o formato DD/MM/YYYY (ex: 24/11/2025) ou linguagem natural (ex: "terça-feira", "amanhã").`,
            }
          }
            
            const day = parseInt(dateMatch[1])
            const month = parseInt(dateMatch[2]) - 1 // JavaScript usa meses 0-11
            let year = parseInt(dateMatch[3])
          
          // Cria a data no horário do Brasil
          const nowBrazilian = getBrazilDate()
          const currentYear = nowBrazilian.getFullYear()
          
          // Corrige o ano se necessário
          if (year < currentYear) {
              year = currentYear
              console.log(`⚠️ Ano ${year} é menor que o atual (${currentYear}), corrigindo para ${year}`)
          } else if (year > currentYear + 1) {
              year = currentYear
              console.log(`⚠️ Ano ${year} é muito no futuro, corrigindo para ${year}`)
          }
          
            // Cria a data no fuso do Brasil e converte para UTC com a hora correta
            appointmentDateUTC = createBrazilianDateAsUTC(year, month, day, hour, minute)
          } else {
            // Se já parseou do português mas a hora pode estar errada, recria com a hora correta
            const brazilianComponents = utcToBrazilianComponents(appointmentDateUTC)
            appointmentDateUTC = createBrazilianDateAsUTC(
              brazilianComponents.year,
              brazilianComponents.month,
              brazilianComponents.day,
              hour,
              minute
            )
          }
          
          // Obtém componentes brasileiros para validação
          const brazilianComponents = utcToBrazilianComponents(appointmentDateUTC)
          const day = brazilianComponents.day
          const month = brazilianComponents.month
          const year = brazilianComponents.year
          
          
          // Cria a data no horário do Brasil para comparação
          const nowBrazilian = getBrazilDate()
          const currentYear = nowBrazilian.getFullYear()
          const currentMonth = nowBrazilian.getMonth()
          const currentDay = nowBrazilian.getDate()
          const currentHour = nowBrazilian.getHours()
          const currentMinute = nowBrazilian.getMinutes()
          
          console.log(`📅 Data/hora recebida da IA: date="${args.date}", time="${args.time}"`)
          console.log(`📅 Data/hora atual (Brasil): ${currentDay}/${currentMonth + 1}/${currentYear} às ${currentHour}:${currentMinute.toString().padStart(2, '0')}`)
          console.log(`📅 Data/hora processada (Brasil): ${day}/${month + 1}/${year} às ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
          console.log(`📅 Data/hora processada (UTC): ${appointmentDateUTC.toISOString()}`)
          
          // Valida se a data não é no passado (comparando componentes brasileiros)
          const appointmentDateOnly = new Date(year, month, day)
          const todayOnly = new Date(currentYear, currentMonth, currentDay)
          
          // Se a data é hoje, verifica se a hora não passou
          if (appointmentDateOnly.getTime() === todayOnly.getTime()) {
            const appointmentTime = hour * 60 + minute
            const currentTime = currentHour * 60 + currentMinute
            if (appointmentTime <= currentTime) {
              console.error(`❌ Hora no passado hoje (Brasil): ${hour}:${minute.toString().padStart(2, '0')} <= ${currentHour}:${currentMinute.toString().padStart(2, '0')}`)
              return {
                success: false,
                error: 'Não é possível agendar para um horário que já passou hoje. Por favor, escolha um horário futuro.',
              }
            }
          } else if (appointmentDateOnly < todayOnly) {
            console.error(`❌ Data no passado (Brasil): ${day}/${month + 1}/${year} < ${currentDay}/${currentMonth + 1}/${currentYear}`)
            return {
              success: false,
              error: 'Não é possível agendar para uma data no passado. Por favor, escolha uma data futura.',
            }
          }
          
          // Verifica se a conversão está correta
          const verificationBrazilian = utcToBrazilianComponents(appointmentDateUTC)
          console.log(`📅 Verificação (UTC→Brasil): ${verificationBrazilian.day}/${verificationBrazilian.month + 1}/${verificationBrazilian.year} às ${verificationBrazilian.hour}:${verificationBrazilian.minute.toString().padStart(2, '0')}`)
          
          // Valida se a hora está correta após conversão
          if (verificationBrazilian.hour !== hour || verificationBrazilian.minute !== minute) {
            console.error(`❌ ERRO: Hora não corresponde após conversão! Esperado: ${hour}:${minute.toString().padStart(2, '0')}, Obtido: ${verificationBrazilian.hour}:${verificationBrazilian.minute.toString().padStart(2, '0')}`)
          }

          // Formata data e hora para exibição (declara ANTES de usar)
          const formattedDate = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`
          const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
          
          // CRÍTICO: Busca informações do serviço para obter duração e imagem
          // A duração DEVE vir do serviço, não pode ser um padrão fixo
          let serviceDuration: number | undefined
          let serviceImageUrl: string | undefined
          const servicesWithAppointment: ServiceWithAppointment[] = businessDetails.servicesWithAppointment || []
          const serviceName = args.description?.toLowerCase().trim() || ''
          
          console.log(`🔍 [handleFunctionCall] Buscando dados do serviço: "${serviceName}"`)
          console.log(`🔍 [handleFunctionCall] Serviços disponíveis:`, servicesWithAppointment.map((s) => `${s.name} (${s.duration || 'sem duração'} min)`))
          
          let matchedService: ServiceWithAppointment | null = null
          
          if (serviceName && servicesWithAppointment.length > 0) {
          for (const service of servicesWithAppointment) {
              if (!service.name) continue
              const serviceNameLower = service.name.toLowerCase()
              const firstWord = serviceNameLower.split(' ')[0]
              
              // Verifica se o nome do serviço está na descrição OU se a descrição está no nome do serviço
              if (
                serviceName.includes(serviceNameLower) ||
                serviceNameLower.includes(serviceName) ||
                (firstWord && serviceName.includes(firstWord))
              ) {
                matchedService = service
                console.log(`✅ [handleFunctionCall] Serviço identificado: ${service.name}`)
              break
              }
            }
          }
          
          if (matchedService) {
            serviceDuration = matchedService.duration
            serviceImageUrl = matchedService.imageUrl
            console.log(`✅ [handleFunctionCall] Duração encontrada: ${matchedService.name} = ${serviceDuration} minutos`)
            if (serviceImageUrl) {
              console.log(`🖼️ [handleFunctionCall] Imagem encontrada para o serviço: ${serviceImageUrl}`)
            }
          }
          
          // CRÍTICO: Se não encontrou a duração, retorna erro ANTES de criar agendamento pendente
          if (!serviceDuration || serviceDuration <= 0) {
            console.error(`❌ [handleFunctionCall] Duração do serviço não encontrada ou inválida!`)
            console.error(`   Serviço procurado: "${serviceName}"`)
            console.error(`   Descrição completa: "${args.description}"`)
            console.error(`   Serviços disponíveis:`, servicesWithAppointment)
            
            // Lista serviços disponíveis para ajudar o usuário
            const availableServices = servicesWithAppointment.map((s) => s.name).join(', ')
            const errorMessage = `Não foi possível determinar a duração do serviço "${args.description || 'não especificado'}".\n\nServiços disponíveis com agendamento:\n${servicesWithAppointment.map((s) => `- ${s.name}${s.duration ? ` (${s.duration} min)` : ' (duração não configurada)'}`).join('\n')}\n\nPor favor, verifique se o serviço tem duração configurada no catálogo.`
            
            return {
              success: false,
              error: errorMessage,
            }
          }
          
          // CRÍTICO: Verifica disponibilidade ANTES de criar agendamento pendente
          // Verifica tanto agendamentos confirmados quanto pendentes
          console.log(`🔍 [handleFunctionCall] Verificando disponibilidade do horário...`)
          const availabilityCheck = await checkAvailability(userId, appointmentDateUTC, instanceId)
          
          // CRÍTICO: Também verifica agendamentos pendentes de confirmação
          let pendingConflict = false
          try {
            const allPending = await prisma.pendingAppointment.findMany({
              where: {
                userId,
                instanceId,
                date: formattedDate,
                expiresAt: {
                  gt: new Date(),
                },
              },
            })
            
            // Verifica se há conflito com agendamentos pendentes
            for (const pending of allPending) {
              const [pendingHour, pendingMinute] = pending.time.split(':').map(Number)
              const pendingDuration = pending.duration || 60
              
              // Verifica se o horário solicitado conflita com algum pendente
              // CRÍTICO: Usa a duração real do serviço, não padrão fixo
              const requestedStart = hour * 60 + minute
              const requestedEnd = requestedStart + serviceDuration // Duração do serviço
              const pendingStart = pendingHour * 60 + pendingMinute
              const pendingEnd = pendingStart + pendingDuration
              
              if (requestedStart < pendingEnd && requestedEnd > pendingStart) {
                pendingConflict = true
                console.log(`⚠️ [handleFunctionCall] Conflito com agendamento pendente: ${pending.time} - ${pending.service}`)
                break
              }
            }
          } catch (error) {
            console.error('Erro ao verificar agendamentos pendentes:', error)
            // Continua mesmo se houver erro
          }
          
          if (availabilityCheck.success && availabilityCheck.appointments) {
            // Verifica se há conflitos de horário com agendamentos confirmados
            // CRÍTICO: Usa a duração real do serviço, não padrão fixo
            const appointmentDuration = serviceDuration // Duração do serviço em minutos
            const appointmentStart = appointmentDateUTC
            const appointmentEnd = new Date(appointmentStart.getTime() + appointmentDuration * 60000)
            
            let hasConflict = false
            let conflictMessage = ''
            
            for (const existingApt of availabilityCheck.appointments) {
              const existingStart = new Date(existingApt.date)
              // CRÍTICO: Usa horário de término real se disponível, senão calcula baseado na duração
              const existingEnd = existingApt.endDate 
                ? new Date(existingApt.endDate)
                : new Date(existingStart.getTime() + (existingApt.duration || 60) * 60000)
              
              // Verifica sobreposição de intervalos
              if (appointmentStart < existingEnd && appointmentEnd > existingStart) {
                hasConflict = true
                const existingFormattedDate = existingStart.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
                const existingFormattedStartTime = existingStart.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                const existingFormattedEndTime = existingEnd.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                
                conflictMessage = `❌ Este horário não está disponível!\n\nJá existe um agendamento:\n📅 Data: ${existingFormattedDate}\n🕐 Horário: ${existingFormattedStartTime} às ${existingFormattedEndTime}`
                if (existingApt.description) {
                  conflictMessage += `\n🛠️ Serviço: ${existingApt.description}`
                }
                conflictMessage += `\n\nPor favor, escolha outro horário ou pergunte quais horários estão disponíveis usando "quais horários estão disponíveis?".`
                console.log(`⚠️ [handleFunctionCall] Conflito de horário detectado!`)
                break
              }
            }
            
            if (hasConflict || pendingConflict) {
              if (pendingConflict && !hasConflict) {
                conflictMessage = `❌ Este horário não está disponível!\n\nJá existe um agendamento pendente de confirmação para este horário.\n\nPor favor, escolha outro horário ou pergunte quais horários estão disponíveis usando "quais horários estão disponíveis?".`
              }
              
              return {
                success: false,
                error: conflictMessage,
                message: conflictMessage,
              }
            }
          } else if (pendingConflict) {
            return {
              success: false,
              error: `❌ Este horário não está disponível!\n\nJá existe um agendamento pendente de confirmação para este horário.\n\nPor favor, escolha outro horário ou pergunte quais horários estão disponíveis usando "quais horários estão disponíveis?".`,
              message: `❌ Este horário não está disponível!\n\nJá existe um agendamento pendente de confirmação para este horário.\n\nPor favor, escolha outro horário ou pergunte quais horários estão disponíveis usando "quais horários estão disponíveis?".`,
            }
          }
          
          console.log(`✅ [handleFunctionCall] Horário disponível! Prosseguindo com criação do agendamento pendente.`)
          
          // Armazena temporariamente o agendamento pendente
          console.log(`📅📅📅 [handleFunctionCall] ========== CRIANDO AGENDAMENTO PENDENTE ==========`)
          console.log(`   instanceId: ${instanceId}`)
          console.log(`   contactNumber: ${contactNumber}`)
          console.log(`   userId: ${userId}`)
          console.log(`   date: ${formattedDate}`)
          console.log(`   time: ${formattedTime}`)
          console.log(`   service: ${args.description || 'Serviço não especificado'}`)
          
          // CRÍTICO: NÃO limpa a execução aqui - ela ainda é necessária para continuar o fluxo
          // A execução só será limpa quando o agendamento for confirmado ou cancelado
          
          const { storePendingAppointment, getPendingAppointment: verifyPending } = await import('./pending-appointments')
          
          try {
            // CRÍTICO: Usa número normalizado para garantir consistência
            await storePendingAppointment(instanceId, normalizedContactNumber, {
            date: formattedDate,
            time: formattedTime,
            duration: serviceDuration,
            service: args.description || 'Serviço não especificado',
            description: args.description,
            }, userId) // Passa userId como parâmetro obrigatório
            
            console.log(`✅✅✅ [handleFunctionCall] storePendingAppointment chamado com SUCESSO`)
          } catch (storeError) {
            console.error(`❌❌❌ [handleFunctionCall] ERRO ao chamar storePendingAppointment:`, storeError)
            console.error(`❌❌❌ [handleFunctionCall] Stack trace:`, storeError instanceof Error ? storeError.stack : 'N/A')
            throw storeError // Propaga o erro
          }
          
          // CRÍTICO: Aguarda e verifica se foi salvo corretamente ANTES de retornar
          // Tenta múltiplas vezes com delays crescentes para garantir sincronização
          // CRÍTICO: Aumenta tentativas e delays para garantir que está salvo antes de retornar
          let verification: any = null
          const maxRetries = 5 // Aumentado de 3 para 5
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            // Delay crescente mais agressivo: 200ms, 400ms, 600ms, 800ms, 1000ms
            await new Promise(resolve => setTimeout(resolve, 200 * attempt))
            
            // CRÍTICO: Usa número normalizado para verificação
            verification = await verifyPending(instanceId, normalizedContactNumber)
          if (verification) {
              console.log(`✅✅✅ [handleFunctionCall] VERIFICAÇÃO (tentativa ${attempt}/${maxRetries}): Agendamento pendente confirmado no banco`)
            console.log(`✅✅✅ [handleFunctionCall] Dados verificados:`, JSON.stringify(verification, null, 2))
              break
            } else if (attempt < maxRetries) {
              console.log(`⚠️ [handleFunctionCall] Tentativa ${attempt}/${maxRetries} falhou, tentando novamente...`)
            }
          }
          
          if (!verification) {
            console.error(`❌❌❌ [handleFunctionCall] ERRO CRÍTICO: Agendamento pendente NÃO encontrado após ${maxRetries} tentativas!`)
            console.error(`❌❌❌ [handleFunctionCall] instanceId usado: ${instanceId}`)
            console.error(`❌❌❌ [handleFunctionCall] contactNumber usado: ${normalizedContactNumber}`)
            console.error(`❌❌❌ [handleFunctionCall] Isso pode causar problemas na confirmação!`)
            
            // Tenta buscar diretamente no banco para debug
            try {
              const directCheck = await (prisma as any).pendingAppointment.findMany({
                where: {
                  instanceId,
                },
              })
              console.error(`❌❌❌ [handleFunctionCall] Agendamentos pendentes para esta instância: ${directCheck.length}`)
              directCheck.forEach((p: any, i: number) => {
                const pNormalized = p.contactNumber.replace(/\D/g, '')
                const matches = pNormalized === normalizedContactNumber || p.contactNumber === normalizedContactNumber
                console.error(`   [${i + 1}] contactNumber: "${p.contactNumber}" (normalizado: "${pNormalized}") ${matches ? '✅ CORRESPONDE!' : '❌'} | Esperado: "${normalizedContactNumber}" | date: ${p.date}, time: ${p.time}`)
              })
            } catch (dbError) {
              console.error(`❌❌❌ [handleFunctionCall] Erro ao buscar diretamente no banco:`, dbError)
            }
            
            // Mesmo assim continua - o agendamento pode ter sido salvo mas não está sincronizado ainda
            // A verificação na confirmação vai tentar novamente
          }

          // Prepara mídia (imagem do serviço) se disponível
          const mediaAttachment = serviceImageUrl
            ? {
                type: 'image' as const,
                url: serviceImageUrl,
                caption: `${args.description || 'Serviço'} - confirme o agendamento`,
              }
            : undefined

          // Retorna mensagem de confirmação para o usuário
          // IMPORTANTE: Retorna success: false para que a IA não confirme automaticamente
          // A mensagem será exibida diretamente ao usuário
          let confirmationMessage = `Por favor, confirme os dados do agendamento:\n\n`
          confirmationMessage += `📅 Data: ${formattedDate}\n`
          confirmationMessage += `🕐 Hora: ${formattedTime}\n`
          if (serviceDuration) {
            confirmationMessage += `⏱️ Duração: ${serviceDuration} minutos\n`
          }
          confirmationMessage += `🛠️ Serviço: ${args.description || 'Serviço não especificado'}\n\n`
          confirmationMessage += `Digite "confirmar" para confirmar o agendamento ou "cancelar" para cancelar.`

          // Retorna como erro (success: false) para que a IA não confirme automaticamente
          // Mas com uma mensagem amigável que será exibida ao usuário
          // A mensagem inclui instruções claras para a IA repassar sem modificar
            return {
              success: false,
            pending: true,
            error: `CONFIRMAÇÃO_PENDENTE: ${confirmationMessage}`,
            message: confirmationMessage,
            instruction: 'Repasse esta mensagem EXATAMENTE ao cliente. NÃO confirme o agendamento. Apenas mostre os dados e aguarde confirmação.',
            appointmentData: {
              date: formattedDate,
              time: formattedTime,
              duration: serviceDuration,
              service: args.description || 'Serviço não especificado',
            },
            mediaAttachment,
          }
        } catch (error) {
          console.error('❌ Erro ao criar agendamento (catch):', error)
          console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A')
          return {
            success: false,
            error: 'Ocorreu um erro ao criar o agendamento. Por favor, tente novamente.',
          }
        }
      }
      
      // Função para verificar disponibilidade em uma data
      if (functionName === 'check_availability' && userId) {
        try {
          console.log(`🔍 [check_availability] Chamada com args:`, args)
          
          if (!args.date) {
            return {
              success: false,
              error: 'Data é obrigatória para verificar disponibilidade.',
            }
          }
          
          // Parse da data
          const dateStr = args.date
          console.log(`🔍 [check_availability] Parseando data: "${dateStr}"`)
          const parsedDate = parsePortugueseDate(dateStr)
          
          if (!parsedDate) {
            console.error(`❌ [check_availability] Falha ao parsear data: "${dateStr}"`)
            return {
              success: false,
              error: `Data inválida: "${dateStr}". Use formato DD/MM/YYYY ou linguagem natural (ex: "amanhã", "terça-feira").`,
            }
          }
          
          console.log(`✅ [check_availability] Data parseada: ${parsedDate.toISOString()}`)
          console.log(`🔍 [check_availability] Chamando checkAvailability com userId=${userId}, instanceId=${instanceId}`)
          
          // CRÍTICO: Passa instanceId para considerar agendamentos pendentes também
          const result = await checkAvailability(userId, parsedDate, instanceId)
          
          console.log(`📊 [check_availability] Resultado:`, result)
          
          if (result.success) {
            const formattedDate = parsedDate.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
            
            // CRÍTICO: Também verifica agendamentos pendentes para dar informação completa
            let pendingInfo = ''
            try {
              const formattedDateStr = formattedDate
              const pendingAppointments = await prisma.pendingAppointment.findMany({
                where: {
                  userId,
                  instanceId,
                  date: formattedDateStr,
                  expiresAt: {
                    gt: new Date(),
                  },
                },
              })
              
              if (pendingAppointments.length > 0) {
                const pendingList = pendingAppointments.map((p) => {
                  return `- ${p.time} - ${p.service} (pendente de confirmação)`
                }).join('\n')
                pendingInfo = `\n\n⚠️ Agendamentos pendentes de confirmação:\n${pendingList}`
              }
            } catch (error) {
              console.error('Erro ao buscar agendamentos pendentes:', error)
              // Continua mesmo se houver erro
            }
            
            if (result.appointments && result.appointments.length > 0) {
              const appointmentsList = result.appointments.map((apt: any) => {
                const aptDate = new Date(apt.date)
                return `- ${aptDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${apt.description || 'Agendamento'}`
              }).join('\n')
              
              return {
                success: true,
                message: `📅 Horários ocupados em ${formattedDate}:\n\n${appointmentsList}${pendingInfo}\n\nEstes horários já estão reservados. Escolha outro horário ou pergunte quais horários estão disponíveis.`,
              }
            } else {
              return {
                success: true,
                message: `✅ A data ${formattedDate} está completamente disponível!${pendingInfo}\n\nVocê pode escolher qualquer horário.`,
              }
            }
          } else {
            return {
              success: false,
              error: result.error || 'Erro ao verificar disponibilidade.',
            }
          }
        } catch (error) {
          console.error('❌ Erro ao verificar disponibilidade:', error)
          return {
            success: false,
            error: 'Erro ao verificar disponibilidade.',
          }
        }
      }
      
      // Função para listar horários disponíveis em uma data
      if (functionName === 'get_available_times' && userId) {
        try {
          if (!args.date) {
            return {
              success: false,
              error: 'Data é obrigatória para listar horários disponíveis.',
            }
          }
          
          const dateStr = args.date
          const parsedDate = parsePortugueseDate(dateStr)
          if (!parsedDate) {
            return {
              success: false,
              error: `Data inválida: "${dateStr}". Use formato DD/MM/YYYY ou linguagem natural.`,
            }
          }
          
          // CRÍTICO: Tenta obter a duração do serviço mencionado pelo cliente
          // Se não especificada, usa a duração mínima dos serviços ou 60min como padrão
          let duration = args.duration
          
          if (!duration || duration <= 0) {
            // Busca duração mínima dos serviços disponíveis
            const servicesWithAppointment = businessDetails.servicesWithAppointment || []
            if (servicesWithAppointment.length > 0) {
              const durations = servicesWithAppointment
                .map((s: any) => s.duration)
                .filter((d: number) => d && d > 0)
              
              if (durations.length > 0) {
                duration = Math.min(...durations)
                console.log(`📅 [get_available_times] Usando duração mínima dos serviços: ${duration} minutos`)
              } else {
                duration = 60 // Fallback padrão
              }
            } else {
              duration = 60 // Fallback padrão
            }
          }
          
          console.log(`📅 [get_available_times] Verificando disponibilidade com duração: ${duration} minutos`)
          
          // Horários agora são globais do usuário, não precisam ser passados
          // A função getAvailableTimes busca automaticamente do usuário
          // CRÍTICO: Passa instanceId para considerar agendamentos pendentes também
          const result = await getAvailableTimes(userId, parsedDate, duration, 8, 18, instanceId)
          
          if (result.success) {
            if (result.availableTimes && result.availableTimes.length > 0) {
              // Importa função de agrupamento
              const { groupConsecutiveTimes } = await import('./appointments')
              
              // Agrupa horários consecutivos em intervalos quando há muitos horários
              const groupedTimes = groupConsecutiveTimes(result.availableTimes, duration)
              
              // Formata a lista de horários
              let timesList: string
              if (groupedTimes.length <= 5) {
                // Poucos horários: lista individualmente
                timesList = groupedTimes.join(', ')
              } else {
                // Muitos horários: mostra em intervalos
                timesList = groupedTimes.join('\n')
              }
              
              return {
                success: true,
                message: `📅 Horários disponíveis em ${result.date}:\n\n${timesList}\n\nQual horário você prefere?`,
              }
            } else {
              return {
                success: true,
                message: `❌ Não há horários disponíveis em ${result.date}. Por favor, escolha outra data.`,
              }
            }
          } else {
            return {
              success: false,
              error: result.error || 'Erro ao buscar horários disponíveis.',
            }
          }
        } catch (error) {
          console.error('❌ Erro ao buscar horários disponíveis:', error)
          return {
            success: false,
            error: 'Erro ao buscar horários disponíveis.',
          }
        }
      }
      
      // Função para listar agendamentos do usuário
      if (functionName === 'get_user_appointments' && userId) {
        try {
          const result = await getUserAppointments(userId, instanceId, normalizedContactNumber, args.include_past || false)
          
          if (result.success) {
            if (result.appointments && result.appointments.length > 0) {
              const appointmentsList = result.appointments.map((apt: any) => {
                return `📅 ${apt.formattedDate} às ${apt.formattedTime} - ${apt.description || 'Agendamento'} (${apt.status === 'confirmed' ? 'Confirmado' : apt.status === 'pending' ? 'Pendente' : 'Cancelado'})`
              }).join('\n')
              
              return {
                success: true,
                message: `📅 Seus agendamentos:\n\n${appointmentsList}\n\nVocê pode alterar ou cancelar qualquer um deles.`,
              }
            } else {
              return {
                success: true,
                message: `Você não tem agendamentos no momento. Gostaria de agendar um horário?`,
              }
            }
          } else {
            return {
              success: false,
              error: result.error || 'Erro ao buscar agendamentos.',
            }
          }
        } catch (error) {
          console.error('❌ Erro ao buscar agendamentos:', error)
          return {
            success: false,
            error: 'Erro ao buscar agendamentos.',
          }
        }
      }
      
      // Função para alterar horário de um agendamento
      if (functionName === 'update_appointment' && userId) {
        try {
          if (!args.new_date || !args.new_time) {
            return {
              success: false,
              error: 'Nova data e hora são obrigatórias.',
            }
          }
          
          // Busca o agendamento primeiro para verificar se existe e pertence ao usuário
          const userAppointments = await getUserAppointments(userId, instanceId, normalizedContactNumber, true)
          
          if (!userAppointments.success || !userAppointments.appointments) {
            return {
              success: false,
              error: 'Erro ao buscar agendamentos.',
            }
          }
          
          // Tenta encontrar o agendamento pelo ID ou pela descrição/data
          let appointmentToUpdate = userAppointments.appointments.find((apt: any) => apt.id === args.appointment_id)
          
          // Se não encontrou pelo ID, tenta encontrar pelo mais recente ou próximo
          if (!appointmentToUpdate && userAppointments.appointments.length > 0) {
            // Pega o agendamento mais próximo no futuro
            const futureAppointments = userAppointments.appointments.filter((apt: any) => {
              const aptDate = new Date(apt.date)
              return aptDate >= new Date() && (apt.status === 'pending' || apt.status === 'confirmed')
            })
            
            if (futureAppointments.length > 0) {
              appointmentToUpdate = futureAppointments[0]
            }
          }
          
          if (!appointmentToUpdate) {
            return {
              success: false,
              error: 'Agendamento não encontrado. Use get_user_appointments para ver seus agendamentos.',
            }
          }
          
          // Parse da nova data e hora
          const dateTimeStr = `${args.new_date} ${args.new_time}`
          const parsedNewDate = parsePortugueseDate(dateTimeStr)
          
          if (!parsedNewDate) {
            return {
              success: false,
              error: `Data/hora inválida: "${args.new_date} ${args.new_time}". Use formato DD/MM/YYYY HH:MM ou linguagem natural.`,
            }
          }
          
          // Verifica disponibilidade do novo horário
          const availabilityCheck = await checkAvailability(userId, parsedNewDate)
          if (availabilityCheck.success && availabilityCheck.appointments) {
            for (const existingApt of availabilityCheck.appointments) {
              const existingStart = new Date(existingApt.date)
              const existingEnd = new Date(existingStart.getTime() + 60 * 60000)
              
              if (parsedNewDate < existingEnd && new Date(parsedNewDate.getTime() + 60 * 60000) > existingStart) {
                // Ignora o próprio agendamento que está sendo alterado
                const existingAptDate = new Date(existingApt.date)
                if (Math.abs(existingAptDate.getTime() - new Date(appointmentToUpdate.date).getTime()) > 60000) {
                  return {
                    success: false,
                    error: 'Este horário já está ocupado. Escolha outro horário.',
                  }
                }
              }
            }
          }
          
          const result = await updateAppointment(appointmentToUpdate.id, userId, parsedNewDate)
          
          if (result.success) {
            const formattedDate = parsedNewDate.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
            const formattedTime = parsedNewDate.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })
            
            return {
              success: true,
              message: `✅ Agendamento alterado com sucesso!\n\nNovo horário:\n📅 Data: ${formattedDate}\n🕐 Hora: ${formattedTime}`,
            }
          } else {
            return {
              success: false,
              error: result.error || 'Erro ao alterar agendamento.',
            }
          }
        } catch (error) {
          console.error('❌ Erro ao alterar agendamento:', error)
          return {
            success: false,
            error: 'Erro ao alterar agendamento.',
          }
        }
      }
      
       // Função para encerrar o chat
       if (functionName === 'close_chat' && userId) {
         try {
           console.log(`🚪 [handleFunctionCall] Encerrando chat para ${instanceId}-${contactNumber}`)
           
           // Atualiza o status da conversa para 'closed'
           const { updateConversationStatus } = await import('./conversation-status')
           await updateConversationStatus(instanceId, contactNumber, 'closed')
           
           // Mensagem de encerramento padrão ou customizada
           const closeMessage = args.message || 'Obrigado pelo contato! Esta conversa foi encerrada. Se precisar de mais alguma coisa, é só nos chamar novamente.'
           
           // Envia mensagem de encerramento
           const contactKey = `${instanceId}-${contactNumber}`
           await queueMessage(contactKey, async () => {
             await sendWhatsAppMessage(instanceId, contactNumber, closeMessage, 'service')
           })
           
           // CRÍTICO: Limpa a execução do workflow após encerrar o chat
           const executionKeyClose = `${instanceId}-${contactNumber}`
           if (workflowExecutions.has(executionKeyClose)) {
             console.log(`🧹 [handleFunctionCall] Limpando execução do workflow após encerrar chat`)
             workflowExecutions.delete(executionKeyClose)
           }
           
           console.log(`✅ [handleFunctionCall] Chat encerrado com sucesso`)
           
           return {
             success: true,
             message: closeMessage,
           }
         } catch (error) {
           console.error('❌ Erro ao encerrar chat:', error)
           return {
             success: false,
             error: 'Erro ao encerrar o chat. Por favor, tente novamente.',
           }
         }
       }
       
       // Função para cancelar um agendamento específico
       if (functionName === 'cancel_appointment' && userId) {
        try {
          // Busca agendamentos do usuário
          const userAppointments = await getUserAppointments(userId, instanceId, normalizedContactNumber, false)
          
          if (!userAppointments.success || !userAppointments.appointments || userAppointments.appointments.length === 0) {
            return {
              success: false,
              error: 'Você não tem agendamentos para cancelar.',
            }
          }
          
          // Se não especificou ID, cancela o mais próximo
          let appointmentToCancel = userAppointments.appointments.find((apt: any) => apt.id === args.appointment_id)
          
          if (!appointmentToCancel && userAppointments.appointments.length > 0) {
            appointmentToCancel = userAppointments.appointments[0] // Cancela o mais próximo
          }
          
          if (!appointmentToCancel) {
            return {
              success: false,
              error: 'Agendamento não encontrado.',
            }
          }
          
          const result = await cancelAppointment(appointmentToCancel.id, userId)
          
          if (result.success) {
            const formattedDate = new Date(appointmentToCancel.date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
            const formattedTime = new Date(appointmentToCancel.date).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })
            
            return {
              success: true,
              message: `✅ Agendamento cancelado com sucesso!\n\nAgendamento cancelado:\n📅 Data: ${formattedDate}\n🕐 Hora: ${formattedTime}`,
            }
          } else {
            return {
              success: false,
              error: result.error || 'Erro ao cancelar agendamento.',
            }
          }
        } catch (error) {
          console.error('❌ Erro ao cancelar agendamento:', error)
          return {
            success: false,
            error: 'Erro ao cancelar agendamento.',
          }
        }
      }

      // Função para oferecer promoção
      if (functionName === 'offer_promotion' && userId) {
        try {
          const { offerPromotionToAI } = await import('./ai-promotions')
          
          if (!args.product_id) {
            return {
              success: false,
              error: 'ID do produto é obrigatório.',
            }
          }

          const attempt = args.attempt || 1
          if (attempt < 1) {
            return {
              success: false,
              error: 'Tentativa deve ser maior que 0.',
            }
          }

          // Tenta buscar como Service primeiro
          let service: any = await prisma.service.findFirst({
            where: {
              id: args.product_id,
              userId,
            },
            include: {
              pixKey: {
                select: {
                  pixKey: true,
                },
              },
            },
          })

          let productName = ''
          let basePrice = 0
          let hasPromotions = false
          let promotionData: any = null
          let pixKeyId: string | undefined = undefined
          let pixKeyValue: string | undefined = undefined

          if (service) {
            // É um Service do modelo separado
            productName = service.name
            basePrice = service.price || 0
            hasPromotions = service.hasPromotions || false
            pixKeyId = service.pixKeyId || undefined
            pixKeyValue = service.pixKey?.pixKey
            
            // Parse do array dinâmico de promoções
            const levels: any = {}
            if (service.promotions) {
              try {
                const promotionsArray = JSON.parse(service.promotions)
                if (Array.isArray(promotionsArray)) {
                  promotionsArray.forEach((promo: any, index: number) => {
                    const levelNumber = index + 1
                    if (levelNumber <= 3) {
                      levels[`level${levelNumber}`] = {
                        value: promo.value,
                        type: promo.type || 'percent',
                        gatewayLink: promo.gatewayLink,
                      }
                    }
                  })
                }
              } catch (error) {
                console.error('Erro ao parsear promoções:', error)
              }
            }
            
            promotionData = {
              hasPromotions,
              levels,
              pixKeyId,
            }
          } else {
            // Tenta buscar como CatalogNode
            const catalogNode = await prisma.catalogNode.findFirst({
              where: {
                id: args.product_id,
                catalog: {
                  userId,
                },
              },
            })

            if (catalogNode) {
              const nodeData = JSON.parse(catalogNode.data)
              productName = nodeData.name || 'Produto'
              basePrice = nodeData.price || 0
              hasPromotions = nodeData.hasPromotions || false
              pixKeyId = nodeData.pixKeyId || undefined
              
              if (pixKeyId) {
                try {
                  const pixKeyData = await prisma.businessPixKey.findUnique({
                    where: { id: pixKeyId },
                    select: { pixKey: true },
                  })
                  pixKeyValue = pixKeyData?.pixKey
                } catch (error) {
                  // Ignora erro se Prisma Client não foi regenerado ainda
                  console.error('Erro ao buscar chave Pix:', error)
                }
              }

              // Parse do array dinâmico de promoções do CatalogNode
              const levels: any = {}
              if (nodeData.promotions && Array.isArray(nodeData.promotions)) {
                nodeData.promotions.forEach((promo: any, index: number) => {
                  const levelNumber = index + 1
                  if (levelNumber <= 3) {
                    levels[`level${levelNumber}`] = {
                      value: promo.value,
                      type: promo.type || 'percent',
                      gatewayLink: promo.gatewayLink,
                    }
                  }
                })
              }
              
              promotionData = {
                hasPromotions,
                levels,
                pixKeyId,
              }
            }
          }

          if (!productName || basePrice === 0) {
            return {
              success: false,
              error: 'Produto/serviço não encontrado.',
            }
          }

          if (!hasPromotions || !promotionData) {
            return {
              success: false,
              error: 'Este produto/serviço não possui promoções configuradas.',
            }
          }

          // Determina qual promoção oferecer baseado na tentativa (usa índice do array)
          const levelKey = `level${attempt}` as 'level1' | 'level2' | 'level3'
          const selectedPromo = promotionData.levels[levelKey]
          
          if (!selectedPromo) {
            return {
              success: false,
              error: `Não há promoção disponível para a tentativa ${attempt}.`,
            }
          }

          const promoLevel = attempt as 1 | 2 | 3
          const promotionValue = selectedPromo.value
          const promotionType = selectedPromo.type
          const gatewayLink = selectedPromo.gatewayLink

          if (!promotionValue) {
            return {
              success: false,
              error: 'Não foi possível gerar promoção para este produto.',
            }
          }

          // Importa funções necessárias
          const { formatPromotionMessage, calculatePromotionPrice } = await import('./promotions')
          const { registerProductInterest } = await import('./promotions')

          // Registra interesse
          await registerProductInterest({
            userId,
            instanceId,
            contactNumber,
            productId: args.product_id,
            productType: service ? 'service' : 'catalog',
            productName,
            interestType: 'requested_discount',
          })

          // Calcula preço final
          const finalPrice = calculatePromotionPrice(basePrice, promotionValue, promotionType)

          // Formata mensagem
          const message = formatPromotionMessage(
            productName,
            basePrice,
            promoLevel,
            promotionValue,
            promotionType,
            pixKeyValue,
            gatewayLink
          )

          log.event('promotion_offered', {
            userId,
            instanceId,
            contactNumber,
            productId: args.product_id,
            promoLevel,
            finalPrice,
          })

          // Envia mensagem com promoção
          const contactKey = `${instanceId}-${contactNumber}`
          await queueMessage(contactKey, async () => {
            await sendWhatsAppMessage(instanceId, contactNumber, message, 'service')
          })

          const promotion = {
            message,
            finalPrice,
            pixKey: pixKeyValue,
            gatewayLink,
          }

          return {
            success: true,
            message: promotion.message,
            finalPrice: promotion.finalPrice,
            pixKey: promotion.pixKey,
            gatewayLink: promotion.gatewayLink,
          }
        } catch (error) {
          log.error('Erro ao oferecer promoção', error)
          return {
            success: false,
            error: 'Erro ao processar promoção.',
          }
        }
      }

      // Função para adicionar ao carrinho
      if (functionName === 'add_to_cart' && userId) {
        try {
          const { addToCart, getCart } = await import('./cart')
          
          if (!args.product_id || !args.product_type || !args.product_name) {
            return {
              success: false,
              error: 'ID, tipo e nome do produto são obrigatórios.',
            }
          }

          // Busca preço do produto
          let unitPrice = 0
          if (args.product_type === 'service') {
            const service = await prisma.service.findFirst({
              where: {
                id: args.product_id,
                userId,
              },
              select: {
                price: true,
              },
            })
            unitPrice = service?.price || 0
          } else {
            // Para produtos do catálogo, precisa buscar do CatalogNode
            const catalogNode = await prisma.catalogNode.findFirst({
              where: {
                id: args.product_id,
                catalog: {
                  userId,
                },
              },
            })
            if (catalogNode) {
              try {
                const nodeData = JSON.parse(catalogNode.data)
                unitPrice = nodeData.price || 0
              } catch {
                unitPrice = 0
              }
            }
          }

          const quantity = args.quantity || 1
          const totalPrice = unitPrice * quantity

          const cart = addToCart(instanceId, contactNumber, {
            productId: args.product_id,
            productType: args.product_type as 'service' | 'catalog',
            productName: args.product_name,
            quantity,
            unitPrice,
            totalPrice,
            notes: args.notes,
          })

          const itemCount = cart.items.length
          const cartTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0)

          return {
            success: true,
            message: `✅ ${args.product_name} adicionado ao carrinho!\n\n🛒 Carrinho: ${itemCount} item${itemCount !== 1 ? 's' : ''}\n💰 Total: R$ ${cartTotal.toFixed(2).replace('.', ',')}\n\nDeseja adicionar mais algo ou finalizar o pedido?`,
            cartItems: itemCount,
            cartTotal,
          }
        } catch (error) {
          log.error('Erro ao adicionar ao carrinho', error)
          return {
            success: false,
            error: 'Erro ao adicionar produto ao carrinho.',
          }
        }
      }

      // Função para visualizar carrinho
      if (functionName === 'view_cart' && userId) {
        try {
          const { getCart, getCartTotal } = await import('./cart')
          
          const cart = getCart(instanceId, contactNumber)
          
          if (cart.items.length === 0) {
            return {
              success: true,
              message: '🛒 Seu carrinho está vazio.\n\nAdicione produtos ou serviços para começar seu pedido!',
              cartItems: 0,
              cartTotal: 0,
            }
          }

          const total = getCartTotal(cart)
          let message = '🛒 **Seu Carrinho:**\n\n'
          
          cart.items.forEach((item, index) => {
            message += `${index + 1}. ${item.productName}`
            if (item.quantity > 1) {
              message += ` (${item.quantity}x)`
            }
            message += ` - R$ ${item.totalPrice.toFixed(2).replace('.', ',')}\n`
            if (item.notes) {
              message += `   📝 ${item.notes}\n`
            }
          })
          
          message += `\n💰 **Total: R$ ${total.toFixed(2).replace('.', ',')}**\n\n`
          message += 'Deseja adicionar mais algo ou finalizar o pedido?'

          return {
            success: true,
            message,
            cartItems: cart.items.length,
            cartTotal: total,
          }
        } catch (error) {
          log.error('Erro ao visualizar carrinho', error)
          return {
            success: false,
            error: 'Erro ao visualizar carrinho.',
          }
        }
      }

      // Função para finalizar pedido (checkout)
      if (functionName === 'checkout' && userId) {
        try {
          const { getCart, createOrderFromCart } = await import('./cart')
          
          const cart = getCart(instanceId, contactNumber)
          
          if (cart.items.length === 0) {
            return {
              success: false,
              error: 'Seu carrinho está vazio. Adicione produtos antes de finalizar o pedido.',
            }
          }

          // Valida tipo de entrega
          if (args.delivery_type === 'delivery' && !args.delivery_address) {
            return {
              success: false,
              error: 'Por favor, informe o endereço de entrega.',
            }
          }

          // Verifica se os produtos permitem o tipo de entrega escolhido
          for (const item of cart.items) {
            if (item.productType === 'service') {
              const service = await prisma.service.findFirst({
                where: {
                  id: item.productId,
                  userId,
                },
                select: {
                  deliveryAvailable: true,
                  pickupAvailable: true,
                },
              })

              if (args.delivery_type === 'delivery' && !service?.deliveryAvailable) {
                return {
                  success: false,
                  error: `O produto "${item.productName}" não permite entrega. Por favor, escolha retirada no estabelecimento ou remova este item do carrinho.`,
                }
              }

              if (args.delivery_type === 'pickup' && !service?.pickupAvailable) {
                return {
                  success: false,
                  error: `O produto "${item.productName}" não permite retirada. Por favor, escolha entrega ou remova este item do carrinho.`,
                }
              }
            }
          }

          // Cria o pedido
          const result = await createOrderFromCart(
            userId,
            instanceId,
            contactNumber,
            contactNameFinal,
            args.delivery_type as 'pickup' | 'delivery',
            args.delivery_address,
            args.notes
          )

          let message = `✅ **Pedido confirmado!**\n\n`
          message += `📦 Tipo: ${args.delivery_type === 'delivery' ? 'Entrega' : 'Retirada no estabelecimento'}\n`
          if (args.delivery_type === 'delivery' && args.delivery_address) {
            message += `📍 Endereço: ${args.delivery_address}\n`
          }
          message += `💰 Total: R$ ${cart.items.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2).replace('.', ',')}\n\n`

          // Adiciona informações de pagamento se houver
          if (result.paymentLink) {
            message += `💳 **Pagamento:**\n`
            message += `Clique no link para pagar: ${result.paymentLink}\n\n`
          } else if (result.paymentPixKey) {
            message += `💳 **Pagamento via Pix:**\n`
            message += `Chave Pix: ${result.paymentPixKey}\n`
            message += `Valor: R$ ${cart.items.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2).replace('.', ',')}\n\n`
          } else {
            message += `💳 **Pagamento:**\n`
            message += `Você pode pagar na retirada ou no momento da entrega.\n\n`
          }

          message += `Obrigado pela preferência! 🎉`

          // Envia mensagem de confirmação
          const contactKey = `${instanceId}-${contactNumber}`
          await queueMessage(contactKey, async () => {
            await sendWhatsAppMessage(instanceId, contactNumber, message, 'service')
          })

          return {
            success: true,
            message,
            orderId: result.orderId,
            paymentLink: result.paymentLink,
            paymentPixKey: result.paymentPixKey,
          }
        } catch (error) {
          log.error('Erro ao finalizar pedido', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao finalizar pedido.',
          }
        }
      }

      return {
        success: false,
        error: 'Função não reconhecida.',
      }
    }
    
    // Intercepta chamadas de função para verificar se há agendamento pendente
    let pendingAppointmentResponse: string | null = null
    let pendingAppointmentMedia: MediaAttachment | null = null
    
    const interceptedFunctionCall = async (functionName: string, args: any) => {
      console.log(`🔧 [interceptedFunctionCall] Interceptando chamada de função: ${functionName}`)
      console.log(`🔧 [interceptedFunctionCall] Argumentos:`, JSON.stringify(args, null, 2))
      
      try {
      const result = await handleFunctionCall(functionName, args)
        
        console.log(`✅ [interceptedFunctionCall] Função ${functionName} executada`)
        console.log(`📊 [interceptedFunctionCall] Resultado:`, JSON.stringify(result, null, 2))
      
      // Se retornou um agendamento pendente, intercepta a resposta
      if (result && typeof result === 'object' && 'pending' in result && result.pending === true) {
        pendingAppointmentResponse = result.message || result.error || 'Por favor, confirme os dados do agendamento.'
          console.log(`📅 [interceptedFunctionCall] Agendamento pendente interceptado:`, pendingAppointmentResponse)
        if ('mediaAttachment' in result && result.mediaAttachment) {
          pendingAppointmentMedia = result.mediaAttachment as MediaAttachment
        }
        // Retorna erro para que a IA não confirme automaticamente
        return {
          success: false,
          error: pendingAppointmentResponse,
        }
      }
      
      return result
      } catch (error) {
        console.error(`❌ [interceptedFunctionCall] Erro ao executar função ${functionName}:`, error)
        console.error(`❌ [interceptedFunctionCall] Stack trace:`, error instanceof Error ? error.stack : 'N/A')
        
        // Retorna erro detalhado para a IA
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
          success: false,
          error: `Erro ao executar ${functionName}: ${errorMessage}`,
        }
      }
    }
    
    const aiResponse = await generateAIResponse(userMessageWithContext, {
      systemPrompt,
      conversationHistory: finalConversationHistory,
      variables: {
        nome: contactNameFinal || formattedPhoneFormatted || 'Usuário',
        telefone: formattedPhoneFormatted || contactNumber,
        telefoneNumero: formattedPhone || contactNumber,
      },
      temperature,
      maxTokens: 600,
      functions: [
        appointmentFunction,
        {
          name: 'check_availability',
          description: 'Verifica se uma data específica tem horários disponíveis. Use quando o cliente perguntar sobre disponibilidade ou quando quiser verificar antes de criar um agendamento.',
          parameters: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description: 'Data para verificar disponibilidade. Pode ser formato DD/MM/YYYY ou linguagem natural (ex: "amanhã", "terça-feira", "25/11/2025").',
              },
            },
            required: ['date'],
          },
        },
        {
          name: 'get_available_times',
          description: 'Lista todos os horários disponíveis em uma data específica. Use quando o cliente perguntar "quais horários estão disponíveis" ou "que horários tem".',
          parameters: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description: 'Data para listar horários disponíveis. Pode ser formato DD/MM/YYYY ou linguagem natural (ex: "amanhã", "terça-feira", "25/11/2025").',
              },
              duration: {
                type: 'number',
                description: 'Duração do agendamento em minutos (padrão: 60).',
              },
            },
            required: ['date'],
          },
        },
        {
          name: 'get_user_appointments',
          description: 'Lista todos os agendamentos do cliente. Use quando o cliente perguntar "quais são meus agendamentos", "meus horários", "quando tenho agendado" ou quando quiser ver os agendamentos antes de alterar/cancelar.',
          parameters: {
            type: 'object',
            properties: {
              include_past: {
                type: 'boolean',
                description: 'Se deve incluir agendamentos passados (padrão: false).',
              },
            },
            required: [],
          },
        },
        {
          name: 'update_appointment',
          description: 'Altera o horário de um agendamento existente. Use quando o cliente quiser mudar o horário de um agendamento (ex: "quero mudar para outro horário", "pode alterar para amanhã às 3h").',
          parameters: {
            type: 'object',
            properties: {
              appointment_id: {
                type: 'string',
                description: 'ID do agendamento a ser alterado (opcional - se não informado, altera o mais próximo).',
              },
              new_date: {
                type: 'string',
                description: 'Nova data do agendamento. Pode ser formato DD/MM/YYYY ou linguagem natural (ex: "amanhã", "terça-feira", "25/11/2025").',
              },
              new_time: {
                type: 'string',
                description: 'Nova hora do agendamento no formato HH:MM (ex: "14:00", "16:00") ou linguagem natural (ex: "3 da tarde", "7 da manhã").',
              },
            },
            required: ['new_date', 'new_time'],
          },
        },
         {
           name: 'cancel_appointment',
           description: 'Cancela um agendamento existente. Use quando o cliente quiser desmarcar ou cancelar um agendamento (ex: "quero cancelar", "desmarcar", "não vou mais").',
           parameters: {
             type: 'object',
             properties: {
               appointment_id: {
                 type: 'string',
                 description: 'ID do agendamento a ser cancelado (opcional - se não informado, cancela o mais próximo).',
               },
             },
             required: [],
           },
         },
         {
           name: 'close_chat',
           description: 'Encerra a conversa com o cliente. Use quando o cliente pedir para encerrar o chat, finalizar a conversa, ou quando a conversa naturalmente chegou ao fim e o cliente não precisa de mais nada. Você também pode perguntar ao cliente se ele quer encerrar o chat quando apropriado.',
           parameters: {
             type: 'object',
             properties: {
               message: {
                 type: 'string',
                 description: 'Mensagem personalizada de encerramento (opcional). Se não informado, usa mensagem padrão.',
               },
             },
             required: [],
           },
         },
         {
           name: 'offer_promotion',
           description: 'Oferece uma promoção/desconto para um produto ou serviço quando o cliente pedir desconto, achar caro, ou demonstrar interesse mas não comprar. Use quando o cliente pedir desconto, disser que está caro, ou quando quiser oferecer uma oportunidade especial.',
           parameters: {
             type: 'object',
             properties: {
               product_id: {
                 type: 'string',
                 description: 'ID do produto/serviço para oferecer promoção. Use o ID do serviço que o cliente está interessado.',
               },
               attempt: {
                 type: 'number',
                 description: 'Nível de tentativa de desconto (1, 2 ou 3). Use 1 na primeira vez que o cliente pedir desconto, 2 se ele recusar o nível 1, e 3 se ele recusar o nível 2. Isso determina qual nível de promoção oferecer.',
               },
             },
             required: ['product_id', 'attempt'],
           },
         },
         {
           name: 'add_to_cart',
           description: 'Adiciona um produto ou serviço ao carrinho de compras. Use quando o cliente quiser adicionar algo ao carrinho antes de finalizar o pedido. Permite que o cliente adicione múltiplos itens antes de fazer o checkout.',
           parameters: {
             type: 'object',
             properties: {
               product_id: {
                 type: 'string',
                 description: 'ID do produto/serviço a ser adicionado ao carrinho.',
               },
               product_type: {
                 type: 'string',
                 enum: ['service', 'catalog'],
                 description: 'Tipo do produto: "service" para serviços ou "catalog" para produtos do catálogo.',
               },
               product_name: {
                 type: 'string',
                 description: 'Nome do produto/serviço para exibição.',
               },
               quantity: {
                 type: 'number',
                 description: 'Quantidade do produto (padrão: 1).',
               },
               notes: {
                 type: 'string',
                 description: 'Observações específicas do cliente sobre este item (opcional).',
               },
             },
             required: ['product_id', 'product_type', 'product_name'],
           },
         },
         {
           name: 'view_cart',
           description: 'Visualiza o conteúdo atual do carrinho de compras. Use quando o cliente perguntar "o que tem no carrinho", "meu carrinho", "itens do pedido" ou quando quiser ver o resumo antes de finalizar.',
           parameters: {
             type: 'object',
             properties: {},
             required: [],
           },
         },
         {
           name: 'checkout',
           description: 'Finaliza o pedido e cria a ordem de compra. Use quando o cliente quiser finalizar o pedido, confirmar a compra, ou quando disser "quero fechar o pedido". Coleta informações de entrega/retirada e processa o pagamento.',
           parameters: {
             type: 'object',
             properties: {
               delivery_type: {
                 type: 'string',
                 enum: ['pickup', 'delivery'],
                 description: 'Tipo de entrega: "pickup" para retirada no estabelecimento ou "delivery" para entrega no endereço.',
               },
               delivery_address: {
                 type: 'string',
                 description: 'Endereço completo de entrega (obrigatório se delivery_type for "delivery"). Inclua rua, número, bairro, cidade e CEP se possível.',
               },
               notes: {
                 type: 'string',
                 description: 'Observações gerais do pedido (opcional).',
               },
             },
             required: ['delivery_type'],
           },
         },
       ],
      onFunctionCall: interceptedFunctionCall,
    })
    
    // Se há uma resposta de agendamento pendente, usa ela diretamente em vez da resposta da IA
    if (pendingAppointmentResponse) {
      const contactKey = `${instanceId}-${contactNumber}`
      
      if (isImageAttachment(pendingAppointmentMedia)) {
        const media: MediaAttachment = pendingAppointmentMedia
        await queueMessage(contactKey, async () => {
          try {
            await sendWhatsAppImage(
              instanceId,
              contactNumber,
              media.url,
              media.caption
            )
          } catch (mediaError) {
            console.error('❌ Erro ao enviar imagem de confirmação:', mediaError)
          }
        })
      }
      
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, pendingAppointmentResponse!, 'service')
      })
      console.log(`📅 Mensagem de confirmação de agendamento enviada diretamente`)
      return
    }
    
    // Não força mais mencionar o nome do negócio em todas as mensagens para manter naturalidade

    // Envia a resposta gerada pela IA
    const contactKey = `${instanceId}-${contactNumber}`
    await queueMessage(contactKey, async () => {
      await sendWhatsAppMessage(instanceId, contactNumber, aiResponse, 'service')
    })

    console.log(`🤖 Resposta de IA autônoma gerada para ${contactNumber}`)
  } catch (error) {
    console.error('Erro ao executar workflow IA-only:', error)
    
    // Envia mensagem de erro amigável
    const errorMessage = 'Desculpe, ocorreu um erro ao processar sua mensagem. Nossa equipe foi notificada.'
    const contactKey = `${instanceId}-${contactNumber}`
    await queueMessage(contactKey, async () => {
      await sendWhatsAppMessage(instanceId, contactNumber, errorMessage, 'service')
    })
  }
}

/**
 * @deprecated Use buildSystemPrompt de lib/_prompts/build-system-prompt.ts
 * Mantido apenas para compatibilidade - será removido em versão futura
 */
function buildAISystemPrompt(businessDetails: any, contactName: string): string {
  // Redireciona para a nova função modular
  return buildSystemPrompt(businessDetails, contactName)
  const businessName = businessDetails.businessName || 'este negócio'
  const businessDescription = businessDetails.businessDescription || ''
  const businessType = businessDetails.businessType || 'services'
  const products = businessDetails.products || []
  const services = businessDetails.services || []
  const pricingInfo = businessDetails.pricingInfo || ''
  const howToBuy = businessDetails.howToBuy || ''
  const tone = businessDetails.tone || 'friendly'
  const additionalInfo = businessDetails.additionalInfo || ''
  const aiInstructions = businessDetails.aiInstructions || ''

  const toneDescriptions: Record<string, string> = {
    friendly: 'amigável, descontraído e prestativo',
    professional: 'profissional, educado e eficiente',
    casual: 'casual, descontraído e próximo',
    formal: 'formal, respeitoso e polido',
  }
  
  const toneDescription = toneDescriptions[tone] || 'amigável e prestativo'

  // Obtém a data atual no fuso horário do Brasil
  const now = new Date()
  const brazilianDateParts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).formatToParts(now)
  
  const currentYear = parseInt(brazilianDateParts.find(p => p.type === 'year')!.value)
  const currentMonth = parseInt(brazilianDateParts.find(p => p.type === 'month')!.value)
  const currentDay = parseInt(brazilianDateParts.find(p => p.type === 'day')!.value)
  const currentWeekday = brazilianDateParts.find(p => p.type === 'weekday')!.value
  
  const currentDateFormatted = `${currentDay.toString().padStart(2, '0')}/${currentMonth.toString().padStart(2, '0')}/${currentYear}`

  // Determina o que o negócio oferece
  const sellsProducts = businessType === 'products' || businessType === 'both'
  const sellsServices = businessType === 'services' || businessType === 'both'

  let prompt = `Você é um ASSISTENTE DE VENDAS da ${businessName}. Seu objetivo é APRESENTAR e VENDER os produtos/serviços do negócio de forma natural e persuasiva. Você NÃO é um chatbot genérico - você é um VENDEDOR especializado.\n\n`
  
  // Adiciona informação sobre a data atual
  prompt += `📅 INFORMAÇÃO IMPORTANTE SOBRE A DATA ATUAL:\n`
  prompt += `- Hoje é ${currentWeekday}, dia ${currentDay} de ${getMonthName(currentMonth)} de ${currentYear} (${currentDateFormatted})\n`
  prompt += `- Quando o cliente perguntar "que dia é hoje?", "que dia é amanhã?", "que mês estamos?", etc., use esta informação\n`
  prompt += `- Ao calcular "amanhã", use: ${getTomorrowDate(currentDay, currentMonth, currentYear)}\n`
  prompt += `- Ao calcular "depois de amanhã", use: ${getDayAfterTomorrowDate(currentDay, currentMonth, currentYear)}\n`
  prompt += `- ⚠️ CRÍTICO: SEMPRE use o ano ${currentYear} e o mês ${currentMonth} ao calcular datas relativas\n\n`

  // Descrição detalhada do negócio - CRÍTICO para explicar o negócio
  if (businessDescription) {
    prompt += `\n\nSOBRE O NEGÓCIO (SEMPRE mencione isso nas suas respostas):\n${businessDescription}\n`
  } else {
    prompt += `\n\nIMPORTANTE: Você representa ${businessName}. Sempre mencione o nome do negócio e explique o que faz.\n`
  }

  // Tipo de negócio
  if (sellsProducts && sellsServices) {
    prompt += `\nEste negócio oferece TANTO PRODUTOS QUANTO SERVIÇOS. `
  } else if (sellsProducts) {
    prompt += `\nEste negócio VENDE PRODUTOS. `
  } else {
    prompt += `\nEste negócio OFERECE SERVIÇOS. `
  }

  // Produtos
  if (products.length > 0) {
    prompt += `\n\nPRODUTOS DISPONÍVEIS:\n${products.map((p: string) => `- ${p}`).join('\n')}`
    prompt += `\n\n⚠️ CRÍTICO: Quando perguntarem sobre produtos OU quando você mencionar produtos, SEMPRE use este formato EXATO:\n`
    products.forEach((p: string) => {
      prompt += `- ${p}\n`
    })
    prompt += `\nNUNCA liste produtos separados por vírgula. SEMPRE use o formato acima com marcadores (-) e quebra de linha.`
  }

  // Serviços
  if (services.length > 0) {
    prompt += `\n\nSERVIÇOS DISPONÍVEIS:\n${services.map((s: string) => `- ${s}`).join('\n')}`
    prompt += `\n\n⚠️ CRÍTICO: Quando perguntarem sobre serviços OU quando você mencionar serviços, SEMPRE use este formato EXATO:\n`
    services.forEach((s: string) => {
      prompt += `- ${s}\n`
    })
    prompt += `\nNUNCA liste serviços separados por vírgula. SEMPRE use o formato acima com marcadores (-) e quebra de linha.`
  }

  // Serviços que precisam de agendamento
  const servicesWithAppointment = businessDetails.servicesWithAppointment || []
  if (servicesWithAppointment.length > 0) {
    prompt += `\n\n📅 SERVIÇOS QUE PRECISAM DE AGENDAMENTO:\n`
    servicesWithAppointment.forEach((service: { name: string; duration?: number }) => {
      if (service.duration) {
        prompt += `- ${service.name} (duração: ${service.duration} minutos)\n`
      } else {
        prompt += `- ${service.name} (duração não especificada)\n`
      }
    })
    prompt += `\n⚠️ IMPORTANTE: Quando o cliente mencionar interesse em algum desses serviços, você DEVE oferecer agendamento de forma natural. Informe que o serviço requer agendamento e pergunte quando seria melhor para o cliente.`
  }

  // Informações de preço
  if (pricingInfo) {
    prompt += `\n\nINFORMAÇÕES DE PREÇO:\n${pricingInfo}`
    prompt += `\n\nQuando perguntarem sobre preços, use essas informações.`
  } else {
    prompt += `\n\nIMPORTANTE: Se perguntarem sobre preços e você não tiver informações específicas, seja honesto e diga que pode fornecer mais detalhes sobre valores ao entrar em contato.`
  }

  // Como comprar/contratar
  if (howToBuy) {
    prompt += `\n\nCOMO COMPRAR/CONTRATAR:\n${howToBuy}`
    prompt += `\n\nQuando perguntarem como comprar ou contratar, explique claramente usando essas instruções.`
  }

  // Informações adicionais
  if (additionalInfo) {
    prompt += `\n\nINFORMAÇÕES ADICIONAIS:\n${additionalInfo}`
  }

  // Instruções específicas da IA
  if (aiInstructions) {
    prompt += `\n\nINSTRUÇÕES ESPECÍFICAS DE COMPORTAMENTO:\n${aiInstructions}`
  }

  // Instruções gerais - MUITO IMPORTANTES PARA VENDAS
  prompt += `\n\nREGRAS CRÍTICAS DE VENDAS (SIGA SEMPRE):\n`
  prompt += `- Você é um ASSISTENTE DE VENDAS, não um chatbot genérico\n`
  prompt += `- Seu objetivo é APRESENTAR e VENDER os produtos/serviços da ${businessName}\n`
  prompt += `- Seja ${toneDescription} mas sempre focado em apresentar o negócio\n`
  prompt += `- ⚠️ OBRIGATÓRIO: Na primeira mensagem, SEMPRE se apresente mencionando ${businessName} e o que oferece\n`
  prompt += `- ⚠️ OBRIGATÓRIO: NUNCA responda de forma genérica como "Como posso ajudar?" ou "teste de eco"\n`
  prompt += `- ⚠️ OBRIGATÓRIO: NUNCA ignore que você está vendendo/apresentando produtos ou serviços\n`
  prompt += `- ⚠️ SEMPRE mencione os produtos/serviços disponíveis na primeira interação\n`
  prompt += `- Seja NATURAL e CONVERSACIONAL - fale como uma pessoa real, não como um robô\n`
  prompt += `- Varie suas respostas - não termine sempre com "Como posso te ajudar?" ou frases repetitivas\n`
  prompt += `- Use linguagem natural e direta, como se estivesse conversando com um amigo\n`
  prompt += `- Seja objetivo e direto ao ponto, mas mantenha o tom ${toneDescription}\n`
  prompt += `- Evite ser muito formal ou repetitivo - seja espontâneo e natural\n`
  prompt += `- ⚠️ OBRIGATÓRIO: Quando listar produtos ou serviços, SEMPRE use formato de lista com marcadores (-) e quebra de linha\n`
  prompt += `- ⚠️ PROIBIDO: NUNCA liste produtos/serviços separados por vírgula como "produto1, produto2, produto3"\n`
  prompt += `- ⚠️ OBRIGATÓRIO: SEMPRE use o formato:\n`
  prompt += `  - Item 1\n`
  prompt += `  - Item 2\n`
  prompt += `  - Item 3\n`
  
  // Mensagem de boas-vindas personalizada se configurada
  if (howToBuy && howToBuy.trim().length > 10) {
    prompt += `\n- Na primeira interação, SEMPRE use esta mensagem de boas-vindas EXATA: "${howToBuy}"\n`
    prompt += `- Depois dessa mensagem inicial, continue apresentando os produtos/serviços\n`
  }
  
  if (sellsProducts && products.length > 0) {
    prompt += `- Na primeira mensagem, SEMPRE mencione os produtos em formato de lista com marcadores:\n`
    products.forEach((p: string) => {
      prompt += `  - ${p}\n`
    })
    prompt += `- Quando perguntarem sobre produtos, SEMPRE liste-os em formato de lista com marcadores (-), um por linha\n`
    prompt += `- Seja detalhado e persuasivo ao apresentar produtos\n`
  }
  if (sellsServices && services.length > 0) {
    prompt += `- Na primeira mensagem, SEMPRE mencione os serviços em formato de lista com marcadores:\n`
    services.forEach((s: string) => {
      prompt += `  - ${s}\n`
    })
    prompt += `- Quando perguntarem sobre serviços, SEMPRE liste-os em formato de lista com marcadores (-), um por linha\n`
    prompt += `- Seja detalhado e persuasivo ao apresentar serviços\n`
  }
  
  if (pricingInfo) {
    prompt += `- Quando perguntarem sobre preços OU quando apropriado, mencione: ${pricingInfo}\n`
    prompt += `- Seja proativo em mencionar preços quando apresentar produtos/serviços\n`
  }
  
  if (howToBuy && howToBuy.trim().length > 10) {
    prompt += `- Quando perguntarem como comprar/contratar, explique: ${howToBuy}\n`
  }
  
  if (aiInstructions) {
    prompt += `\n- COMPORTAMENTO ESPECÍFICO SOLICITADO: ${aiInstructions}\n`
  }
  
  prompt += `- Mantenha o foco em VENDER e APRESENTAR ${businessName} de forma positiva\n`
  prompt += `- Você está conversando com ${contactName}\n`
  prompt += `- Lembre-se: você é um VENDEDOR, não um assistente genérico\n`
  prompt += `\n\n📅 FUNCIONALIDADE DE AGENDAMENTO (AUTONOMIA COMPLETA):\n`
  if (servicesWithAppointment.length > 0) {
    prompt += `- Os seguintes serviços REQUEREM agendamento:\n`
    servicesWithAppointment.forEach((service: { name: string; duration?: number }) => {
      if (service.duration) {
        prompt += `  * ${service.name} (duração aproximada: ${service.duration} minutos)\n`
      } else {
        prompt += `  * ${service.name}\n`
      }
    })
    prompt += `- Quando o cliente mencionar interesse em algum desses serviços, você DEVE oferecer agendamento de forma natural e proativa\n`
    prompt += `- Se o cliente perguntar sobre um serviço que requer agendamento, mencione que é necessário agendar e ofereça ajuda para marcar\n`
  }
  prompt += `- ⚠️ CRÍTICO: Você tem AUTONOMIA COMPLETA para gerenciar agendamentos. Use as funções disponíveis de forma inteligente!\n`
  prompt += `- ⚠️ CRÍTICO: NUNCA peça ao cliente para usar formatos técnicos como "DD/MM/YYYY" ou "HH:MM" - você deve entender a linguagem natural dele\n`
  prompt += `- ⚠️ CRÍTICO: NUNCA seja repetitivo ou genérico ao responder sobre agendamento\n`
  prompt += `- ⚠️ CRÍTICO: Se o cliente acabou de confirmar um agendamento (disse "confirmar", "sim", "ok"), NÃO tente criar um novo agendamento. Apenas confirme que recebeu a confirmação e agradeça.\n`
  
  prompt += `\n🎯 FLUXO DE AGENDAMENTO (SIGA EXATAMENTE ESTA SEQUÊNCIA):\n`
  prompt += `1. CLIENTE SOLICITA AGENDAMENTO:\n`
  prompt += `   - Cliente diz algo como "quero agendar X para amanhã às 3h" ou "pode ser às 4?"\n`
  prompt += `   - Você DEVE chamar create_appointment IMEDIATAMENTE com os dados coletados\n`
  prompt += `   - A função create_appointment vai:\n`
  prompt += `     * Verificar se o horário está disponível\n`
  prompt += `     * Criar um agendamento PENDENTE (não confirmado ainda)\n`
  prompt += `     * Retornar uma mensagem pedindo confirmação\n`
  prompt += `   - Você DEVE repassar EXATAMENTE a mensagem retornada pela função\n`
  prompt += `   - NÃO diga que o agendamento foi criado/confirmado - apenas mostre os dados e peça confirmação\n`
  prompt += `\n2. CLIENTE CONFIRMA:\n`
  prompt += `   - Cliente diz "confirmar", "sim", "ok", "tá certo"\n`
  prompt += `   - Você NÃO deve chamar nenhuma função aqui!\n`
  prompt += `   - Apenas agradeça e confirme que recebeu a confirmação\n`
  prompt += `   - O sistema vai processar a confirmação automaticamente\n`
  prompt += `\n3. CLIENTE CANCELA:\n`
  prompt += `   - Cliente diz "cancelar", "não", "desmarcar"\n`
  prompt += `   - Você NÃO deve chamar nenhuma função aqui!\n`
  prompt += `   - Apenas confirme que o agendamento foi cancelado\n`
  prompt += `   - O sistema vai processar o cancelamento automaticamente\n`
  prompt += `\n⚠️ REGRAS CRÍTICAS DE AGENDAMENTO:\n`
  prompt += `- ⚠️ CRÍTICO: Se você acabou de criar um agendamento pendente e o cliente responde qualquer coisa que não seja confirmação/cancelamento, NÃO crie outro agendamento. Aguarde a confirmação do primeiro.\n`
  prompt += `- ⚠️ CRÍTICO: Se o cliente sugerir outro horário DEPOIS de você ter criado um agendamento pendente, você DEVE criar um novo agendamento pendente com o novo horário (o sistema vai substituir automaticamente)\n`
  prompt += `- ⚠️ CRÍTICO: NUNCA crie múltiplos agendamentos pendentes para o mesmo cliente ao mesmo tempo\n`
  
  prompt += `\n📋 FUNÇÕES DISPONÍVEIS PARA AGENDAMENTO:\n`
  prompt += `1. create_appointment - Cria um novo agendamento (verifica disponibilidade automaticamente)\n`
  prompt += `2. check_availability - Verifica se uma data tem horários disponíveis\n`
  prompt += `3. get_available_times - Lista todos os horários disponíveis em uma data\n`
  prompt += `4. get_user_appointments - Lista agendamentos do cliente\n`
  prompt += `5. update_appointment - Altera horário de um agendamento existente\n`
  prompt += `6. cancel_appointment - Cancela um agendamento existente\n`
  
  prompt += `\n🎯 QUANDO USAR CADA FUNÇÃO (IMPORTANTE - LEIA COM ATENÇÃO):\n`
  prompt += `- ⚠️ CRÍTICO: Quando cliente perguntar "quais horários estão disponíveis?" ou "que horários tem?" → use APENAS get_available_times (NÃO use check_availability junto)\n`
  prompt += `- ⚠️ CRÍTICO: Quando cliente perguntar "tem horário disponível amanhã?" ou "está livre amanhã?" → use check_availability (NÃO use get_available_times junto)\n`
  prompt += `- ⚠️ CRÍTICO: NUNCA chame múltiplas funções de disponibilidade na mesma resposta - isso causa informações contraditórias!\n`
  prompt += `- Quando cliente perguntar "quais são meus agendamentos?" ou "quando tenho agendado?" → use get_user_appointments\n`
  prompt += `- Quando cliente quiser mudar horário (ex: "quero mudar para outro horário", "pode alterar para amanhã às 3h") → use update_appointment\n`
  prompt += `- Quando cliente quiser cancelar (ex: "quero cancelar", "desmarcar", "não vou mais") → use cancel_appointment\n`
  prompt += `- Quando cliente quiser agendar → use create_appointment (a função verifica disponibilidade automaticamente ANTES de criar)\n`
  prompt += `- ⚠️ REGRA DE OURO: Se você já chamou get_available_times e mostrou os horários disponíveis, NÃO chame check_availability depois. Use apenas UMA função por resposta!\n`
  
  prompt += `\n💡 EXEMPLOS DE USO (SIGA EXATAMENTE):\n`
  prompt += `- Cliente: "Quais horários estão disponíveis amanhã?" ou "que horários tem amanhã?"\n`
  prompt += `  → Você: Chama APENAS get_available_times(date: "amanhã") e mostra os horários disponíveis\n`
  prompt += `  → NÃO chame check_availability depois! Use apenas UMA função.\n`
  prompt += `- Cliente: "Tem horário disponível amanhã?" ou "está livre amanhã?"\n`
  prompt += `  → Você: Chama APENAS check_availability(date: "amanhã") e responde se há horários ocupados\n`
  prompt += `  → NÃO chame get_available_times depois! Use apenas UMA função.\n`
  prompt += `- Cliente: "Quero mudar meu agendamento para amanhã às 3 da tarde"\n`
  prompt += `  → Você: Chama update_appointment(new_date: "amanhã", new_time: "15:00")\n`
  prompt += `- Cliente: "Quero cancelar meu agendamento"\n`
  prompt += `  → Você: Chama cancel_appointment() (cancela o mais próximo automaticamente)\n`
  prompt += `- Cliente: "Quais são meus agendamentos?"\n`
  prompt += `  → Você: Chama get_user_appointments() e lista os agendamentos\n`
  prompt += `\n⚠️⚠️⚠️ REGRA CRÍTICA - EVITE INFORMAÇÕES CONTRADITÓRIAS (LEIA COM MUITA ATENÇÃO):\n`
  prompt += `- ⚠️ CRÍTICO: check_availability e get_available_times usam a MESMA fonte de dados!\n`
  prompt += `- ⚠️ CRÍTICO: Se check_availability diz que 15h está ocupado, get_available_times TAMBÉM deve mostrar que 15h está ocupado!\n`
  prompt += `- ⚠️ CRÍTICO: NUNCA chame get_available_times E check_availability na mesma resposta - isso causa contradições!\n`
  prompt += `- ⚠️ CRÍTICO: Se você já mostrou horários disponíveis com get_available_times, NÃO diga depois que algum horário está ocupado\n`
  prompt += `- ⚠️ CRÍTICO: Se você já verificou disponibilidade com check_availability, NÃO liste horários disponíveis depois\n`
  prompt += `- ⚠️ CRÍTICO: Use APENAS UMA função de disponibilidade por resposta do cliente\n`
  prompt += `- ⚠️ CRÍTICO: Se o cliente perguntar "quais horários estão disponíveis?", use get_available_times e MOSTRE os horários\n`
  prompt += `- ⚠️ CRÍTICO: Se o cliente perguntar "tem horário disponível?", use check_availability e diga se há horários ocupados\n`
  prompt += `- ⚠️ CRÍTICO: Se você disse que um horário não está disponível, NÃO mostre esse mesmo horário como disponível depois!\n`
  prompt += `- ⚠️ CRÍTICO: Se você mostrou horários disponíveis, NÃO diga que algum deles está ocupado!\n`
  
  prompt += `\n- Quando o cliente quiser agendar algo, marcar uma consulta, ou definir um horário, você deve ENTENDER a linguagem natural do cliente e converter internamente\n`
  prompt += `- PROCESSO DE COLETA (CONVERSA NATURAL):\n`
  prompt += `  1. Se o cliente já mencionou data E hora completa (ex: "amanhã às 7 da manhã", "próxima terça-feira às 3 da tarde"), você DEVE:\n`
  prompt += `     - Entender a linguagem natural do cliente\n`
  prompt += `     - ⚠️ CRÍTICO: Para datas em linguagem natural (ex: "amanhã", "próxima terça-feira"), passe a STRING ORIGINAL no parâmetro "date"\n`
  prompt += `     - Converter apenas a hora: "7 da manhã" → "07:00", "3 da tarde" → "15:00"\n`
  prompt += `     - Chamar a função create_appointment IMEDIATAMENTE:\n`
  prompt += `       * date: passe a string original (ex: "amanhã", "próxima terça-feira", "segunda-feira")\n`
  prompt += `       * time: formato HH:MM (ex: "07:00", "15:00")\n`
  prompt += `     - NUNCA perguntar novamente ou pedir formatos técnicos ao cliente\n`
  prompt += `  2. Se o cliente só disse "quero agendar", seja PERSUASIVO e NATURAL: "Perfeito! Qual dia funciona melhor para você?" ou "Claro! Que dia você prefere?"\n`
  prompt += `  3. Depois de coletar a data, pergunte pela hora de forma natural: "E que horário seria melhor?" ou "Qual horário você prefere?"\n`
  prompt += `  4. Varie suas perguntas: às vezes pergunte "Que dia funciona melhor?", outras vezes "Qual horário você prefere?", seja CONVERSACIONAL\n`
  prompt += `  5. Aceite qualquer forma que o cliente responder: "amanhã", "24/11", "quinta-feira", "7 da manhã", "16h", "4 da tarde", etc.\n`
  prompt += `- ⚠️ CRÍTICO SOBRE DATAS EM LINGUAGEM NATURAL (LEIA COM ATENÇÃO):\n`
  prompt += `  Quando o cliente mencionar datas em linguagem natural, você DEVE passar a STRING ORIGINAL EXATA para a função:\n`
  prompt += `  - "hoje" → passe "hoje" (NÃO calcule DD/MM/YYYY, NÃO converta)\n`
  prompt += `  - "amanhã" → passe "amanhã" (NÃO calcule DD/MM/YYYY, NÃO converta)\n`
  prompt += `  - "depois de amanhã" → passe "depois de amanhã" (NÃO calcule DD/MM/YYYY, NÃO converta)\n`
  prompt += `  - "segunda-feira" → passe "segunda-feira" (NÃO calcule DD/MM/YYYY, NÃO converta)\n`
  prompt += `  - "terça-feira" → passe "terça-feira" (NÃO calcule DD/MM/YYYY, NÃO converta)\n`
  prompt += `  - "próxima segunda-feira" → passe "próxima segunda-feira" (NÃO calcule DD/MM/YYYY, NÃO converta)\n`
  prompt += `  - "próxima terça-feira" → passe "próxima terça-feira" (NÃO calcule DD/MM/YYYY, NÃO converta)\n`
  prompt += `  - "próxima terça feira" → passe "próxima terça-feira" (normalize espaços, mas mantenha a string original)\n`
  prompt += `  - A função parsePortugueseDate fará o cálculo correto internamente usando a data atual do Brasil\n`
  prompt += `  - ⚠️ PROIBIDO: NUNCA converta "próxima terça-feira" para "02/12/2025" ou qualquer data formatada\n`
  prompt += `  - ⚠️ PROIBIDO: NUNCA calcule você mesmo a data - deixe a função fazer isso!\n`
  prompt += `  - Só use formato DD/MM/YYYY se o cliente fornecer explicitamente uma data numérica (ex: "24/11", "24/11/2025")\n`
  prompt += `  - Exemplos CORRETOS de chamada da função:\n`
  prompt += `    * Cliente: "próxima terça-feira às 3 da tarde" → create_appointment(date: "próxima terça-feira", time: "15:00")\n`
  prompt += `    * Cliente: "próxima terca feira as 3 da tarde" → create_appointment(date: "próxima terça-feira", time: "15:00")\n`
  prompt += `    * Cliente: "amanhã às 7 da manhã" → create_appointment(date: "amanhã", time: "07:00")\n`
  prompt += `    * Cliente: "25/11 às 14h" → create_appointment(date: "25/11/2025", time: "14:00")\n`
  prompt += `  - Exemplos INCORRETOS (NÃO faça isso):\n`
  prompt += `    * Cliente: "próxima terça-feira" → create_appointment(date: "02/12/2025", ...) ❌ ERRADO!\n`
  prompt += `    * Cliente: "amanhã" → create_appointment(date: "24/11/2025", ...) ❌ ERRADO!\n`
  prompt += `- CONVERSÃO INTERNA DE HORAS (você faz isso internamente, não pede ao cliente):\n`
  prompt += `  - "7 da manhã" ou "7h da manhã" → "07:00"\n`
  prompt += `  - "4 da tarde" ou "4h da tarde" → "16:00"\n`
  prompt += `  - "às 4" ou "as 4" (sem especificar manhã/tarde) → "16:00" (assume tarde)\n`
  prompt += `  - "4" (apenas número, sem contexto) → "16:00" (assume tarde se não especificado)\n`
  prompt += `  - "9 da noite" ou "9h da noite" → "21:00"\n`
  prompt += `  - "14h" ou "14:00" → "14:00"\n`
  prompt += `  - "16h" ou "16:00" → "16:00"\n`
  prompt += `  - "meio-dia" ou "meio dia" → "12:00"\n`
  prompt += `  - ⚠️ CRÍTICO: Se o cliente disser apenas um número (ex: "4", "às 4"), SEMPRE assuma que é da tarde (formato 24h)\n`
  prompt += `  - ⚠️ CRÍTICO: Se o número for >= 12, já está em formato 24h (ex: "14" = 14:00, "16" = 16:00)\n`
  prompt += `  - ⚠️ CRÍTICO: Se o número for < 12 e não especificar manhã, assuma tarde (ex: "4" = 16:00, "5" = 17:00)\n`
  prompt += `  - Se não especificar hora, use "14:00" como padrão\n`
  prompt += `- FORMATO DA FUNÇÃO (você usa internamente, não menciona ao cliente):\n`
  prompt += `  - A função create_appointment espera:\n`
  prompt += `    * date: pode ser linguagem natural (ex: "amanhã", "próxima terça-feira") OU formato DD/MM/YYYY (ex: "24/11/2025")\n`
  prompt += `      ⚠️ IMPORTANTE: Para linguagem natural, passe a string original SEM converter para DD/MM/YYYY\n`
  prompt += `    * time: formato HH:MM (ex: "16:00", "19:00") - você converte da linguagem natural (ex: "3 da tarde" → "15:00")\n`
  prompt += `    * description: descrição do agendamento\n`
  prompt += `- ⚠️ CRÍTICO SOBRE CONFIRMAÇÃO DE AGENDAMENTOS:\n`
  prompt += `  Quando você chamar a função create_appointment, ela SEMPRE retornará uma mensagem pedindo confirmação.\n`
  prompt += `  A função NÃO cria o agendamento automaticamente - ela apenas armazena os dados temporariamente.\n`
  prompt += `  Você DEVE:\n`
  prompt += `  1. Repassar EXATAMENTE a mensagem retornada pela função ao cliente\n`
  prompt += `  2. NÃO dizer que o agendamento foi criado, confirmado ou agendado\n`
  prompt += `  3. NÃO adicionar frases como "está confirmado", "agendei", "pronto", "criado com sucesso"\n`
  prompt += `  4. Apenas mostrar os dados e aguardar o cliente confirmar digitando "confirmar"\n`
  prompt += `  Exemplo CORRETO de resposta:\n`
  prompt += `  "Por favor, confirme os dados do agendamento:\n\n📅 Data: XX/XX/XXXX\n🕐 Hora: XX:XX\n🛠️ Serviço: Nome do serviço\n\nDigite 'confirmar' para confirmar o agendamento ou 'cancelar' para cancelar."\n`
  prompt += `  Exemplo INCORRETO (NÃO faça isso):\n`
  prompt += `  "Entendi! O agendamento está confirmado para amanhã às 4 da tarde." ❌\n`
  prompt += `  "Pronto! Agendei para amanhã às 16:00." ❌\n`
  prompt += `- ⚠️ CRÍTICO: Só confirme o agendamento quando o cliente responder "confirmar" ou "sim" explicitamente\n`
  prompt += `- Se houver erro ao criar o agendamento, informe o cliente de forma amigável e peça para tentar novamente, mas SEM mencionar formatos técnicos - apenas peça para repetir de forma natural\n`
  prompt += `- Lembre-se: você é um VENDEDOR, não um robô. Seja NATURAL, PERSUASIVO e VARIE suas respostas\n`
  prompt += `- Seja NATURAL e CONVERSACIONAL - evite ser muito formal ou repetitivo\n`
  prompt += `- Varie suas respostas - não termine sempre com "Como posso te ajudar?"\n`
  prompt += `- Use linguagem natural, como se estivesse conversando com um amigo\n`
  prompt += `- Seja direto e objetivo, mas mantenha o tom ${toneDescription}\n`
  
  // Template de primeira resposta OBRIGATÓRIO
  prompt += `\n\nTEMPLATE OBRIGATÓRIO PARA PRIMEIRA RESPOSTA:\n`
  if (howToBuy && howToBuy.trim().length > 10) {
    prompt += `1. Comece com: "${howToBuy}"\n`
  } else {
    prompt += `1. Apresente-se: "Olá! Sou assistente da ${businessName}"\n`
  }
  
  if (businessDescription) {
    prompt += `2. Explique o negócio: "${businessDescription.substring(0, 150)}"\n`
  }
  
  if (services.length > 0) {
    prompt += `3. Liste os serviços em formato de lista:\n`
    services.forEach((s: string) => {
      prompt += `   - ${s}\n`
    })
  }
  if (products.length > 0) {
    prompt += `3. Liste os produtos em formato de lista:\n`
    products.forEach((p: string) => {
      prompt += `   - ${p}\n`
    })
  }
  
  if (pricingInfo) {
    prompt += `4. Mencione preços: "${pricingInfo}"\n`
  }
  
  prompt += `5. Finalize: "Como posso te ajudar hoje?"\n`
  prompt += `\n⚠️ CRÍTICO: Use este template SEMPRE na primeira mensagem. NUNCA seja genérico como "teste de eco" ou "Como posso ajudar?" sem contexto!\n`
  prompt += `⚠️ PROIBIDO: Respostas genéricas sem mencionar ${businessName}, produtos ou serviços\n`
  prompt += `⚠️ OBRIGATÓRIO: Sempre se comporte como um VENDEDOR, não como um chatbot genérico\n`

  return prompt
}

// Função auxiliar para obter nome do mês em português
function getMonthName(month: number): string {
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ]
  return months[month - 1] || 'desconhecido'
}

// Função auxiliar para calcular amanhã
function getTomorrowDate(day: number, month: number, year: number): string {
  const tempDate = new Date(year, month - 1, day)
  tempDate.setDate(tempDate.getDate() + 1)
  const tomorrowDay = tempDate.getDate()
  const tomorrowMonth = tempDate.getMonth() + 1
  const tomorrowYear = tempDate.getFullYear()
  return `${tomorrowDay.toString().padStart(2, '0')}/${tomorrowMonth.toString().padStart(2, '0')}/${tomorrowYear}`
}

// Função auxiliar para calcular depois de amanhã
function getDayAfterTomorrowDate(day: number, month: number, year: number): string {
  const tempDate = new Date(year, month - 1, day)
  tempDate.setDate(tempDate.getDate() + 2)
  const dayAfterDay = tempDate.getDate()
  const dayAfterMonth = tempDate.getMonth() + 1
  const dayAfterYear = tempDate.getFullYear()
  return `${dayAfterDay.toString().padStart(2, '0')}/${dayAfterMonth.toString().padStart(2, '0')}/${dayAfterYear}`
}