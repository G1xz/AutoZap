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
  // ⚠️ IMPORTANTE: NÃO confundir "finalizar pedido" com "encerrar conversa"!
  const wantsToCloseChat =
    // Detecta explicitamente "encerrar chat/conversa"
    (userMessageLower.includes('encerrar') && (userMessageLower.includes('chat') || userMessageLower.includes('conversa') || userMessageLower.includes('atendimento'))) ||
    (normalizedMessage.includes('encerrar') && (normalizedMessage.includes('chat') || normalizedMessage.includes('conversa') || normalizedMessage.includes('atendimento'))) ||
    // Detecta explicitamente "fechar chat/conversa"
    (userMessageLower.includes('fechar') && (userMessageLower.includes('chat') || userMessageLower.includes('conversa') || userMessageLower.includes('atendimento'))) ||
    (normalizedMessage.includes('fechar') && (normalizedMessage.includes('chat') || normalizedMessage.includes('conversa') || normalizedMessage.includes('atendimento'))) ||
    // Detecta "tchau", "até logo", "obrigado e tchau" como intenção de encerrar
    userMessageLower.includes('tchau') ||
    userMessageLower.includes('até logo') ||
    userMessageLower.includes('ate logo') ||
    (userMessageLower.includes('obrigado') && (userMessageLower.includes('tchau') || userMessageLower.includes('até') || userMessageLower.includes('ate'))) ||
    // Detecta "terminar" apenas se for sobre chat/conversa/atendimento
    (userMessageLower.includes('terminar') && (userMessageLower.includes('chat') || userMessageLower.includes('conversa') || userMessageLower.includes('atendimento'))) ||
    (normalizedMessage.includes('terminar') && (normalizedMessage.includes('chat') || normalizedMessage.includes('conversa') || normalizedMessage.includes('atendimento')))

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

        // CRÍTICO: Se não há agendamento pendente e a mensagem é apenas "sim"/"ok",
        // pode ser sobre adicionar produto ao carrinho, não sobre agendamento
        // Só retorna true se a mensagem for explicitamente sobre agendamento
        const isExplicitlyAboutAppointment = 
          userMessageLower.includes('agendamento') ||
          userMessageLower.includes('agendar') ||
          userMessageLower.includes('horário') ||
          userMessageLower.includes('horario') ||
          userMessageLower.includes('marcar') ||
          userMessageLower.includes('consulta') ||
          userMessageLower.includes('serviço') ||
          userMessageLower.includes('servico')

        if (!isExplicitlyAboutAppointment) {
          console.log(`   Mensagem "sim"/"ok" sem contexto de agendamento - pode ser sobre carrinho/produto`)
          console.log(`   RETORNANDO FALSE para permitir que IA processe (pode ser adicionar ao carrinho)`)
          return false // Deixa a IA processar - pode ser sobre adicionar produto ao carrinho
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
    let [hour, minute] = pendingAppointment.time.split(':').map(Number)

    console.log(`📅 Convertendo dados: ${day}/${month}/${year} às ${hour}:${minute}`)
    
    // CRÍTICO: Tenta corrigir a hora se parecer errada
    // Busca a última mensagem do usuário antes do agendamento pendente ser criado
    // para verificar se há uma discrepância (ex: "1 da tarde" mas hora é 12:00)
    try {
      const { prisma } = await import('./prisma')
      
      // CRÍTICO: Busca mensagens do contato nos últimos 10 minutos (mais amplo)
      // Tenta múltiplos formatos do número para garantir que encontra
      const searchNumbers = [
        normalizedContactNumber,
        normalizedContactNumber.replace(/^55/, ''), // Sem código do país
        `55${normalizedContactNumber.replace(/^55/, '')}`, // Com código do país
      ]
      
      console.log(`🔍 [processAppointmentConfirmation] Buscando mensagem original para correção de hora`)
      console.log(`   Números a buscar:`, searchNumbers)
      console.log(`   instanceId: ${instanceId}`)
      
      // Busca a mensagem mais recente do contato que contenha palavras relacionadas a agendamento
      const recentMessage = await prisma.message.findFirst({
        where: {
          instanceId,
          from: {
            in: searchNumbers,
          },
          isFromMe: false, // Mensagem recebida (não enviada por nós)
          body: {
            contains: 'agendar', // Filtra apenas mensagens sobre agendamento
          },
          createdAt: {
            gte: new Date(Date.now() - 10 * 60 * 1000), // Últimos 10 minutos (mais amplo)
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          body: true,
          createdAt: true,
        },
      })
      
      console.log(`🔍 [processAppointmentConfirmation] Mensagem encontrada:`, recentMessage ? `"${recentMessage.body.substring(0, 50)}..."` : 'NÃO ENCONTRADA')
      
      if (recentMessage?.body) {
        const messageLower = recentMessage.body.toLowerCase()
        console.log(`🔍 [processAppointmentConfirmation] Buscando correção de hora na mensagem: "${messageLower}"`)
        
        // Procura por padrões de hora na mensagem original
        const tardeMatch = messageLower.match(/(\d{1,2})\s*(?:da\s*)?tarde/i)
        const noiteMatch = messageLower.match(/(\d{1,2})\s*(?:da\s*)?noite/i)
        const manhaMatch = messageLower.match(/(\d{1,2})\s*(?:da\s*)?(?:manhã|manha)/i)
        
        console.log(`🔍 [processAppointmentConfirmation] Padrões encontrados:`)
        console.log(`   "tarde":`, tardeMatch ? `"${tardeMatch[0]}" (hora: ${tardeMatch[1]})` : 'NÃO')
        console.log(`   "noite":`, noiteMatch ? `"${noiteMatch[0]}" (hora: ${noiteMatch[1]})` : 'NÃO')
        console.log(`   "manhã":`, manhaMatch ? `"${manhaMatch[0]}" (hora: ${manhaMatch[1]})` : 'NÃO')
        
        if (tardeMatch) {
          const requestedHour = parseInt(tardeMatch[1])
          const expectedHour = requestedHour >= 1 && requestedHour <= 11 ? requestedHour + 12 : requestedHour
          console.log(`🔍 [processAppointmentConfirmation] Comparando: hora atual=${hour}, esperada=${expectedHour}`)
          if (hour !== expectedHour) {
            console.log(`🔧 [processAppointmentConfirmation] ✅✅✅ CORREÇÃO APLICADA: Hora do agendamento pendente (${hour}:${minute}) não corresponde à mensagem original ("${requestedHour} da tarde" = ${expectedHour}:00)`)
            hour = expectedHour
            minute = 0
            console.log(`🔧 [processAppointmentConfirmation] ✅ Hora corrigida para: ${hour}:${minute.toString().padStart(2, '0')}`)
          } else {
            console.log(`✅ [processAppointmentConfirmation] Hora já está correta: ${hour}:${minute.toString().padStart(2, '0')}`)
          }
        } else if (noiteMatch) {
          const requestedHour = parseInt(noiteMatch[1])
          const expectedHour = requestedHour >= 1 && requestedHour <= 11 ? requestedHour + 12 : requestedHour
          if (hour !== expectedHour) {
            console.log(`🔧 [processAppointmentConfirmation] ✅✅✅ CORREÇÃO APLICADA: Hora do agendamento pendente (${hour}:${minute}) não corresponde à mensagem original ("${requestedHour} da noite" = ${expectedHour}:00)`)
            hour = expectedHour
            minute = 0
            console.log(`🔧 [processAppointmentConfirmation] ✅ Hora corrigida para: ${hour}:${minute.toString().padStart(2, '0')}`)
          }
        } else if (manhaMatch) {
          const requestedHour = parseInt(manhaMatch[1])
          if (hour !== requestedHour) {
            console.log(`🔧 [processAppointmentConfirmation] ✅✅✅ CORREÇÃO APLICADA: Hora do agendamento pendente (${hour}:${minute}) não corresponde à mensagem original ("${requestedHour} da manhã" = ${requestedHour}:00)`)
            hour = requestedHour
            minute = 0
            console.log(`🔧 [processAppointmentConfirmation] ✅ Hora corrigida para: ${hour}:${minute.toString().padStart(2, '0')}`)
          }
        } else {
          console.log(`⚠️ [processAppointmentConfirmation] Nenhum padrão de hora encontrado na mensagem original`)
        }
      } else {
        console.log(`⚠️ [processAppointmentConfirmation] Mensagem original não encontrada ou sem body`)
      }
    } catch (error: any) {
      console.error(`⚠️ [processAppointmentConfirmation] Erro ao buscar mensagem original para correção:`, error?.message || error)
      console.error(`⚠️ [processAppointmentConfirmation] Stack:`, error?.stack)
      // Continua com a hora do agendamento pendente mesmo se houver erro
    }

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
export async function executeAIOnlyWorkflow(
  workflow: any,
  instanceId: string,
  contactNumber: string,
  userMessage: string,
  contactName?: string
): Promise<void> {
  try {
    // Log do número recebido
    console.log(`🤖 [executeAIOnlyWorkflow] ========== INICIANDO WORKFLOW IA ==========`)
    console.log(`   instanceId: ${instanceId}`)
    console.log(`   contactNumber recebido: "${contactNumber}"`)
    console.log(`   contactNumber normalizado: "${contactNumber.replace(/\D/g, '')}"`)
    console.log(`   userMessage: "${userMessage}"`)
    console.log(`   ⏰ Timestamp: ${new Date().toISOString()}`)
    console.log(`   📍 Este log confirma que o sistema está processando mensagens!`)
    
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

    // PRIMEIRO: Verifica contexto de carrinho ANTES de verificar agendamento
    // Se há itens no carrinho e mensagem é sobre confirmar/finalizar, é sobre pedido, não agendamento
    const normalizedContactForCart = contactNumber.replace(/\D/g, '')
    let hasCartItems = false
    
    try {
      const { getCart } = await import('./cart')
      const cart = await getCart(instanceId, normalizedContactForCart)
      hasCartItems = cart.items.length > 0
      
      console.log(`🛒 [executeAIOnlyWorkflow] Verificando contexto de carrinho:`)
      console.log(`   Itens no carrinho: ${cart.items.length}`)
      console.log(`   hasCartItems: ${hasCartItems}`)
      
      // Detecta se a mensagem é sobre escolher tipo de entrega (retirada/entrega)
      const isDeliveryTypeResponse = hasCartItems && (
        userMessage.toLowerCase().trim() === 'retirada' ||
        userMessage.toLowerCase().trim() === 'entrega' ||
        userMessage.toLowerCase().includes('retirar') ||
        userMessage.toLowerCase().includes('receber em casa') ||
        userMessage.toLowerCase().includes('delivery') ||
        userMessage.toLowerCase().includes('pickup')
      )
      
      // Detecta se a mensagem parece ser um endereço (contém padrões de endereço)
      const looksLikeAddress = hasCartItems && (
        /(?:rua|avenida|av\.?|r\.?|estrada|rodovia)\s+[^,\n]+(?:,\s*\d+)?/i.test(userMessage) ||
        /\d{5}-?\d{3}/.test(userMessage) || // CEP
        (userMessage.includes(',') && userMessage.split(',').length >= 3) || // Múltiplas partes separadas por vírgula
        (userMessage.includes('-') && userMessage.split('-').length >= 2 && /\d/.test(userMessage)) // Formato cidade - estado
      )
      
      // Verifica se a IA acabou de pedir um endereço (última mensagem da IA)
      const recentAIMessage = await prisma.message.findFirst({
        where: {
          instanceId,
          to: normalizedContactForCart,
          isFromMe: true,
        },
        orderBy: { timestamp: 'desc' },
        take: 1,
      })
      
      const aiJustAskedForAddress = recentAIMessage && (
        recentAIMessage.body.toLowerCase().includes('endereço') ||
        recentAIMessage.body.toLowerCase().includes('endereco') ||
        recentAIMessage.body.toLowerCase().includes('onde entregar') ||
        recentAIMessage.body.toLowerCase().includes('informe o endereço') ||
        recentAIMessage.body.toLowerCase().includes('endereço completo') ||
        recentAIMessage.body.toLowerCase().includes('endereço de entrega')
      )
      
      // Verifica se há agendamento pendente ANTES de decidir o contexto
      const hasPendingAppointment = await prisma.pendingAppointment.findFirst({
        where: {
          instanceId,
          contactNumber: normalizedContactForCart,
        },
      })
      
      // Se há itens no carrinho e mensagem é sobre confirmar/finalizar, NÃO processa agendamento
      // CRÍTICO: "sim" só é agendamento se houver agendamento pendente, caso contrário é sobre carrinho/produto
      const userMessageLower = userMessage.toLowerCase().trim()
      const isSimpleYes = userMessageLower === 'sim' || userMessageLower === 'ok' || userMessageLower === 's'
      
      // CRÍTICO: Detecta se a mensagem é explicitamente sobre AGENDAMENTO
      // Se for, SEMPRE processa agendamento, mesmo que haja itens no carrinho
      const isExplicitlyAboutAppointment = 
        userMessageLower.includes('agendar') ||
        userMessageLower.includes('agendamento') ||
        userMessageLower.includes('marcar') ||
        userMessageLower.includes('horário') ||
        userMessageLower.includes('horario') ||
        userMessageLower.includes('consulta') ||
        userMessageLower.includes('serviço') ||
        userMessageLower.includes('servico') ||
        userMessageLower.includes('confronto') ||
        userMessageLower.includes('abismo') ||
        userMessageLower.includes('análise') ||
        userMessageLower.includes('analise')
      
      // Define isCartContext ANTES de usar (fora dos blocos condicionais)
      const isCartContext = !isExplicitlyAboutAppointment && hasCartItems && (
        isDeliveryTypeResponse ||
        looksLikeAddress ||
        (aiJustAskedForAddress && looksLikeAddress) ||
        userMessageLower.includes('confirmar') ||
        userMessageLower.includes('finalizar') ||
        userMessageLower.includes('fechar pedido') ||
        userMessageLower.includes('completar pedido') ||
        userMessageLower.includes('concluir compra')
      )
      
      // CRÍTICO: Se não há agendamento pendente e a mensagem é apenas "sim"/"ok",
      // NÃO processa como agendamento - deixa a IA processar (pode ser adicionar produto)
      if (isSimpleYes && !hasPendingAppointment) {
        console.log(`🛒 [executeAIOnlyWorkflow] "Sim" sem agendamento pendente - deixando IA processar (pode ser adicionar produto)`)
        // Não processa agendamento, deixa a IA processar normalmente
      } else {
        // CRÍTICO: Se a mensagem é explicitamente sobre agendamento, SEMPRE processa agendamento
        // mesmo que haja itens no carrinho - não pula verificação
        if (isExplicitlyAboutAppointment) {
          console.log(`📅 [executeAIOnlyWorkflow] Mensagem é sobre AGENDAMENTO, processando agendamento (ignorando contexto de carrinho)`)
          console.log(`   Mensagem: "${userMessage}"`)
          console.log(`   Itens no carrinho: ${cart.items.length} (será ignorado)`)
          // Continua processando agendamento normalmente abaixo
        } else if (isCartContext) {
          console.log(`🛒 [executeAIOnlyWorkflow] ⚠️ Contexto é de CARRINHO, pulando verificação de agendamento`)
          console.log(`   Mensagem: "${userMessage}"`)
          console.log(`   Itens no carrinho: ${cart.items.length}`)
          console.log(`   Parece endereço: ${looksLikeAddress}`)
          console.log(`   IA pediu endereço: ${aiJustAskedForAddress}`)
          // Não processa agendamento, deixa a IA processar o checkout ou adicionar ao carrinho
        } else if (hasPendingAppointment) {
          // Só processa agendamento se houver agendamento pendente
          console.log(`🔍 [executeAIOnlyWorkflow] Há agendamento pendente, verificando confirmação...`)
        }
        
        // Processa agendamento se não foi contexto de carrinho OU se é explicitamente sobre agendamento
        if (!isCartContext || isExplicitlyAboutAppointment) {

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
            
            return // Retorna sem chamar IA
          }
        }
      }
    } catch (cartError) {
      console.error(`🛒 [executeAIOnlyWorkflow] Erro ao verificar carrinho, continuando normalmente:`, cartError)
      // Se houver erro ao verificar carrinho, continua normalmente verificando agendamento
      const processedAppointment = await processAppointmentConfirmation(
        instanceId,
        contactNumber,
        userMessage,
        userId,
        contactNameFinal
      )

      if (processedAppointment) {
        const executionKeyAI = `${instanceId}-${contactNumber}`
        if (workflowExecutions.has(executionKeyAI)) {
        workflowExecutions.delete(executionKeyAI)
      }

      return // CRÍTICO: Retorna aqui se processou confirmação/cancelamento - NÃO CHAMA IA
      }
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

    console.log(`📊 [executeAIOnlyWorkflow] Mensagens recentes encontradas: ${recentMessages.length}`)
    console.log(`   Mensagens da IA (isFromMe=true): ${recentMessages.filter(m => m.isFromMe).length}`)
    recentMessages.forEach((msg, i) => {
      console.log(`   [${i + 1}] ${msg.isFromMe ? 'IA' : 'Usuário'}: ${msg.body.substring(0, 50)}...`)
    })

    // CRÍTICO: Se a mensagem atual é uma solicitação explícita de agendamento,
    // limita o histórico para evitar que mensagens anteriores confundam a IA
    const isExplicitAppointmentRequest = 
      userMessageLower.includes('agendar') ||
      userMessageLower.includes('marcar') ||
      userMessageLower.includes('horário') ||
      userMessageLower.includes('horario')
    
    // Converte mensagens para formato de histórico
    let conversationHistory = recentMessages
      .reverse() // Inverte para ordem cronológica
      .map((msg) => ({
        role: msg.isFromMe ? 'assistant' : 'user' as 'user' | 'assistant',
        content: msg.body,
      }))
    
    // Se é solicitação explícita de agendamento, limita histórico para evitar confusão
    if (isExplicitAppointmentRequest && conversationHistory.length > 5) {
      console.log(`📅 [executeAIOnlyWorkflow] Solicitação explícita de agendamento detectada, limitando histórico de ${conversationHistory.length} para 5 mensagens`)
      // Mantém apenas as últimas 5 mensagens (incluindo a atual)
      conversationHistory = conversationHistory.slice(-5)
    }

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

    // Verifica se é a primeira interação
    // CRÍTICO: Considera primeira interação APENAS se NÃO há nenhuma mensagem da IA ainda
    // Se já houve resposta da IA (mesmo que pré-definida), NÃO é mais primeira interação
    const hasAIResponse = recentMessages.some(msg => msg.isFromMe)
    // CRÍTICO: Não usa length <= 2 porque pode ter mensagem do usuário + resposta pré-definida = 2 mensagens
    // Se já tem resposta da IA, NÃO é primeira interação
    const isFirstInteraction = !hasAIResponse

    console.log(`🔍 Debug primeira interação:`, {
      conversationHistoryLength: conversationHistory.length,
      hasAIResponse,
      isFirstInteraction,
      recentMessagesCount: recentMessages.length,
      businessName: businessDetails.businessName,
      hasBusinessDetails: !!workflow.aiBusinessDetails
    })

    // SEMPRE usa resposta pré-definida APENAS se:
    // 1. É primeira interação (não há resposta da IA ainda) E tem nome do negócio
    // CRÍTICO: Se já houve resposta da IA, NÃO usa mais pré-definida
    const shouldUsePredefined = isFirstInteraction && businessDetails.businessName

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
      description: '⚠️⚠️⚠️⚠️⚠️ CRÍTICO ABSOLUTO - LEIA COM ATENÇÃO: Cria um agendamento na agenda quando o cliente quer marcar um horário. ⚠️⚠️⚠️ REGRA DE OURO: Quando o cliente pedir para agendar e você tiver DATA E HORA, você DEVE CHAMAR ESTA FUNÇÃO IMEDIATAMENTE, SEM EXCEÇÃO! ⚠️⚠️⚠️ IGNORE mensagens anteriores onde você perguntou "qual serviço?" - Se o cliente mencionou um serviço na MENSAGEM ATUAL, use esse serviço! ⚠️⚠️⚠️ NUNCA responda apenas com texto pedindo confirmação - SEMPRE chame a função primeiro! ⚠️⚠️⚠️ SE VOCÊ NÃO CHAMAR ESTA FUNÇÃO, O AGENDAMENTO NÃO SERÁ CRIADO E O CLIENTE FICARÁ CONFUSO! MAPEAMENTO DE SERVIÇOS: Se o cliente disser "confronto" ou "um confronto", mapeie para "Confronto Abissal". Se disser "abismo", mapeie para "Abismo Espiral". Se disser "análise" ou "analise", mapeie para "Análise de Conta". Use o nome COMPLETO do serviço na descrição. EXEMPLOS OBRIGATÓRIOS: Cliente: "agendar um confronto para amanhã meio dia" → VOCÊ DEVE CHAMAR IMEDIATAMENTE: create_appointment(date: "amanhã", time: "12:00", description: "Confronto Abissal"). Cliente: "quero marcar para terça às 14h" → VOCÊ DEVE CHAMAR IMEDIATAMENTE: create_appointment(date: "terça-feira", time: "14:00", description: "serviço solicitado"). ⚠️⚠️⚠️ SE O CLIENTE DISSER "AGENDAR" E VOCÊ TIVER DATA E HORA, CHAME A FUNÇÃO AGORA! NÃO PERGUNTE QUAL SERVIÇO - USE O QUE O CLIENTE MENCIONOU NA MENSAGEM ATUAL OU "serviço solicitado"! NÃO PEÇA CONFIRMAÇÃO ANTES - CHAME A FUNÇÃO E ELA VAI PEDIR CONFIRMAÇÃO! A função aceita linguagem natural para data (ex: "amanhã", "próxima segunda") e converte automaticamente. A função verifica automaticamente se o horário está disponível antes de criar.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Data do agendamento. Você pode passar no formato DD/MM/YYYY (ex: "24/11/2025") OU linguagem natural em português (ex: "amanhã", "próxima segunda-feira", "terça que vem"). ⚠️ CRÍTICO: SEMPRE repasse exatamente o que o cliente disse ("amanhã", "próxima terça", etc.) que o sistema converte automaticamente usando a data atual.',
          },
          time: {
            type: 'string',
            description: 'Hora do agendamento no formato HH:MM em horário de 24 horas (ex: "14:00", "16:00", "19:00"). ⚠️ CRÍTICO - CONVERSÃO DE HORAS: "2 da tarde" = "14:00" (NÃO "12:00"!), "3 da tarde" = "15:00", "4 da tarde" = "16:00", "5 da tarde" = "17:00". "7 da manhã" = "07:00", "9 da noite" = "21:00". "meio dia" ou "meio-dia" = "12:00". Se o cliente disser apenas um número sem especificar manhã/tarde/noite e for < 12, assuma TARDE (ex: "às 4" = "16:00"). Se não especificar hora, use "14:00" como padrão.',
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
      console.log(`🔧 [handleFunctionCall] ========== FUNÇÃO CHAMADA PELA IA ==========`)
      console.log(`   functionName: "${functionName}"`)
      console.log(`   args:`, JSON.stringify(args, null, 2))
      console.log(`   userId: ${userId}`)
      console.log(`   instanceId: ${instanceId}`)
      console.log(`   contactNumber: "${contactNumber}"`)
      console.log(`   userMessage: "${userMessage}"`)
      
      // CRÍTICO: Verifica se a função add_to_cart está sendo chamada
      if (functionName === 'add_to_cart') {
        console.log(`🛒🛒🛒 [handleFunctionCall] ⚠️⚠️⚠️ ADD_TO_CART FOI CHAMADO PELA IA! ⚠️⚠️⚠️`)
        console.log(`   Parâmetros recebidos:`)
        console.log(`     product_id: ${args?.product_id}`)
        console.log(`     product_type: ${args?.product_type}`)
        console.log(`     product_name: ${args?.product_name}`)
        console.log(`     quantity: ${args?.quantity || 1}`)
      }

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

          // CRÍTICO: Validação e correção de hora baseada na mensagem original do cliente
          // Se o cliente disse "2 da tarde" mas a IA enviou "12:00", corrige para "14:00"
          console.log(`🔍 [handleFunctionCall] Verificando correção de hora:`)
          console.log(`   Mensagem original: "${userMessage}"`)
          console.log(`   Hora parseada pela IA: "${args.time}" → ${hour}:${minute}`)
          
          if (userMessage) {
            const userMessageLower = userMessage.toLowerCase()
            
            // Procura por padrões como "2 da tarde", "3 da tarde", "1 da tarde", etc.
            // Melhorado para capturar mais variações: "2 da tarde", "às 2 da tarde", "2 tarde", "para amanha 2 da tarde", etc.
            // CRÍTICO: Procura em qualquer lugar da mensagem, não só no início
            // CRÍTICO: Aceita "1 da tarde", "2 da tarde", etc. (qualquer número de 1 a 11)
            const tardeMatch = userMessageLower.match(/(\d{1,2})\s*(?:da\s*)?tarde/i)
            const noiteMatch = userMessageLower.match(/(\d{1,2})\s*(?:da\s*)?noite/i)
            const manhaMatch = userMessageLower.match(/(\d{1,2})\s*(?:da\s*)?(?:manhã|manha)/i)
            
            console.log(`   🔍 Padrão "tarde" encontrado:`, tardeMatch ? `"${tardeMatch[0]}" (hora: ${tardeMatch[1]})` : 'NÃO ENCONTRADO')
            console.log(`   🔍 Padrão "noite" encontrado:`, noiteMatch ? `"${noiteMatch[0]}" (hora: ${noiteMatch[1]})` : 'NÃO ENCONTRADO')
            console.log(`   🔍 Padrão "manhã" encontrado:`, manhaMatch ? `"${manhaMatch[0]}" (hora: ${manhaMatch[1]})` : 'NÃO ENCONTRADO')
            console.log(`   🔍 Mensagem completa para análise: "${userMessageLower}"`)
            
            if (tardeMatch) {
              const requestedHour = parseInt(tardeMatch[1])
              const expectedHour = requestedHour + 12
              console.log(`   Cliente pediu "${requestedHour} da tarde" → deveria ser ${expectedHour}:00`)
              
              // Se a hora não está correta, corrige SEMPRE
              if (hour !== expectedHour) {
                const oldHour = hour
                hour = expectedHour
                minute = 0
                console.log(`🔧 [handleFunctionCall] ✅ CORREÇÃO APLICADA: "${oldHour}:${minute.toString().padStart(2, '0')}" → "${hour}:00"`)
                console.log(`   Motivo: Cliente pediu "${requestedHour} da tarde" na mensagem original`)
              } else {
                console.log(`   ✅ Hora já está correta: ${hour}:00`)
              }
            } else if (noiteMatch) {
              const requestedHour = parseInt(noiteMatch[1])
              const expectedHour = requestedHour + 12
              if (hour !== expectedHour) {
                const oldHour = hour
                hour = expectedHour
                minute = 0
                console.log(`🔧 [handleFunctionCall] ✅ CORREÇÃO APLICADA: "${oldHour}:${minute.toString().padStart(2, '0')}" → "${hour}:00"`)
                console.log(`   Motivo: Cliente pediu "${requestedHour} da noite" na mensagem original`)
              }
            } else if (manhaMatch) {
              const requestedHour = parseInt(manhaMatch[1])
              if (hour !== requestedHour) {
                const oldHour = hour
                hour = requestedHour
                minute = 0
                console.log(`🔧 [handleFunctionCall] ✅ CORREÇÃO APLICADA: "${oldHour}:${minute.toString().padStart(2, '0')}" → "${hour}:00"`)
                console.log(`   Motivo: Cliente pediu "${requestedHour} da manhã" na mensagem original`)
              }
            } else {
              console.log(`   ⚠️ Nenhum padrão de hora da tarde/manhã/noite encontrado na mensagem`)
            }
          } else {
            console.log(`   ⚠️ userMessage não está disponível para correção`)
          }
          
          console.log(`🕐 [handleFunctionCall] Hora parseada: "${args.time}" → ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)

          // Tenta primeiro parsear como data em português (dias da semana, "amanhã", etc)
          // Mas agora passamos a hora também para parsePortugueseDate considerar
          // CRÍTICO: Se a data é numérica (ex: "08/12/2025"), tenta ambos os formatos ANTES de parsePortugueseDate
          // Isso evita que parsePortugueseDate interprete incorretamente
          let appointmentDateUTC: Date | null = null
          const numericDateMatch = args.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
          
          if (numericDateMatch) {
            const firstPart = parseInt(numericDateMatch[1])
            const secondPart = parseInt(numericDateMatch[2])
            let year = parseInt(numericDateMatch[3])
            
            const nowBrazilian = getBrazilDate()
            const currentYear = nowBrazilian.getFullYear()
            const currentMonth = nowBrazilian.getMonth()
            const currentDay = nowBrazilian.getDate()
            
            // Corrige o ano se necessário
            if (year < currentYear) {
              year = currentYear
            } else if (year > currentYear + 1) {
              year = currentYear
            }
            
            // Tenta ambos os formatos: DD/MM/YYYY e MM/DD/YYYY
            let dateDDMM: Date | null = null
            let dateMMDD: Date | null = null
            
            // Tenta DD/MM/YYYY (formato brasileiro)
            if (firstPart >= 1 && firstPart <= 31 && secondPart >= 1 && secondPart <= 12) {
              dateDDMM = createBrazilianDateAsUTC(year, secondPart - 1, firstPart, hour, minute)
              console.log(`📅 Tentando DD/MM/YYYY: ${firstPart}/${secondPart}/${year}`)
            }
            
            // Tenta MM/DD/YYYY (formato americano)
            if (firstPart >= 1 && firstPart <= 12 && secondPart >= 1 && secondPart <= 31) {
              dateMMDD = createBrazilianDateAsUTC(year, firstPart - 1, secondPart, hour, minute)
              console.log(`📅 Tentando MM/DD/YYYY: ${secondPart}/${firstPart}/${year}`)
            }
            
            // Escolhe o formato que faz mais sentido (não está no passado)
            const todayOnly = new Date(currentYear, currentMonth, currentDay)
            
            if (dateDDMM && dateMMDD) {
              const ddmmOnly = new Date(year, secondPart - 1, firstPart)
              const mmddOnly = new Date(year, firstPart - 1, secondPart)
              
              const ddmmIsPast = ddmmOnly < todayOnly
              const mmddIsPast = mmddOnly < todayOnly
              
              if (!ddmmIsPast && mmddIsPast) {
                appointmentDateUTC = dateDDMM
                console.log(`✅ Escolhido formato DD/MM/YYYY (não está no passado)`)
              } else if (ddmmIsPast && !mmddIsPast) {
                appointmentDateUTC = dateMMDD
                console.log(`✅ Escolhido formato MM/DD/YYYY (não está no passado)`)
              } else if (!ddmmIsPast && !mmddIsPast) {
                // Ambos são futuros, escolhe o mais próximo
                const diffDDMM = Math.abs(ddmmOnly.getTime() - todayOnly.getTime())
                const diffMMDD = Math.abs(mmddOnly.getTime() - todayOnly.getTime())
                if (diffDDMM <= diffMMDD) {
                  appointmentDateUTC = dateDDMM
                  console.log(`✅ Escolhido formato DD/MM/YYYY (mais próximo de hoje)`)
                } else {
                  appointmentDateUTC = dateMMDD
                  console.log(`✅ Escolhido formato MM/DD/YYYY (mais próximo de hoje)`)
                }
              } else {
                // Ambos são passados, padrão para DD/MM/YYYY
                appointmentDateUTC = dateDDMM
                console.log(`⚠️ Ambos formatos são passados, padrão para DD/MM/YYYY`)
              }
            } else if (dateDDMM) {
              appointmentDateUTC = dateDDMM
              console.log(`✅ Usando formato DD/MM/YYYY (único válido)`)
            } else if (dateMMDD) {
              appointmentDateUTC = dateMMDD
              console.log(`✅ Usando formato MM/DD/YYYY (único válido)`)
            }
          }
          
          // Se não conseguiu parsear como numérico, tenta parsePortugueseDate
          if (!appointmentDateUTC) {
            const dateTimeStr = `${args.date} ${args.time}`
            console.log(`📅 [handleFunctionCall] Tentando parsear data: "${dateTimeStr}"`)
            let parsedPortugueseDate = parsePortugueseDate(dateTimeStr)
            console.log(`📅 [handleFunctionCall] Resultado parsePortugueseDate:`, parsedPortugueseDate ? parsedPortugueseDate.toISOString() : 'null')

            // Fallback: se a IA mandou data já convertida (ex: DD/MM) mas o cliente falou em linguagem natural,
            // tenta interpretar a data direto da mensagem original para evitar erros como "próxima segunda = 29/11".
            if (!parsedPortugueseDate && userMessage) {
              console.log(`📅 [handleFunctionCall] Tentando parsear a partir da mensagem original: "${userMessage} ${args.time}"`)
              const parsedFromUserMessage = parsePortugueseDate(`${userMessage} ${args.time}`)
              if (parsedFromUserMessage) {
                parsedPortugueseDate = parsedFromUserMessage
                console.log(`📅 [handleFunctionCall] Data reinterpretada a partir da mensagem original do cliente: "${userMessage}"`)
              }
            }

            if (parsedPortugueseDate) {
            // Se conseguiu parsear como data em português, verifica se está no passado
            // Se estiver, pode ser que o formato esteja errado (ex: IA enviou MM/DD mas parseou como DD/MM)
            const brazilianCheck = utcToBrazilianComponents(parsedPortugueseDate)
            const nowBrazilian = getBrazilDate()
            const currentYear = nowBrazilian.getFullYear()
            const currentMonth = nowBrazilian.getMonth()
            const currentDay = nowBrazilian.getDate()
            const todayOnly = new Date(currentYear, currentMonth, currentDay)
            const parsedDateOnly = new Date(brazilianCheck.year, brazilianCheck.month, brazilianCheck.day)
            
            console.log(`📅 [handleFunctionCall] Verificando data parseada:`)
            console.log(`   Data parseada (Brasil): ${brazilianCheck.day}/${brazilianCheck.month + 1}/${brazilianCheck.year}`)
            console.log(`   Data atual (Brasil): ${currentDay}/${currentMonth + 1}/${currentYear}`)
            console.log(`   Está no passado? ${parsedDateOnly < todayOnly}`)
            console.log(`   É formato numérico? ${!!args.date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)}`)
            
            // Se a data parseada está no passado E a data original parece ser numérica (ex: "12/8/2025"),
            // tenta o formato alternativo
            if (parsedDateOnly < todayOnly && args.date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
              console.log(`⚠️ Data parseada está no passado, tentando formato alternativo...`)
              console.log(`   Data parseada: ${brazilianCheck.day}/${brazilianCheck.month + 1}/${brazilianCheck.year}`)
              console.log(`   Data original: ${args.date}`)
              
              // Tenta formato alternativo (MM/DD se parseou como DD/MM, ou vice-versa)
              const dateMatch = args.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
              if (dateMatch) {
                const firstPart = parseInt(dateMatch[1])
                const secondPart = parseInt(dateMatch[2])
                let year = parseInt(dateMatch[3])
                
                // Corrige o ano se necessário
                if (year < currentYear) {
                  year = currentYear
                } else if (year > currentYear + 1) {
                  year = currentYear
                }
                
                // Tenta formato alternativo (inverte primeiro e segundo)
                if (firstPart >= 1 && firstPart <= 12 && secondPart >= 1 && secondPart <= 31) {
                  // Tenta MM/DD/YYYY (formato alternativo)
                  const alternativeDate = new Date(year, firstPart - 1, secondPart)
                  const alternativeDateOnly = new Date(year, firstPart - 1, secondPart)
                  
                  if (alternativeDateOnly >= todayOnly) {
                    console.log(`✅ Formato alternativo MM/DD/YYYY funciona: ${secondPart}/${firstPart}/${year}`)
                    appointmentDateUTC = createBrazilianDateAsUTC(year, firstPart - 1, secondPart, hour, minute)
                  } else {
                    // Formato alternativo também está no passado, usa o original
                    appointmentDateUTC = parsedPortugueseDate
                    console.log(`⚠️ Formato alternativo também está no passado, usando original`)
                  }
                } else {
                  // Não é um formato válido alternativo, usa o original
                  appointmentDateUTC = parsedPortugueseDate
                }
              } else {
                // Não conseguiu fazer match, usa o original
                appointmentDateUTC = parsedPortugueseDate
              }
            } else {
              // Data não está no passado ou não é formato numérico, usa o parseado
              appointmentDateUTC = parsedPortugueseDate
            }
            
            // CRÍTICO: Se parsePortugueseDate retornou uma data, recria usando a hora CORRIGIDA
            // Isso garante que a correção de hora seja aplicada mesmo quando parsePortugueseDate é usado
            if (appointmentDateUTC) {
              const brazilianComponents = utcToBrazilianComponents(appointmentDateUTC)
              // Recria a data usando a hora CORRIGIDA (hour, minute) em vez da hora parseada por parsePortugueseDate
              appointmentDateUTC = createBrazilianDateAsUTC(
                brazilianComponents.year,
                brazilianComponents.month,
                brazilianComponents.day,
                hour, // Usa a hora CORRIGIDA
                minute // Usa o minuto CORRIGIDO
              )
              console.log(`🔧 [handleFunctionCall] Data recriada com hora CORRIGIDA: ${hour}:${minute.toString().padStart(2, '0')}`)
            }
            
              const finalCheck = utcToBrazilianComponents(appointmentDateUTC)
              console.log(`📅 Data parseada do português (UTC): ${appointmentDateUTC.toISOString()}`)
              console.log(`📅 Data parseada do português (Brasil): ${finalCheck.day}/${finalCheck.month + 1}/${finalCheck.year} às ${finalCheck.hour}:${finalCheck.minute.toString().padStart(2, '0')}`)
            } else {
              // Se parsePortugueseDate retornou null, tenta formato DD/MM/YYYY ou MM/DD/YYYY
              // Detecta automaticamente qual formato usar baseado em qual faz mais sentido
              const dateMatch = args.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
              if (!dateMatch) {
                return {
                  success: false,
                  error: `Data inválida: "${args.date}". Use o formato DD/MM/YYYY (ex: 24/11/2025) ou linguagem natural (ex: "terça-feira", "amanhã").`,
                }
              }

            const firstPart = parseInt(dateMatch[1])
            const secondPart = parseInt(dateMatch[2])
            let year = parseInt(dateMatch[3])

            // Cria a data no horário do Brasil
            const nowBrazilian = getBrazilDate()
            const currentYear = nowBrazilian.getFullYear()
            const currentMonth = nowBrazilian.getMonth()
            const currentDay = nowBrazilian.getDate()

            // Corrige o ano se necessário
            if (year < currentYear) {
              year = currentYear
              console.log(`⚠️ Ano ${year} é menor que o atual (${currentYear}), corrigindo para ${year}`)
            } else if (year > currentYear + 1) {
              year = currentYear
              console.log(`⚠️ Ano ${year} é muito no futuro, corrigindo para ${year}`)
            }

            // Tenta ambos os formatos: DD/MM/YYYY e MM/DD/YYYY
            // Escolhe o formato que faz mais sentido (não está no passado e está mais próximo de hoje)
            let day: number
            let month: number
            let parsedDateDDMM: Date | null = null
            let parsedDateMMDD: Date | null = null

            // Tenta DD/MM/YYYY (formato brasileiro) - primeiro valor é dia, segundo é mês
            if (firstPart >= 1 && firstPart <= 31 && secondPart >= 1 && secondPart <= 12) {
              parsedDateDDMM = new Date(year, secondPart - 1, firstPart)
              console.log(`📅 Tentando DD/MM/YYYY: ${firstPart}/${secondPart}/${year}`)
            }

            // Tenta MM/DD/YYYY (formato americano) - primeiro valor é mês, segundo é dia
            if (firstPart >= 1 && firstPart <= 12 && secondPart >= 1 && secondPart <= 31) {
              parsedDateMMDD = new Date(year, firstPart - 1, secondPart)
              console.log(`📅 Tentando MM/DD/YYYY: ${secondPart}/${firstPart}/${year}`)
            }

            // Escolhe o formato que faz mais sentido
            const todayOnly = new Date(currentYear, currentMonth, currentDay)
            let chosenDate: Date | null = null

            if (parsedDateDDMM && parsedDateMMDD) {
              // Ambos são válidos, escolhe o que não está no passado
              const ddmmIsPast = parsedDateDDMM < todayOnly
              const mmddIsPast = parsedDateMMDD < todayOnly

              if (!ddmmIsPast && mmddIsPast) {
                // DD/MM não está no passado, MM/DD está
                chosenDate = parsedDateDDMM
                day = firstPart
                month = secondPart - 1
                console.log(`✅ Escolhido formato DD/MM/YYYY (não está no passado)`)
              } else if (ddmmIsPast && !mmddIsPast) {
                // MM/DD não está no passado, DD/MM está
                chosenDate = parsedDateMMDD
                day = secondPart
                month = firstPart - 1
                console.log(`✅ Escolhido formato MM/DD/YYYY (não está no passado)`)
              } else if (!ddmmIsPast && !mmddIsPast) {
                // Ambos não estão no passado, escolhe o mais próximo de hoje
                const ddmmDiff = Math.abs(parsedDateDDMM.getTime() - todayOnly.getTime())
                const mmddDiff = Math.abs(parsedDateMMDD.getTime() - todayOnly.getTime())
                if (ddmmDiff <= mmddDiff) {
                  chosenDate = parsedDateDDMM
                  day = firstPart
                  month = secondPart - 1
                  console.log(`✅ Escolhido formato DD/MM/YYYY (mais próximo de hoje)`)
                } else {
                  chosenDate = parsedDateMMDD
                  day = secondPart
                  month = firstPart - 1
                  console.log(`✅ Escolhido formato MM/DD/YYYY (mais próximo de hoje)`)
                }
              } else {
                // Ambos estão no passado, escolhe DD/MM por padrão (formato brasileiro)
                chosenDate = parsedDateDDMM
                day = firstPart
                month = secondPart - 1
                console.log(`⚠️ Ambos formatos estão no passado, usando DD/MM/YYYY por padrão`)
              }
            } else if (parsedDateDDMM) {
              chosenDate = parsedDateDDMM
              day = firstPart
              month = secondPart - 1
              console.log(`✅ Usando formato DD/MM/YYYY (único válido)`)
            } else if (parsedDateMMDD) {
              chosenDate = parsedDateMMDD
              day = secondPart
              month = firstPart - 1
              console.log(`✅ Usando formato MM/DD/YYYY (único válido)`)
            } else {
              return {
                success: false,
                error: `Data inválida: "${args.date}". Use o formato DD/MM/YYYY (ex: 24/11/2025) ou linguagem natural (ex: "terça-feira", "amanhã").`,
              }
            }

              // Cria a data no fuso do Brasil e converte para UTC com a hora correta
              appointmentDateUTC = createBrazilianDateAsUTC(year, month, day, hour, minute)
            }
          }
          
          // Se já parseou mas a hora pode estar errada, recria com a hora correta
          if (appointmentDateUTC) {
            const brazilianComponents = utcToBrazilianComponents(appointmentDateUTC)
            appointmentDateUTC = createBrazilianDateAsUTC(
              brazilianComponents.year,
              brazilianComponents.month,
              brazilianComponents.day,
              hour,
              minute
            )
          }
          
          // Se ainda não conseguiu parsear, retorna erro
          if (!appointmentDateUTC) {
            return {
              success: false,
              error: `Data inválida: "${args.date}". Use o formato DD/MM/YYYY (ex: 24/11/2025) ou linguagem natural (ex: "terça-feira", "amanhã").`,
            }
          }

          // Obtém componentes brasileiros para validação
          const brazilianComponents = utcToBrazilianComponents(appointmentDateUTC)
          let day = brazilianComponents.day
          let month = brazilianComponents.month
          let year = brazilianComponents.year

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
          let appointmentDateOnly = new Date(year, month, day)
          const todayOnly = new Date(currentYear, currentMonth, currentDay)

          // CRÍTICO: Se a data está no passado E a data original é numérica, tenta formato alternativo ANTES de retornar erro
          if (appointmentDateOnly < todayOnly && args.date.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            console.log(`⚠️⚠️⚠️ [handleFunctionCall] Data está no passado, tentando formato alternativo ANTES de retornar erro...`)
            console.log(`   Data parseada: ${day}/${month + 1}/${year}`)
            console.log(`   Data original: ${args.date}`)
            
            const dateMatch = args.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
            if (dateMatch) {
              const firstPart = parseInt(dateMatch[1])
              const secondPart = parseInt(dateMatch[2])
              let altYear = parseInt(dateMatch[3])
              
              // Corrige o ano se necessário
              if (altYear < currentYear) {
                altYear = currentYear
              } else if (altYear > currentYear + 1) {
                altYear = currentYear
              }
              
              // Tenta formato alternativo (MM/DD se parseou como DD/MM)
              if (firstPart >= 1 && firstPart <= 12 && secondPart >= 1 && secondPart <= 31) {
                const alternativeDateOnly = new Date(altYear, firstPart - 1, secondPart)
                
                if (alternativeDateOnly >= todayOnly) {
                  console.log(`✅✅✅ [handleFunctionCall] Formato alternativo MM/DD/YYYY funciona! Corrigindo...`)
                  console.log(`   Formato original (DD/MM): ${day}/${month + 1}/${year} (passado)`)
                  console.log(`   Formato alternativo (MM/DD): ${secondPart}/${firstPart}/${altYear} (futuro)`)
                  
                  // Usa o formato alternativo
                  day = secondPart
                  month = firstPart - 1
                  year = altYear
                  appointmentDateUTC = createBrazilianDateAsUTC(year, month, day, hour, minute)
                  appointmentDateOnly = new Date(year, month, day)
                  
                  // Recalcula componentes para logs
                  const correctedComponents = utcToBrazilianComponents(appointmentDateUTC)
                  console.log(`✅✅✅ [handleFunctionCall] Data corrigida: ${correctedComponents.day}/${correctedComponents.month + 1}/${correctedComponents.year}`)
                }
              }
            }
          }

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
          // CRÍTICO: Usa hour e minute que já foram corrigidos pela lógica de correção acima
          // CRÍTICO: Verifica novamente se a correção foi aplicada antes de formatar
          console.log(`📅 [handleFunctionCall] ANTES da formatação - Verificando hora final:`)
          console.log(`   hour=${hour}, minute=${minute}`)
          console.log(`   args.time original="${args.time}"`)
          console.log(`   userMessage="${userMessage}"`)
          
          const formattedDate = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`
          const formattedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
          console.log(`📅 [handleFunctionCall] Formatação final para agendamento pendente:`)
          console.log(`   Data: ${formattedDate}`)
          console.log(`   Hora: ${formattedTime} (hour=${hour}, minute=${minute})`)
          console.log(`   ✅ HORA CORRIGIDA SERÁ USADA: ${formattedTime}`)

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
        console.log(`🛒 [add_to_cart] ========== FUNÇÃO CHAMADA ==========`)
        console.log(`   functionName: ${functionName}`)
        console.log(`   userId: ${userId}`)
        console.log(`   args:`, JSON.stringify(args, null, 2))
        
        try {
          const { addToCart, getCart } = await import('./cart')

          // CRÍTICO: Normaliza o número ANTES de usar nas funções do carrinho
          const normalizedContactNumber = contactNumber.replace(/\D/g, '')
          
          console.log(`🛒 [add_to_cart] Validação de parâmetros:`)
          console.log(`   product_id: ${args.product_id}`)
          console.log(`   product_type: ${args.product_type}`)
          console.log(`   product_name: ${args.product_name}`)

          if (!args.product_id || !args.product_type || !args.product_name) {
            console.error(`🛒 [add_to_cart] ❌ Parâmetros inválidos!`)
            return {
              success: false,
              error: 'ID, tipo e nome do produto são obrigatórios.',
            }
          }

          // Busca preço do produto
          let unitPrice = 0
          console.log(`🛒 [add_to_cart] Buscando preço para produto:`, {
            product_id: args.product_id,
            product_type: args.product_type,
            product_name: args.product_name,
            userId,
          })
          
          if (args.product_type === 'service') {
            const service = await prisma.service.findFirst({
              where: {
                id: args.product_id,
                userId,
              },
              select: {
                price: true,
                name: true,
              },
            })
            unitPrice = service?.price || 0
            console.log(`🛒 [add_to_cart] Serviço encontrado:`, {
              name: service?.name,
              price: service?.price,
              unitPrice,
            })
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
                unitPrice = typeof nodeData.price === 'number' ? nodeData.price : parseFloat(nodeData.price) || 0
                
                if (unitPrice === 0) {
                  console.warn(`🛒 [add_to_cart] ⚠️ ATENÇÃO: Preço zerado no nodeData para produto ${args.product_name}`)
                  console.warn(`   nodeData.price: ${nodeData.price}, tipo: ${typeof nodeData.price}`)
                  console.warn(`   nodeData completo:`, JSON.stringify(nodeData, null, 2))
                }
                
                console.log(`🛒 [add_to_cart] Produto do catálogo encontrado:`, {
                  nodeData,
                  unitPrice,
                  priceFromData: nodeData.price,
                })
              } catch (error) {
                console.error(`🛒 [add_to_cart] Erro ao fazer parse do nodeData:`, error)
                unitPrice = 0
              }
            } else {
              console.warn(`🛒 [add_to_cart] CatalogNode não encontrado para ID: ${args.product_id}`)
              console.warn(`   Tentando buscar em todos os catálogos do usuário...`)
              
              // Tenta buscar em todos os catálogos do usuário
              const allCatalogs = await prisma.catalog.findMany({
                where: { userId },
                include: {
                  nodes: true,
                },
              })
              
              console.warn(`   Total de catálogos encontrados: ${allCatalogs.length}`)
              
              // Log detalhado de todos os nodes para debug
              for (const catalog of allCatalogs) {
                console.warn(`   📋 Catálogo "${catalog.name}" (ID: ${catalog.id}) tem ${catalog.nodes.length} nodes:`)
                catalog.nodes.forEach((node, idx) => {
                  try {
                    const nodeData = JSON.parse(node.data)
                    console.warn(`      [${idx + 1}] Node ID: ${node.id}, Nome: ${nodeData.name || nodeData.title || 'N/A'}, Preço: R$ ${nodeData.price || 0}`)
                  } catch (e) {
                    console.warn(`      [${idx + 1}] Node ID: ${node.id}, Erro ao parsear data`)
                  }
                })
              }
              
              // Tenta buscar por ID exato
              for (const catalog of allCatalogs) {
                const foundNode = catalog.nodes.find(n => n.id === args.product_id)
                if (foundNode) {
                  console.warn(`   ✅ Node encontrado no catálogo "${catalog.name}" por ID exato`)
                  try {
                    const nodeData = JSON.parse(foundNode.data)
                    unitPrice = typeof nodeData.price === 'number' ? nodeData.price : parseFloat(nodeData.price) || 0
                    console.warn(`   Preço encontrado: R$ ${unitPrice}`)
                    break
                  } catch (e) {
                    console.error(`   Erro ao fazer parse:`, e)
                  }
                }
              }
              
              // Se ainda não encontrou, tenta buscar por nome (case-insensitive)
              if (unitPrice === 0 && args.product_name) {
                console.warn(`   🔍 Tentando buscar por nome: "${args.product_name}"`)
                const searchName = args.product_name.toLowerCase().trim()
                
                // ⚠️ DETECÇÃO DE TERMO GENÉRICO: Verifica se a mensagem original do usuário é genérica
                // (ex: "chaveiro" quando há "Chaveiro Furina" e "Chaveiro Mavuika")
                const userMessageLower = userMessage.toLowerCase().trim()
                
                // Lista de termos genéricos e seus tipos específicos conhecidos
                const genericTerms = {
                  'chaveiro': ['furina', 'mavuika'],
                  'figure': ['furina', 'columbina', 'emilie'],
                  'bolacha': ['nahida', 'emilie'],
                  'figures': ['furina', 'columbina', 'emilie'], // plural
                }
                
                // Verifica se é termo genérico: contém o termo genérico mas NÃO menciona nenhum tipo específico
                let isGenericTerm = false
                for (const [genericTerm, specificTypes] of Object.entries(genericTerms)) {
                  if (userMessageLower.includes(genericTerm)) {
                    // Verifica se menciona algum tipo específico
                    const mentionsSpecificType = specificTypes.some(type => userMessageLower.includes(type))
                    if (!mentionsSpecificType) {
                      isGenericTerm = true
                      break
                    }
                  }
                }
                
                console.warn(`   🔍 Termo genérico detectado na mensagem do usuário: ${isGenericTerm}`)
                console.warn(`   Mensagem original: "${userMessage}"`)
                console.warn(`   Nome passado pela IA: "${args.product_name}"`)
                
                // Coleta TODOS os matches (não apenas o melhor)
                const allMatches: Array<{ node: any; price: number; score: number; name: string }> = []
                
                for (const catalog of allCatalogs) {
                  for (const node of catalog.nodes) {
                    try {
                      const nodeData = JSON.parse(node.data)
                      const nodeName = (nodeData.name || nodeData.title || '').toLowerCase().trim()
                      const nodePrice = typeof nodeData.price === 'number' ? nodeData.price : parseFloat(nodeData.price) || 0
                      
                      // CRÍTICO: Ignora nodes sem nome válido ou com preço zero (provavelmente são categorias)
                      if (!nodeName || nodeName === 'n/a' || nodeName === '' || nodePrice === 0) {
                        continue
                      }
                      
                      // Calcula score de match
                      let score = 0
                      if (nodeName === searchName) {
                        score = 100 // Match exato - maior prioridade
                      } else if (nodeName.includes(searchName)) {
                        score = 80 // Nome contém o termo de busca
                      } else if (searchName.includes(nodeName)) {
                        score = 60 // Termo de busca contém o nome
                      } else {
                        // Match parcial (palavras em comum)
                        const nodeWords = nodeName.split(/\s+/)
                        const searchWords = searchName.split(/\s+/)
                        const commonWords = nodeWords.filter((w: string) => searchWords.includes(w))
                        if (commonWords.length > 0) {
                          score = 40 + (commonWords.length * 10)
                        }
                      }
                      
                      // Adiciona à lista de matches se tiver score > 0 e preço > 0
                      if (score > 0 && nodePrice > 0) {
                        allMatches.push({ 
                          node, 
                          price: nodePrice, 
                          score,
                          name: nodeData.name || nodeData.title || ''
                        })
                        console.warn(`   🎯 Match encontrado: "${nodeData.name || nodeData.title}" (ID: ${node.id}, score: ${score}, preço: R$ ${nodePrice})`)
                      }
                    } catch (e) {
                      // Ignora erros de parse
                    }
                  }
                }
                
                // Ordena matches por score (maior primeiro)
                allMatches.sort((a, b) => b.score - a.score)
                
                // ⚠️ DETECÇÃO DE AMBIGUIDADE: Extrai palavras-chave importantes da busca
                // Remove artigos comuns (da, de, do, a, o, e, etc) para focar nas palavras-chave importantes
                const articles = new Set(['da', 'de', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'e', 'em', 'na', 'no', 'nas', 'nos'])
                const searchWords = searchName.split(/\s+/).filter((w: string) => w.length > 0 && !articles.has(w.toLowerCase()))
                const firstSearchWord = searchWords[0] // Ex: "bolacha", "chaveiro", "figure"
                
                // Filtra matches que contenham TODAS as palavras-chave importantes
                const matchesWithAllKeywords = allMatches.filter(m => {
                  const mNameLower = m.name.toLowerCase()
                  // Verifica se o nome do produto contém TODAS as palavras-chave importantes
                  return searchWords.every((keyword: string) => mNameLower.includes(keyword.toLowerCase()))
                })
                
                // Se houver matches que contenham todas as palavras-chave, prioriza esses
                // Caso contrário, usa a lógica antiga (score >= 60 ou primeira palavra corresponde)
                let relevantMatches: typeof allMatches
                if (matchesWithAllKeywords.length > 0) {
                  // Prioriza matches que contêm todas as palavras-chave
                  relevantMatches = matchesWithAllKeywords
                  console.warn(`   🔍 Encontrados ${matchesWithAllKeywords.length} matches com todas as palavras-chave: ${searchWords.join(', ')}`)
                } else {
                  // Fallback: usa lógica antiga (score >= 60 ou primeira palavra corresponde)
                  relevantMatches = allMatches.filter(m => {
                    const mWords = m.name.toLowerCase().split(/\s+/)
                    const firstMatchWord = mWords[0]
                    
                    // Match relevante se:
                    // - Score >= 60 (match bom)
                    // - OU score >= 50 E primeira palavra corresponde (ex: "bolacha" = "bolacha")
                    return m.score >= 60 || (m.score >= 50 && firstMatchWord === firstSearchWord)
                  })
                }
                
                // Se houver apenas UM match relevante que contenha todas as palavras-chave, usa diretamente (sem ambiguidade)
                if (matchesWithAllKeywords.length === 1) {
                  console.warn(`   ✅ Match único encontrado com todas as palavras-chave: "${matchesWithAllKeywords[0].name}"`)
                  // Não detecta ambiguidade - usa esse match diretamente
                } else if (isGenericTerm && relevantMatches.length > 1) {
                  // Se a mensagem original é genérica E há múltiplas opções relevantes, detecta ambiguidade
                  console.warn(`   ⚠️ AMBIGUIDADE DETECTADA: Mensagem genérica do usuário + múltiplos produtos relevantes encontrados`)
                } else if (relevantMatches.length > 1 && relevantMatches[0].score === relevantMatches[1].score) {
                  // Mesmo se não for termo genérico, se houver empate no score, também detecta ambiguidade
                  console.warn(`   ⚠️ AMBIGUIDADE DETECTADA: Empate no score entre múltiplos produtos`)
                }
                
                // Só detecta ambiguidade se:
                // 1. NÃO há um match único com todas as palavras-chave
                // 2. E (mensagem genérica + múltiplos matches) OU (empate no score)
                if (matchesWithAllKeywords.length !== 1 && ((isGenericTerm && relevantMatches.length > 1) || (relevantMatches.length > 1 && relevantMatches[0].score === relevantMatches[1].score))) {
                  // Há múltiplas opções - retorna erro informando à IA
                  console.warn(`   ⚠️ AMBIGUIDADE DETECTADA: Múltiplos produtos encontrados para "${args.product_name}":`)
                  relevantMatches.forEach(m => {
                    console.warn(`      - ${m.name} (score: ${m.score}, preço: R$ ${m.price})`)
                  })
                  
                  // Monta mensagem visual e simples, similar ao formato do carrinho
                  let optionsMessage = `📦 *Opções Disponíveis:*\n`
                  optionsMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`
                  
                  relevantMatches.forEach((m, i) => {
                    const formattedPrice = m.price > 0 ? m.price.toFixed(2).replace('.', ',') : 'Consulte'
                    optionsMessage += `${i + 1}. *${m.name}*\n`
                    optionsMessage += `   R$ ${formattedPrice}\n\n`
                  })
                  
                  optionsMessage += `━━━━━━━━━━━━━━━━━━━━\n`
                  optionsMessage += `Qual você prefere?`
                  
                  // ⚠️ CRÍTICO: Retorna a mensagem formatada diretamente - a IA deve usar exatamente como está
                  return {
                    success: false,
                    error: optionsMessage,
                  }
                }
                
                // Se há apenas um match ou nenhum, usa o melhor (ou primeiro)
                // Prioriza matches que contenham todas as palavras-chave
                let bestMatch = null
                if (matchesWithAllKeywords.length > 0) {
                  // Se houver matches com todas as palavras-chave, usa o de maior score entre eles
                  bestMatch = matchesWithAllKeywords[0]
                  console.warn(`   ✅ Match encontrado com todas as palavras-chave: "${bestMatch.name}"`)
                } else if (allMatches.length > 0) {
                  // Caso contrário, usa o match de maior score geral
                  bestMatch = allMatches[0]
                  console.warn(`   ✅ Match encontrado (melhor score): "${bestMatch.name}"`)
                }
                
                if (bestMatch && bestMatch.price > 0) {
                  console.warn(`   ✅ Node encontrado por nome: "${bestMatch.node.id}"`)
                  unitPrice = bestMatch.price
                  args.product_id = bestMatch.node.id
                  console.warn(`   Preço encontrado: R$ ${unitPrice}`)
                } else {
                  console.warn(`   ❌ Nenhum node válido encontrado por nome "${args.product_name}"`)
                }
              }
            }
          }

          if (unitPrice === 0) {
            console.warn(`🛒 [add_to_cart] ⚠️ ATENÇÃO: Preço zerado para produto ${args.product_name} (ID: ${args.product_id})`)
          }

          const quantity = args.quantity || 1
          const totalPrice = unitPrice * quantity
          
          console.log(`🛒 [add_to_cart] Preço final:`, {
            unitPrice,
            quantity,
            totalPrice,
          })

          // Log antes de adicionar
          console.log(`🛒 [add_to_cart] ========== ADICIONANDO AO CARRINHO ==========`)
          console.log(`   instanceId: ${instanceId}`)
          console.log(`   contactNumber original: "${contactNumber}"`)
          console.log(`   contactNumber tipo: ${typeof contactNumber}`)
          console.log(`   contactNumber length: ${contactNumber.length}`)
          console.log(`   contactNumber normalizado: "${normalizedContactNumber}"`)
          console.log(`   contactNumber normalizado length: ${normalizedContactNumber.length}`)
          console.log(`   produto: ${args.product_name} (${args.product_id})`)
          console.log(`   quantidade: ${quantity}`)
          console.log(`   preço unitário: R$ ${unitPrice}`)
          
          log.debug('Adicionando ao carrinho', {
            instanceId,
            normalizedContactNumber,
            productId: args.product_id,
            productName: args.product_name,
            quantity,
            unitPrice,
          })

          // Busca carrinho ANTES de adicionar para verificar se o item já existe
          const { getCart: getCartBefore } = await import('./cart')
          const cartBefore = await getCartBefore(instanceId, normalizedContactNumber)
          const existingItem = cartBefore.items.find(
            item => item.productId === args.product_id && item.productType === args.product_type
          )
          const itemExistedBefore = !!existingItem
          const previousQuantity = existingItem ? existingItem.quantity : 0
          
          let cart
          try {
            cart = await addToCart(instanceId, normalizedContactNumber, {
            productId: args.product_id,
            productType: args.product_type as 'service' | 'catalog',
            productName: args.product_name,
            quantity,
            unitPrice,
            notes: args.notes,
          })
            
            console.log(`🛒 [add_to_cart] ✅ Item adicionado com sucesso!`)
            console.log(`   Carrinho agora tem ${cart.items.length} itens`)
            cart.items.forEach((item, i) => {
              console.log(`   [${i + 1}] ${item.productName} x${item.quantity} - R$ ${item.unitPrice}`)
            })
          } catch (error) {
            console.error(`🛒 [add_to_cart] Erro ao adicionar ao carrinho:`, error)
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao adicionar item ao carrinho'
            
            // Retorna mensagem clara para a IA
            return {
              success: false,
              error: `Não foi possível adicionar "${args.product_name}" ao carrinho. ${errorMessage}. Por favor, tente novamente ou informe ao cliente que houve um problema técnico.`,
            }
          }

          // Log após adicionar
          log.debug('Item adicionado com sucesso', {
            instanceId,
            normalizedContactNumber,
            cartItemCount: cart.items.length,
            cartItems: cart.items.map(i => ({
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
            })),
          })

          const itemCount = cart.items.length
          const cartTotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
          
          // Verifica se o item já existia no carrinho (foi atualizado) ou foi adicionado novo
          const addedItem = cart.items.find(
            item => item.productId === args.product_id && item.productType === args.product_type
          )
          // Monta mensagem detalhada e bonita
          let message = ''
          if (itemExistedBefore && addedItem) {
            // Item já existia - quantidade foi atualizada
            message = `✅ Quantidade de *${args.product_name}* atualizada no carrinho!\n\n`
            message += `📦 *Quantidade anterior: ${previousQuantity}x*\n`
            message += `📦 *Quantidade atual: ${addedItem.quantity}x*\n\n`
          } else {
            // Item novo - foi adicionado
            message = `✅ *${args.product_name}* adicionado ao carrinho!\n\n`
          }
          
          message += `📦 *Resumo do Carrinho:*\n`
          message += `━━━━━━━━━━━━━━━━━━━━\n\n`
          
          cart.items.forEach((item, index) => {
            const itemTotal = item.quantity * item.unitPrice
            const formattedUnitPrice = item.unitPrice.toFixed(2).replace('.', ',')
            const formattedItemTotal = itemTotal.toFixed(2).replace('.', ',')
            
            message += `${index + 1}. *${item.productName}*\n`
            message += `   ${item.quantity}x R$ ${formattedUnitPrice} = R$ ${formattedItemTotal}\n`
            if (item.notes) {
              message += `   📝 ${item.notes}\n`
            }
            message += `\n`
          })
          
          message += `━━━━━━━━━━━━━━━━━━━━\n`
          message += `💰 *Total: R$ ${cartTotal.toFixed(2).replace('.', ',')}*\n\n`
          message += `Deseja adicionar mais algo ou finalizar o pedido?`

          const result = {
            success: true,
            message,
            cartItems: itemCount,
            cartTotal,
          }
          
          console.log(`🛒 [add_to_cart] ✅✅✅ SUCESSO! Retornando resultado:`)
          console.log(`   success: ${result.success}`)
          console.log(`   cartItems: ${result.cartItems}`)
          console.log(`   cartTotal: ${result.cartTotal}`)
          console.log(`   message (primeiros 200 chars): ${result.message.substring(0, 200)}...`)
          
          return result
        } catch (error) {
          log.error('Erro ao adicionar ao carrinho', error)
          console.error(`🛒 [add_to_cart] ❌❌❌ ERRO CAPTURADO:`)
          console.error(`   Erro:`, error)
          console.error(`   Stack:`, error instanceof Error ? error.stack : 'N/A')
          
          const errorResult = {
            success: false,
            error: `Erro ao adicionar produto ao carrinho: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          }
          
          console.error(`🛒 [add_to_cart] Retornando erro:`, errorResult)
          return errorResult
        }
      }

      // Função para remover item do carrinho
      if (functionName === 'remove_from_cart' && userId) {
        try {
          const { removeFromCart, getCart, updateCartItemQuantity, getCartTotal } = await import('./cart')

          // CRÍTICO: Normaliza o número ANTES de usar nas funções do carrinho
          const normalizedContactNumber = contactNumber.replace(/\D/g, '')

          console.log(`🛒 [remove_from_cart] ========== REMOVENDO ITEM ==========`)
          console.log(`   Args recebidos:`, JSON.stringify(args, null, 2))
          console.log(`   product_id: ${args.product_id}`)
          console.log(`   product_type: ${args.product_type}`)

          if (!args.product_id || !args.product_type) {
            console.error(`🛒 [remove_from_cart] ❌ Parâmetros inválidos!`)
            return {
              success: false,
              error: 'ID e tipo do produto são obrigatórios para remover.',
            }
          }

          // ⚠️ DETECÇÃO INTELIGENTE: Verifica se o usuário quer reduzir quantidade ou remover completamente
          // Se a mensagem do usuário contém "uma", "um", "reduz", provavelmente quer reduzir, não remover
          console.log(`🛒 [remove_from_cart] 🔍 Verificando se deve reduzir quantidade...`)
          console.log(`   userMessage: "${userMessage}"`)
          console.log(`   product_id recebido: "${args.product_id}"`)
          console.log(`   product_type recebido: "${args.product_type}"`)
          
          let currentItem: any = null
          try {
            const currentCart = await getCart(instanceId, normalizedContactNumber)
            console.log(`   Itens no carrinho: ${currentCart.items.length}`)
            
            // Lista todos os itens para debug
            currentCart.items.forEach((item, i) => {
              console.log(`   [${i + 1}] productId: "${item.productId}", productName: "${item.productName}", productType: "${item.productType}", quantity: ${item.quantity}`)
            })
            
            // Tenta encontrar pelo ID exato primeiro
            currentItem = currentCart.items.find(
              item => item.productId === args.product_id && item.productType === args.product_type
            )
            
            // ⚠️ VALIDAÇÃO: Mesmo se encontrou pelo ID, verifica se o produto corresponde ao que o usuário pediu
            // Extrai palavras-chave da mensagem do usuário para validar
            const userMessageLower = userMessage.toLowerCase()
            const messageWords = userMessageLower.split(/\s+/)
            const productKeywords = ['chaveiro', 'figure', 'figures', 'bolacha', 'columbina', 'furina', 'mavuika', 'nahida', 'emilie']
            const foundKeywords = messageWords.filter(word => 
              productKeywords.some(keyword => word.includes(keyword) || keyword.includes(word))
            )
            
            // Se encontrou pelo ID, valida se o nome do produto corresponde às palavras-chave da mensagem
            if (currentItem && foundKeywords.length > 0) {
              const itemNameLower = currentItem.productName.toLowerCase()
              const hasRelevantKeywords = foundKeywords.some(keyword => itemNameLower.includes(keyword))
              
              // Se o produto encontrado pelo ID não corresponde às palavras-chave, tenta buscar pelo nome
              if (!hasRelevantKeywords) {
                console.log(`   ⚠️ Item encontrado pelo ID "${args.product_id}" não corresponde às palavras-chave da mensagem!`)
                console.log(`   Item encontrado: "${currentItem.productName}"`)
                console.log(`   Palavras-chave da mensagem: ${foundKeywords.join(', ')}`)
                console.log(`   Tentando buscar pelo nome da mensagem...`)
                currentItem = null // Reseta para buscar pelo nome
              }
            }
            
            // Se não encontrou pelo ID ou o ID não corresponde, tenta encontrar pelo nome (busca parcial, case-insensitive)
            if (!currentItem) {
              console.log(`   ⚠️ Item não encontrado pelo ID "${args.product_id}", tentando buscar pelo nome...`)
              
              // Extrai termos da mensagem do usuário para buscar o produto correto
              const userMessageLower = userMessage.toLowerCase()
              const searchTerms: string[] = []
              
              // Adiciona o product_name se existir
              if (args.product_name) {
                searchTerms.push(args.product_name)
              }
              
              // Extrai termos da mensagem do usuário (ex: "tire 4 chaveiros da mavuka" → ["chaveiro", "mavuka"])
              const messageWords = userMessageLower.split(/\s+/)
              const productKeywords = ['chaveiro', 'figure', 'figures', 'bolacha', 'columbina', 'furina', 'mavuika', 'nahida', 'emilie']
              
              // Encontra palavras-chave de produtos na mensagem
              const foundKeywords = messageWords.filter(word => 
                productKeywords.some(keyword => word.includes(keyword) || keyword.includes(word))
              )
              
              // Adiciona combinações relevantes (ex: "chaveiro mavuika", "figure da columbina")
              if (foundKeywords.length > 0) {
                // Adiciona cada palavra-chave encontrada
                foundKeywords.forEach(keyword => searchTerms.push(keyword))
                
                // Se encontrou múltiplas palavras-chave, tenta combinar (ex: "chaveiro" + "mavuika" = "chaveiro mavuika")
                if (foundKeywords.length >= 2) {
                  searchTerms.push(foundKeywords.join(' '))
                }
              }
              
              // Remove duplicatas e valores vazios
              const uniqueSearchTerms = Array.from(new Set(searchTerms)).filter(Boolean)
              console.log(`   🔍 Termos de busca extraídos da mensagem:`, uniqueSearchTerms)
              
              // Prioriza busca por termos que contenham múltiplas palavras-chave (mais específicos)
              // Ordena os termos de busca: primeiro os mais específicos (com mais palavras-chave)
              const sortedSearchTerms = uniqueSearchTerms.sort((a, b) => {
                const aWords = a.toLowerCase().split(/\s+/).filter(w => 
                  productKeywords.some(kw => w.includes(kw) || kw.includes(w))
                ).length
                const bWords = b.toLowerCase().split(/\s+/).filter(w => 
                  productKeywords.some(kw => w.includes(kw) || kw.includes(w))
                ).length
                return bWords - aWords // Mais palavras-chave primeiro
              })
              
              console.log(`   🔍 Termos ordenados por especificidade:`, sortedSearchTerms)
              
              for (const searchTerm of sortedSearchTerms) {
                if (!searchTerm) continue
                
                const productNameLower = searchTerm.toLowerCase().trim()
                const searchWords = productNameLower.split(/\s+/)
                console.log(`   🔍 Tentando buscar por: "${productNameLower}"`)
                
                // Extrai palavras-chave do termo de busca
                const mainKeywords = searchWords.filter(word => 
                  productKeywords.some(kw => word.includes(kw) || kw.includes(word))
                )
                
                // PRIORIDADE 1: Match exato
                currentItem = currentCart.items.find(
                  item => item.productName.toLowerCase().trim() === productNameLower &&
                          item.productType === args.product_type
                )
                
                // PRIORIDADE 2: Match parcial (nome do produto contém o termo completo)
                if (!currentItem) {
                  currentItem = currentCart.items.find(
                    item => item.productName.toLowerCase().includes(productNameLower) &&
                            item.productType === args.product_type
                  )
                }
                
                // PRIORIDADE 3: Match por TODAS as palavras-chave (mais específico)
                if (!currentItem && mainKeywords.length >= 2) {
                  currentItem = currentCart.items.find(item => {
                    const itemNameLower = item.productName.toLowerCase()
                    const hasAllKeywords = mainKeywords.every(keyword => 
                      itemNameLower.includes(keyword)
                    )
                    return hasAllKeywords && item.productType === args.product_type
                  })
                  if (currentItem) {
                    console.log(`   ✅ Match por todas as palavras-chave: ${mainKeywords.join(', ')}`)
                  }
                }
                
                // PRIORIDADE 4: Match por palavras-chave individuais (menos específico)
                if (!currentItem && mainKeywords.length > 0) {
                  // Tenta encontrar produto que contenha pelo menos uma palavra-chave
                  // Mas prioriza produtos que contenham palavras-chave mais específicas (nomes próprios)
                  const specificKeywords = mainKeywords.filter(kw => 
                    ['mavuika', 'furina', 'columbina', 'nahida', 'emilie'].some(sk => kw.includes(sk))
                  )
                  
                  if (specificKeywords.length > 0) {
                    // Prioriza matches com palavras-chave específicas
                    currentItem = currentCart.items.find(item => {
                      const itemNameLower = item.productName.toLowerCase()
                      return specificKeywords.some(keyword => itemNameLower.includes(keyword)) &&
                             item.productType === args.product_type
                    })
                  }
                  
                  if (!currentItem) {
                    // Fallback: qualquer palavra-chave
                    currentItem = currentCart.items.find(item => {
                      const itemNameLower = item.productName.toLowerCase()
                      return mainKeywords.some(keyword => itemNameLower.includes(keyword)) &&
                             item.productType === args.product_type
                    })
                  }
                }
                
                if (currentItem) {
                  console.log(`   ✅ Item encontrado pelo nome "${searchTerm}"! Atualizando product_id de "${args.product_id}" para "${currentItem.productId}"`)
                  console.log(`   Item encontrado: ${currentItem.productName} (quantidade: ${currentItem.quantity})`)
                  args.product_id = currentItem.productId
                  break
                }
              }
            }
            
            console.log(`   Item encontrado:`, currentItem ? {
              productId: currentItem.productId,
              productName: currentItem.productName,
              quantity: currentItem.quantity,
            } : 'NÃO ENCONTRADO')
          } catch (detectionError) {
            console.error(`🛒 [remove_from_cart] ❌ Erro na detecção:`, detectionError)
            // Continua com remoção normal se houver erro na detecção
          }

          if (currentItem && currentItem.quantity > 0) {
            // Item existe
            // Verifica contexto da mensagem do usuário para decidir se reduz ou remove completamente
            const userMessageLower = userMessage.toLowerCase()
            console.log(`   userMessageLower: "${userMessageLower}"`)
            
            // Extrai números da mensagem (ex: "tire 4 chaveiros" → 4)
            const numbersInMessage = userMessageLower.match(/\d+/g)
            const quantityToRemove = numbersInMessage ? parseInt(numbersInMessage[0]) : null
            console.log(`   Quantidade mencionada na mensagem: ${quantityToRemove}`)
            
            // ⚠️ PRIMEIRO: Detecta se o usuário quer DEFINIR quantidade para um valor específico
            // Ex: "quero apenas uma", "quero só uma", "deixa só uma", "mantém apenas uma"
            const wantsToSetQuantity = 
              /(quero|deixa|mantém|deixar|manter)\s+(apenas|só|somente)\s+(uma|um)\b/.test(userMessageLower) ||
              /(quero|deixa|mantém|deixar|manter)\s+(uma|um)\s+(apenas|só|somente)\b/.test(userMessageLower) ||
              /\b(apenas|só|somente)\s+(uma|um)\b/.test(userMessageLower) ||
              /\b(uma|um)\s+(apenas|só|somente)\b/.test(userMessageLower)
            
            // Detecta se o usuário quer REDUZIR uma quantidade específica
            // Ex: "tire 4 chaveiros", "remove 2 figures", "tira 3 bolachas"
            const wantsToReduceQuantity = quantityToRemove !== null && quantityToRemove > 0 && quantityToRemove < currentItem.quantity &&
              (userMessageLower.includes('tire') || userMessageLower.includes('remove') || userMessageLower.includes('tira') || 
               userMessageLower.includes('reduz') || userMessageLower.includes('menos'))
            
            if (wantsToReduceQuantity) {
              // Usuário quer REDUZIR uma quantidade específica (ex: "tire 4 chaveiros" quando tem 6)
              console.log(`🛒 [remove_from_cart] ⚠️ Detectado: usuário quer REDUZIR ${quantityToRemove} unidades (tem ${currentItem.quantity}, reduzindo para ${currentItem.quantity - quantityToRemove})`)
              
              const newQuantity = currentItem.quantity - quantityToRemove
              
              if (newQuantity <= 0) {
                // Se a nova quantidade seria 0 ou negativa, remove completamente
                console.log(`🛒 [remove_from_cart] Nova quantidade seria ${newQuantity}, removendo completamente.`)
                // Continua com remoção completa abaixo
              } else {
                // Reduz a quantidade
                console.log(`🛒 [remove_from_cart] Redirecionando para update_cart_item_quantity com quantity: ${newQuantity}...`)
                
                const cart = await updateCartItemQuantity(
                  instanceId,
                  normalizedContactNumber,
                  args.product_id,
                  args.product_type as 'service' | 'catalog',
                  newQuantity
                )
                
                const itemCount = cart.items.length
                const cartTotal = getCartTotal(cart)
                
                const updatedItem = cart.items.find(
                  item => item.productId === args.product_id && item.productType === args.product_type
                )
                
                let message = `✅ Quantidade reduzida!\n\n`
                if (updatedItem) {
                  message += `📦 *${updatedItem.productName}*\n`
                  message += ` Quantidade: ${updatedItem.quantity}x (reduzida de ${currentItem.quantity})\n`
                  message += ` Preço unitário: R$ ${updatedItem.unitPrice.toFixed(2).replace('.', ',')}\n`
                  message += ` Subtotal: R$ ${(updatedItem.quantity * updatedItem.unitPrice).toFixed(2).replace('.', ',')}\n\n`
                }
                
                message += `📦 *Carrinho Atualizado:*\n`
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`
                
                cart.items.forEach((item, index) => {
                  const itemTotal = item.quantity * item.unitPrice
                  message += `${index + 1}. *${item.productName}*\n`
                  message += `   ${item.quantity}x R$ ${item.unitPrice.toFixed(2).replace('.', ',')} = R$ ${itemTotal.toFixed(2).replace('.', ',')}\n\n`
                })
                
                message += `━━━━━━━━━━━━━━━━━━━━\n`
                message += `💰 *Total: R$ ${cartTotal.toFixed(2).replace('.', ',')}*\n\n`
                message += `Deseja adicionar mais algo ou finalizar o pedido?`
                
                return {
                  success: true,
                  message,
                  cartItems: itemCount,
                  cartTotal,
                }
              }
            } else if (wantsToSetQuantity) {
              // Usuário quer DEFINIR quantidade para 1, não apenas reduzir
              console.log(`🛒 [remove_from_cart] ⚠️ Detectado: usuário quer DEFINIR quantidade para 1 (tem ${currentItem.quantity})`)
              console.log(`🛒 [remove_from_cart] Redirecionando para update_cart_item_quantity com quantity=1...`)
              
              // Redireciona para update_cart_item_quantity com quantidade = 1
              const cart = await updateCartItemQuantity(
                instanceId,
                normalizedContactNumber,
                args.product_id,
                args.product_type as 'service' | 'catalog',
                1 // Define para 1 diretamente
              )

              const itemCount = cart.items.length
              const cartTotal = getCartTotal(cart)

              const updatedItem = cart.items.find(
                item => item.productId === args.product_id && item.productType === args.product_type
              )

              let message = `✅ Quantidade ajustada para 1!\n\n`
              if (updatedItem) {
                const itemTotal = updatedItem.quantity * updatedItem.unitPrice
                const formattedUnitPrice = updatedItem.unitPrice.toFixed(2).replace('.', ',')
                const formattedItemTotal = itemTotal.toFixed(2).replace('.', ',')
                message += `📦 *${updatedItem.productName}*\n`
                message += `   Quantidade: ${updatedItem.quantity}x (ajustada de ${currentItem.quantity})\n`
                message += `   Preço unitário: R$ ${formattedUnitPrice}\n`
                message += `   Subtotal: R$ ${formattedItemTotal}\n\n`
              }

              message += `📦 *Carrinho Atualizado:*\n`
              message += `━━━━━━━━━━━━━━━━━━━━\n\n`

              cart.items.forEach((item, index) => {
                const itemTotal = item.quantity * item.unitPrice
                const formattedUnitPrice = item.unitPrice.toFixed(2).replace('.', ',')
                const formattedItemTotal = itemTotal.toFixed(2).replace('.', ',')

                message += `${index + 1}. *${item.productName}*\n`
                message += `   ${item.quantity}x R$ ${formattedUnitPrice} = R$ ${formattedItemTotal}\n\n`
              })

              message += `━━━━━━━━━━━━━━━━━━━━\n`
              message += `💰 *Total: R$ ${cartTotal.toFixed(2).replace('.', ',')}*\n\n`
              message += `Deseja adicionar mais algo ou finalizar o pedido?`

              return {
                success: true,
                message,
                cartItems: itemCount,
                cartTotal,
              }
            }
            
            // Detecção mais robusta: verifica "uma" com ou sem espaço, no início, meio ou fim da palavra
            const wantsToReduce = 
              /uma\s/.test(userMessageLower) ||           // "uma " com espaço
              /\buma\b/.test(userMessageLower) ||         // "uma" como palavra completa
              /um\s/.test(userMessageLower) ||             // "um " com espaço
              /\bum\b/.test(userMessageLower) ||          // "um" como palavra completa
              userMessageLower.includes('reduz') ||
              userMessageLower.includes('tira uma') ||
              userMessageLower.includes('remove uma') ||
              userMessageLower.includes('tira um') ||
              userMessageLower.includes('remove um') ||
              userMessageLower.includes('menos uma') ||
              userMessageLower.includes('menos um')
            
            console.log(`   wantsToReduce: ${wantsToReduce}`)
            console.log(`   Verificações:`, {
              'uma ': userMessageLower.includes('uma '),
              'um ': userMessageLower.includes('um '),
              'reduz': userMessageLower.includes('reduz'),
              'tira uma': userMessageLower.includes('tira uma'),
              'remove uma': userMessageLower.includes('remove uma'),
            })

            if (wantsToReduce) {
              // Usuário quer REDUZIR quantidade em 1, não remover completamente
              console.log(`🛒 [remove_from_cart] ⚠️ Detectado: usuário quer REDUZIR quantidade (tem ${currentItem.quantity}, reduzindo para ${currentItem.quantity - 1})`)
              console.log(`🛒 [remove_from_cart] Redirecionando para update_cart_item_quantity...`)
              
              // Redireciona para update_cart_item_quantity
              const newQuantity = currentItem.quantity - 1
              const cart = await updateCartItemQuantity(
                instanceId,
                normalizedContactNumber,
                args.product_id,
                args.product_type as 'service' | 'catalog',
                newQuantity
              )

              const itemCount = cart.items.length
              const cartTotal = getCartTotal(cart)

              const updatedItem = cart.items.find(
                item => item.productId === args.product_id && item.productType === args.product_type
              )

              let message = `✅ Quantidade reduzida!\n\n`
              if (updatedItem) {
                const itemTotal = updatedItem.quantity * updatedItem.unitPrice
                const formattedUnitPrice = updatedItem.unitPrice.toFixed(2).replace('.', ',')
                const formattedItemTotal = itemTotal.toFixed(2).replace('.', ',')
                message += `📦 *${updatedItem.productName}*\n`
                message += `   Quantidade: ${updatedItem.quantity}x (reduzida de ${currentItem.quantity})\n`
                message += `   Preço unitário: R$ ${formattedUnitPrice}\n`
                message += `   Subtotal: R$ ${formattedItemTotal}\n\n`
              }

              message += `📦 *Carrinho Atualizado:*\n`
              message += `━━━━━━━━━━━━━━━━━━━━\n\n`

              cart.items.forEach((item, index) => {
                const itemTotal = item.quantity * item.unitPrice
                const formattedUnitPrice = item.unitPrice.toFixed(2).replace('.', ',')
                const formattedItemTotal = itemTotal.toFixed(2).replace('.', ',')

                message += `${index + 1}. *${item.productName}*\n`
                message += `   ${item.quantity}x R$ ${formattedUnitPrice} = R$ ${formattedItemTotal}\n\n`
              })

              message += `━━━━━━━━━━━━━━━━━━━━\n`
              message += `💰 *Total: R$ ${cartTotal.toFixed(2).replace('.', ',')}*\n\n`
              message += `Deseja adicionar mais algo ou finalizar o pedido?`

              return {
                success: true,
                message,
                cartItems: itemCount,
                cartTotal,
              }
            }
          }

          // Remove completamente (comportamento original)
          console.log(`🛒 [remove_from_cart] Removendo item completamente:`, {
            product_id: args.product_id,
            product_type: args.product_type,
          })

          const cart = await removeFromCart(
            instanceId,
            normalizedContactNumber,
            args.product_id,
            args.product_type as 'service' | 'catalog'
          )

          const itemCount = cart.items.length
          const cartTotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

          if (itemCount === 0) {
            return {
              success: true,
              message: '✅ Item removido do carrinho.\n\n🛒 Seu carrinho está vazio agora.',
              cartItems: 0,
              cartTotal: 0,
            }
          }

          let message = `✅ Item removido do carrinho!\n\n`
          message += `📦 *Carrinho Atualizado:*\n`
          message += `━━━━━━━━━━━━━━━━━━━━\n\n`

          cart.items.forEach((item, index) => {
            const itemTotal = item.quantity * item.unitPrice
            const formattedUnitPrice = item.unitPrice.toFixed(2).replace('.', ',')
            const formattedItemTotal = itemTotal.toFixed(2).replace('.', ',')

            message += `${index + 1}. *${item.productName}*\n`
            message += `   ${item.quantity}x R$ ${formattedUnitPrice} = R$ ${formattedItemTotal}\n\n`
          })

          message += `━━━━━━━━━━━━━━━━━━━━\n`
          message += `💰 *Total: R$ ${cartTotal.toFixed(2).replace('.', ',')}*\n\n`
          message += `Deseja adicionar mais algo ou finalizar o pedido?`

          return {
            success: true,
            message,
            cartItems: itemCount,
            cartTotal,
          }
        } catch (error) {
          log.error('Erro ao remover do carrinho', error)
          console.error('Erro detalhado ao remover do carrinho:', error)
          return {
            success: false,
            error: `Erro ao remover item do carrinho: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          }
        }
      }

      // Função para atualizar quantidade de um item no carrinho
      if (functionName === 'update_cart_item_quantity' && userId) {
        try {
          const { updateCartItemQuantity, getCart, getCartTotal } = await import('./cart')

          // CRÍTICO: Normaliza o número ANTES de usar nas funções do carrinho
          const normalizedContactNumber = contactNumber.replace(/\D/g, '')

          console.log(`🛒 [update_cart_item_quantity] ========== ATUALIZANDO QUANTIDADE ==========`)
          console.log(`   Args recebidos:`, JSON.stringify(args, null, 2))
          console.log(`   product_id: ${args.product_id}`)
          console.log(`   product_type: ${args.product_type}`)
          console.log(`   quantity: ${args.quantity}`)

          if (!args.product_id || !args.product_type) {
            return {
              success: false,
              error: 'ID e tipo do produto são obrigatórios.',
            }
          }

          // Busca o item no carrinho (pode ser pelo ID ou pelo nome)
          const currentCart = await getCart(instanceId, normalizedContactNumber)
          console.log(`   Itens no carrinho: ${currentCart.items.length}`)
          
          // Lista todos os itens para debug
          currentCart.items.forEach((item, i) => {
            console.log(`   [${i + 1}] productId: "${item.productId}", productName: "${item.productName}", productType: "${item.productType}", quantity: ${item.quantity}`)
          })
          
          // Tenta encontrar pelo ID exato primeiro
          let currentItem = currentCart.items.find(
            item => item.productId === args.product_id && item.productType === args.product_type
          )
          
          // Se não encontrou pelo ID, tenta encontrar pelo nome (busca parcial, case-insensitive)
          if (!currentItem) {
            console.log(`   ⚠️ Item não encontrado pelo ID "${args.product_id}", tentando buscar pelo nome...`)
            
            // Tenta extrair o nome do produto da mensagem do usuário ou dos args
            const searchTerms = [
              args.product_name,
              'columbina',
              'figure',
              'figure da columbina',
            ].filter(Boolean)
            
            for (const searchTerm of searchTerms) {
              if (!searchTerm) continue
              
              const productNameLower = searchTerm.toLowerCase().trim()
              console.log(`   🔍 Tentando buscar por: "${productNameLower}"`)
              
              // Tenta match exato primeiro
              currentItem = currentCart.items.find(
                item => item.productName.toLowerCase().trim() === productNameLower &&
                        item.productType === args.product_type
              )
              
              // Se não encontrou, tenta match parcial
              if (!currentItem) {
                currentItem = currentCart.items.find(
                  item => item.productName.toLowerCase().includes(productNameLower) &&
                          item.productType === args.product_type
                )
              }
              
              // Se ainda não encontrou, tenta match reverso (nome do produto contém o termo de busca)
              if (!currentItem) {
                currentItem = currentCart.items.find(
                  item => productNameLower.includes(item.productName.toLowerCase()) &&
                          item.productType === args.product_type
                )
              }
              
              if (currentItem) {
                console.log(`   ✅ Item encontrado pelo nome "${searchTerm}"! Atualizando product_id de "${args.product_id}" para "${currentItem.productId}"`)
                args.product_id = currentItem.productId
                break
              }
            }
          }
          
          if (!currentItem) {
            return {
              success: false,
              error: `Item não encontrado no carrinho. Verifique se o produto está no carrinho.`,
            }
          }
          
          console.log(`   Item encontrado:`, {
            productId: currentItem.productId,
            productName: currentItem.productName,
            quantity: currentItem.quantity,
          })

          // Se quantity não foi fornecida, busca a quantidade atual e reduz 1
          let targetQuantity = args.quantity
          if (typeof targetQuantity !== 'number' || isNaN(targetQuantity)) {
            console.log(`🛒 [update_cart_item_quantity] Quantidade não fornecida, reduzindo 1 da quantidade atual...`)
            // Reduz 1 da quantidade atual
            targetQuantity = Math.max(0, currentItem.quantity - 1)
            console.log(`🛒 [update_cart_item_quantity] Quantidade atual: ${currentItem.quantity}, nova quantidade: ${targetQuantity}`)
          }

          if (targetQuantity < 0) {
            return {
              success: false,
              error: 'Quantidade deve ser >= 0.',
            }
          }

          console.log(`🛒 [update_cart_item_quantity] Atualizando quantidade:`, {
            product_id: args.product_id,
            product_type: args.product_type,
            new_quantity: targetQuantity,
          })

          const cart = await updateCartItemQuantity(
            instanceId,
            normalizedContactNumber,
            args.product_id,
            args.product_type as 'service' | 'catalog',
            targetQuantity
          )

          const itemCount = cart.items.length
          const cartTotal = getCartTotal(cart)

          if (args.quantity === 0) {
            return {
              success: true,
              message: '✅ Item removido do carrinho (quantidade ajustada para 0).',
              cartItems: itemCount,
              cartTotal,
            }
          }

          const updatedItem = cart.items.find(
            item => item.productId === args.product_id && item.productType === args.product_type
          )

          let message = `✅ Quantidade atualizada!\n\n`
          if (updatedItem) {
            const itemTotal = updatedItem.quantity * updatedItem.unitPrice
            const formattedUnitPrice = updatedItem.unitPrice.toFixed(2).replace('.', ',')
            const formattedItemTotal = itemTotal.toFixed(2).replace('.', ',')
            message += `📦 *${updatedItem.productName}*\n`
            message += `   Quantidade: ${updatedItem.quantity}x\n`
            message += `   Preço unitário: R$ ${formattedUnitPrice}\n`
            message += `   Subtotal: R$ ${formattedItemTotal}\n\n`
          }

          message += `📦 *Carrinho Atualizado:*\n`
          message += `━━━━━━━━━━━━━━━━━━━━\n\n`

          cart.items.forEach((item, index) => {
            const itemTotal = item.quantity * item.unitPrice
            const formattedUnitPrice = item.unitPrice.toFixed(2).replace('.', ',')
            const formattedItemTotal = itemTotal.toFixed(2).replace('.', ',')

            message += `${index + 1}. *${item.productName}*\n`
            message += `   ${item.quantity}x R$ ${formattedUnitPrice} = R$ ${formattedItemTotal}\n\n`
          })

          message += `━━━━━━━━━━━━━━━━━━━━\n`
          message += `💰 *Total: R$ ${cartTotal.toFixed(2).replace('.', ',')}*\n\n`
          message += `Deseja adicionar mais algo ou finalizar o pedido?`

          return {
            success: true,
            message,
            cartItems: itemCount,
            cartTotal,
          }
        } catch (error) {
          log.error('Erro ao atualizar quantidade no carrinho', error)
          console.error('Erro detalhado ao atualizar quantidade:', error)
          return {
            success: false,
            error: `Erro ao atualizar quantidade: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          }
        }
      }

      // Função para limpar carrinho
      if (functionName === 'clear_cart' && userId) {
        try {
          const { clearCart } = await import('./cart')

          // CRÍTICO: Normaliza o número ANTES de usar nas funções do carrinho
          const normalizedContactNumber = contactNumber.replace(/\D/g, '')

          console.log(`🛒 [clear_cart] Limpando carrinho`)

          await clearCart(instanceId, normalizedContactNumber)

          return {
            success: true,
            message: '✅ Carrinho cancelado com sucesso.\n\nSeu carrinho foi limpo. Se quiser fazer um novo pedido, é só me avisar!',
            cartItems: 0,
            cartTotal: 0,
          }
        } catch (error) {
          log.error('Erro ao limpar carrinho', error)
          console.error('Erro detalhado ao limpar carrinho:', error)
          return {
            success: false,
            error: `Erro ao cancelar carrinho: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
          }
        }
      }

      // Função para visualizar carrinho
      if (functionName === 'view_cart' && userId) {
        try {
          const { getCart, getCartTotal } = await import('./cart')

          // CRÍTICO: Normaliza o número ANTES de usar nas funções do carrinho
          const normalizedContactNumber = contactNumber.replace(/\D/g, '')
          
          console.log(`🛒 [view_cart] ========== VISUALIZANDO CARRINHO ==========`)
          console.log(`   instanceId: ${instanceId}`)
          console.log(`   contactNumber original: "${contactNumber}"`)
          console.log(`   contactNumber tipo: ${typeof contactNumber}`)
          console.log(`   contactNumber length: ${contactNumber.length}`)
          console.log(`   contactNumber normalizado: "${normalizedContactNumber}"`)
          console.log(`   contactNumber normalizado length: ${normalizedContactNumber.length}`)

          const cart = await getCart(instanceId, normalizedContactNumber)
          
          console.log(`🛒 [view_cart] Carrinho retornado:`, {
            itemCount: cart.items.length,
            items: cart.items.map(i => ({
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
            })),
          })

          if (cart.items.length === 0) {
            return {
              success: true,
              message: '🛒 Seu carrinho está vazio.\n\nAdicione produtos ou serviços para começar seu pedido!',
              cartItems: 0,
              cartTotal: 0,
            }
          }

          const total = getCartTotal(cart)
          
          // Monta mensagem detalhada e bonita do carrinho
          let message = `🛒 *Seu Carrinho de Compras*\n`
          message += `━━━━━━━━━━━━━━━━━━━━\n\n`
          
          if (cart.items.length === 0) {
            message += `Seu carrinho está vazio.\n\n`
            message += `Adicione produtos ou serviços para começar seu pedido!`
          } else {
            message += `📦 *Itens no Carrinho:*\n\n`
            
            cart.items.forEach((item, index) => {
              const itemTotal = item.quantity * item.unitPrice
              const formattedUnitPrice = item.unitPrice.toFixed(2).replace('.', ',')
              const formattedItemTotal = itemTotal.toFixed(2).replace('.', ',')
              
              message += `${index + 1}. *${item.productName}*\n`
              message += `   Quantidade: ${item.quantity}x\n`
              message += `   Preço unitário: R$ ${formattedUnitPrice}\n`
              message += `   Subtotal: R$ ${formattedItemTotal}\n`
              if (item.notes) {
                message += `   📝 Observação: ${item.notes}\n`
              }
              message += `\n`
            })
            
            message += `━━━━━━━━━━━━━━━━━━━━\n`
            message += `💰 *Total do Pedido: R$ ${total.toFixed(2).replace('.', ',')}*\n\n`
            message += `Deseja adicionar mais algo ou finalizar o pedido?`
          }

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

          // CRÍTICO: Normaliza o número ANTES de usar nas funções do carrinho
          const normalizedContactNumber = contactNumber.replace(/\D/g, '')

          // Log antes de buscar carrinho
          console.log(`🛒 [checkout] ========== INICIANDO CHECKOUT ==========`)
          console.log(`   instanceId: ${instanceId}`)
          console.log(`   contactNumber original: "${contactNumber}"`)
          console.log(`   contactNumber normalizado: "${normalizedContactNumber}"`)
          
          log.debug('Buscando carrinho para checkout', {
            instanceId,
            originalContactNumber: contactNumber,
            normalizedContactNumber,
          })

          const cart = await getCart(instanceId, normalizedContactNumber)

          // Log do carrinho encontrado
          console.log(`🛒 [checkout] Carrinho encontrado:`, {
            itemCount: cart.items.length,
            items: cart.items.map(i => ({
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          })
          
          log.debug('Carrinho encontrado no checkout', {
            instanceId,
            normalizedContactNumber,
            itemCount: cart.items.length,
            items: cart.items.map(i => ({
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
            })),
          })

          if (cart.items.length === 0) {
            console.error(`🛒 [checkout] ❌❌❌ CARRINHO VAZIO NO CHECKOUT! ❌❌❌`)
            console.error(`   Isso não deveria acontecer se o usuário acabou de ver o carrinho com itens!`)
            console.error(`   Verificando se há carrinho com número diferente...`)
            
            // Tenta buscar todos os carrinhos para este contato (debug)
            try {
              const allCarts = await prisma.cart.findMany({
                where: { instanceId },
                include: { items: true },
              })
              console.error(`   Total de carrinhos para esta instância: ${allCarts.length}`)
              allCarts.forEach((c, i) => {
                const cNormalized = c.contactNumber.replace(/\D/g, '')
                const matches = cNormalized === normalizedContactNumber || c.contactNumber === normalizedContactNumber
                console.error(`   [${i + 1}] contactNumber: "${c.contactNumber}" (normalizado: "${cNormalized}") ${matches ? '✅ CORRESPONDE!' : '❌'} | Itens: ${c.items.length} | Esperado: "${normalizedContactNumber}"`)
              })
            } catch (debugError) {
              console.error(`   Erro ao buscar carrinhos para debug:`, debugError)
            }
            
            return {
              success: false,
              error: 'Seu carrinho está vazio. Adicione produtos antes de finalizar o pedido.',
            }
          }

          // Verifica opções de entrega/retirada disponíveis para os produtos
          let allowsDelivery = false
          let allowsPickup = false
          
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
              
              if (service) {
                if (service.deliveryAvailable) allowsDelivery = true
                if (service.pickupAvailable) allowsPickup = true
              }
            } else {
              // Para produtos do catálogo, assume que permite ambos por padrão
              allowsDelivery = true
              allowsPickup = true
            }
          }
          
          // Se nenhum produto permite entrega, força pickup
          if (!allowsDelivery) {
            allowsPickup = true
          }
          
          // Se nenhum produto permite pickup, força delivery
          if (!allowsPickup) {
            allowsDelivery = true
          }
          
          // Se não especificou tipo de entrega, pergunta ao usuário
          let deliveryType = args.delivery_type as 'pickup' | 'delivery' | undefined
          let deliveryAddress = args.delivery_address || undefined
          
          console.log(`🛒 [checkout] Opções disponíveis:`, {
            allowsDelivery,
            allowsPickup,
            deliveryType: args.delivery_type,
          })
          
          // Se não especificou e ambos estão disponíveis, precisa perguntar
          if (!deliveryType && allowsDelivery && allowsPickup) {
            return {
              success: false,
              error: 'Por favor, escolha o tipo de entrega:\n\n🏪 Digite "retirada" para retirar no estabelecimento\n🚚 Digite "entrega" para receber em casa (será necessário informar o endereço)',
              requiresDeliveryType: true,
            }
          }
          
          // Se não especificou mas só uma opção disponível, usa ela
          if (!deliveryType) {
            if (allowsPickup && !allowsDelivery) {
              deliveryType = 'pickup'
            } else if (allowsDelivery && !allowsPickup) {
              deliveryType = 'delivery'
            } else {
              deliveryType = 'pickup' // Padrão
            }
          }
          
          // Valida tipo de entrega
          if (deliveryType === 'delivery' && !allowsDelivery) {
            return {
              success: false,
              error: 'Nenhum dos produtos no carrinho permite entrega. Por favor, escolha retirada no estabelecimento.',
            }
          }
          
          if (deliveryType === 'pickup' && !allowsPickup) {
            return {
              success: false,
              error: 'Nenhum dos produtos no carrinho permite retirada. Por favor, escolha entrega.',
            }
          }
          
          if (deliveryType === 'delivery' && !deliveryAddress) {
            // Verifica se o usuário está confirmando uso de endereço anterior
            const userMessageLower = userMessage.toLowerCase().trim()
            const confirmPatterns = [
              /usar\s+(este|esse|o\s+mesmo|o\s+endereço\s+anterior)/i,
              /mesmo\s+endereço/i,
              /endereço\s+anterior/i,
              /pode\s+usar/i,
              /usa\s+(esse|este)/i,
            ]
            
            const isConfirmingPrevious = confirmPatterns.some(pattern => pattern.test(userMessage))
            
            if (isConfirmingPrevious) {
              // Busca endereço anterior nas mensagens recentes
              try {
                const previousMessages = await prisma.message.findMany({
                  where: {
                    instanceId,
                    from: normalizedContactNumber,
                    isFromMe: false,
                  },
                  orderBy: { timestamp: 'desc' },
                  take: 10,
                })
                
                // Usa os mesmos padrões de busca de endereço
                const addressPatterns = [
                  /(?:rua|avenida|av\.?|r\.?|estrada|rodovia)\s+[^,\n]+(?:,\s*\d+[^,\n]*)?(?:,\s*[^,\n]+)?(?:,\s*[^,\n]+)?(?:,\s*[^,\n]+)?(?:,\s*[^,\n]+)?(?:,\s*[^,\n]+)?(?:,\s*[^,\n]+)?(?:,\s*\d{5}-?\d{3})?/i,
                  /[^,\n]+(?:-\s*\d+)?(?:,\s*[^,\n]+){2,}(?:,\s*[^,\n]+)?(?:,\s*\d{5}-?\d{3})?/i,
                ]
                
                for (const msg of previousMessages) {
                  if (msg.body.length < 20) continue
                  
                  for (const pattern of addressPatterns) {
                    const match = msg.body.match(pattern)
                    if (match && match[0].length >= 20 && match[0].length <= 200) {
                      const hasNumbers = /\d/.test(match[0])
                      const hasWords = /[a-záàâãéèêíïóôõöúçñ]{3,}/i.test(match[0])
                      
                      if (hasNumbers && hasWords) {
                        deliveryAddress = match[0].trim()
                        console.log(`🛒 [checkout] ✅ Cliente confirmou uso de endereço anterior: "${deliveryAddress}"`)
                        break
                      }
                    }
                  }
                  
                  if (deliveryAddress) break
                }
                
                if (!deliveryAddress) {
                  return {
                    success: false,
                    error: 'Não encontrei um endereço anterior para usar. Por favor, informe o endereço completo de entrega (rua, número, bairro, cidade e CEP se possível).',
                    requiresDeliveryAddress: true,
                  }
                }
              } catch (error) {
                console.error(`🛒 [checkout] Erro ao buscar endereço anterior:`, error)
            return {
              success: false,
              error: 'Para entrega, é necessário informar o endereço completo. Por favor, informe o endereço de entrega (rua, número, bairro, cidade e CEP se possível).',
              requiresDeliveryAddress: true,
                }
              }
            } else {
              return {
                success: false,
                error: 'Para entrega, é necessário informar o endereço completo. Por favor, informe o endereço de entrega (rua, número, bairro, cidade e CEP se possível).',
                requiresDeliveryAddress: true,
              }
            }
          }
          
          // ⚠️ VALIDAÇÃO CRÍTICA: Verifica se o endereço foi fornecido na mensagem ATUAL do usuário
          // Previne que a IA use endereços de conversas anteriores
          if (deliveryType === 'delivery' && deliveryAddress) {
            const userMessageLower = userMessage.toLowerCase().trim()
            const deliveryAddressLower = deliveryAddress.toLowerCase().trim()
            
            // Extrai palavras-chave significativas do endereço (rua, número, bairro, cidade, CEP)
            // Remove palavras comuns que não são específicas do endereço
            const commonWords = new Set(['rua', 'avenida', 'av', 'r', 'n', 'numero', 'número', 'bairro', 'cidade', 'estado', 'cep', 'sp', 'rj', 'mg', 'pr', 'sc', 'rs', 'ba', 'go', 'pe', 'ce', 'df', 'es', 'pb', 'al', 'se', 'rn', 'pi', 'ma', 'to', 'pa', 'ap', 'ro', 'ac', 'rr', 'am', 'ms', 'mt'])
            
            const addressKeywords = deliveryAddressLower
              .split(/[,\s-]+/)
              .filter((word: string) => word.length > 1 && !commonWords.has(word)) // Remove palavras muito curtas e comuns
              .slice(0, 6) // Pega até 6 palavras-chave específicas
            
            // Verifica se pelo menos 2 palavras-chave específicas do endereço estão na mensagem atual
            const keywordsInMessage = addressKeywords.filter((keyword: string) => 
              userMessageLower.includes(keyword)
            )
            
            // Se menos de 2 palavras-chave específicas estão na mensagem, o endereço não foi fornecido agora
            if (addressKeywords.length > 0 && keywordsInMessage.length < 2) {
              console.warn(`🛒 [checkout] ⚠️ Endereço fornecido pela IA não está na mensagem atual do usuário`)
              console.warn(`   Mensagem do usuário: "${userMessage}"`)
              console.warn(`   Endereço fornecido pela IA: "${deliveryAddress}"`)
              console.warn(`   Palavras-chave específicas encontradas: ${keywordsInMessage.length}/${addressKeywords.length}`)
              console.warn(`   Palavras-chave do endereço: ${addressKeywords.join(', ')}`)
              
              // Busca endereços anteriores nas mensagens recentes do usuário
              try {
                const previousMessages = await prisma.message.findMany({
                  where: {
                    instanceId,
                    from: normalizedContactNumber,
                    isFromMe: false, // Apenas mensagens do usuário
                  },
                  orderBy: { timestamp: 'desc' },
                  take: 10, // Últimas 10 mensagens do usuário
                })
                
                // Procura por endereços nas mensagens anteriores
                // Padrões mais flexíveis para capturar diferentes formatos de endereço
                const addressPatterns = [
                  // Formato completo: Rua/Av, Número, Bairro, Cidade - Estado, CEP
                  /(?:rua|avenida|av\.?|r\.?|estrada|rodovia)\s+[^,\n]+(?:,\s*\d+[^,\n]*)?(?:,\s*[^,\n]+)?(?:,\s*[^,\n]+)?(?:,\s*[^,\n]+)?(?:,\s*[^,\n]+)?(?:,\s*[^,\n]+)?(?:,\s*\d{5}-?\d{3})?/i,
                  // Formato com hífen: Rua - Número, Bairro, Cidade - Estado
                  /[^,\n]+(?:-\s*\d+)?(?:,\s*[^,\n]+){2,}(?:,\s*[^,\n]+)?(?:,\s*\d{5}-?\d{3})?/i,
                ]
                
                let previousAddress: string | null = null
                for (const msg of previousMessages) {
                  // Pula mensagens muito curtas (provavelmente não são endereços)
                  if (msg.body.length < 20) continue
                  
                  for (const pattern of addressPatterns) {
                    const match = msg.body.match(pattern)
                    if (match && match[0].length >= 20 && match[0].length <= 200) {
                      // Verifica se parece um endereço (contém números e palavras)
                      const hasNumbers = /\d/.test(match[0])
                      const hasWords = /[a-záàâãéèêíïóôõöúçñ]{3,}/i.test(match[0])
                      
                      if (hasNumbers && hasWords) {
                        previousAddress = match[0].trim()
                        console.log(`🛒 [checkout] 📍 Endereço anterior encontrado: "${previousAddress}"`)
                        break
                      }
                    }
                  }
                  
                  if (previousAddress) break
                }
                
                // Se encontrou um endereço anterior, pergunta se o cliente quer usar
                if (previousAddress) {
                  return {
                    success: false,
                    error: `Encontrei um endereço de uma conversa anterior:\n\n📍 *${previousAddress}*\n\nVocê gostaria de usar este endereço para a entrega ou prefere informar um endereço diferente?\n\nDigite "usar este" ou "usar esse" para usar o endereço acima, ou informe um novo endereço.`,
                    requiresDeliveryAddress: true,
                    previousAddress: previousAddress, // Passa o endereço anterior para a IA poder usar
                  }
                }
              } catch (error) {
                console.error(`🛒 [checkout] Erro ao buscar endereços anteriores:`, error)
              }
              
              // Se não encontrou endereço anterior, pede um novo
              return {
                success: false,
                error: 'Para entrega, é necessário informar o endereço completo na mensagem atual. Por favor, informe o endereço de entrega (rua, número, bairro, cidade e CEP se possível).',
                requiresDeliveryAddress: true,
              }
            }
          }
          
          // Calcula frete se for entrega
          let freightAmount: number | null = null
          if (deliveryType === 'delivery' && deliveryAddress) {
            console.log(`🛒 [checkout] Calculando frete para entrega...`)
            try {
              // Busca configurações do usuário
              const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                  businessAddress: true,
                  deliveryPricePerKm: true,
                },
              })

              if (user?.businessAddress && user?.deliveryPricePerKm && user.deliveryPricePerKm > 0) {
                // Importa função de cálculo de frete
                const { calculateFrete } = await import('./delivery')
                const freightResult = await calculateFrete(user.businessAddress, deliveryAddress.trim(), user.deliveryPricePerKm)
                
                if (freightResult && freightResult.success) {
                  freightAmount = freightResult.freightPrice ?? null
                  console.log(`🛒 [checkout] Frete calculado: R$ ${freightAmount} (distância: ${freightResult.distance}km)`)
                } else {
                  console.warn(`🛒 [checkout] ⚠️ Erro ao calcular frete:`, freightResult?.error)
                  // Continua sem frete se houver erro
                }
              } else {
                console.warn(`🛒 [checkout] ⚠️ Configurações de entrega não encontradas ou incompletas`)
                // Continua sem frete
              }
            } catch (error) {
              console.error(`🛒 [checkout] ❌ Erro ao calcular frete:`, error)
              // Continua sem frete se houver erro
            }
          }
          
          console.log(`🛒 [checkout] Tipo de entrega definido:`, {
            deliveryType,
            deliveryAddress: deliveryAddress ? 'fornecido' : 'não fornecido',
            freightAmount: freightAmount || 0,
          })

          // Log antes de criar pedido
          console.log(`🛒 [checkout] Criando pedido...`, {
            userId,
            instanceId,
            normalizedContactNumber,
            itemCount: cart.items.length,
            deliveryType,
            freightAmount,
          })

          // Cria o pedido
          let result
          try {
            result = await createOrderFromCart(
              userId,
              instanceId,
              normalizedContactNumber,
              contactNameFinal,
              deliveryType,
              deliveryAddress,
              args.notes,
              freightAmount
            )
            console.log(`🛒 [checkout] ✅ Pedido criado com sucesso:`, {
              orderId: result.orderId,
              paymentLink: result.paymentLink,
              paymentPixKey: result.paymentPixKey,
            })
          } catch (error) {
            console.error(`🛒 [checkout] ❌ Erro ao criar pedido:`, error)
            log.error('Erro ao criar pedido no checkout', error)
            return {
              success: false,
              error: `Erro ao criar pedido: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            }
          }

          // Calcula o total
          const cartSubtotal = cart.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
          const freight = freightAmount && freightAmount > 0 ? freightAmount : 0
          const totalAmount = cartSubtotal + freight
          const formattedSubtotal = cartSubtotal.toFixed(2).replace('.', ',')
          const formattedFreight = freight.toFixed(2).replace('.', ',')
          const formattedTotal = totalAmount.toFixed(2).replace('.', ',')

          // Monta mensagem de confirmação com resumo detalhado e bonito
          let message = `✅ *Pedido Confirmado com Sucesso!*\n`
          message += `━━━━━━━━━━━━━━━━━━━━\n\n`
          message += `📋 *Resumo do Pedido*\n\n`

          // Lista de itens
          message += `📦 *Itens do Pedido:*\n\n`
          cart.items.forEach((item, index) => {
            const itemTotal = item.quantity * item.unitPrice
            const formattedUnitPrice = item.unitPrice.toFixed(2).replace('.', ',')
            const formattedItemTotal = itemTotal.toFixed(2).replace('.', ',')
            
            message += `${index + 1}. *${item.productName}*\n`
            message += `   Quantidade: ${item.quantity}x\n`
            message += `   Preço unitário: R$ ${formattedUnitPrice}\n`
            message += `   Subtotal: R$ ${formattedItemTotal}\n`
            if (item.notes) {
              message += `   📝 Observação: ${item.notes}\n`
            }
            message += `\n`
          })

          message += `━━━━━━━━━━━━━━━━━━━━\n`
          message += `📦 *Subtotal dos Itens: R$ ${formattedSubtotal}*\n`
          
          // Adiciona frete se houver
          if (deliveryType === 'delivery' && freight > 0) {
            message += `🚚 *Frete: R$ ${formattedFreight}*\n`
          }
          
          message += `💰 *Total do Pedido: R$ ${formattedTotal}*\n\n`

          // Informações de entrega
          message += `🚚 *Informações de Entrega:*\n\n`
          if (deliveryType === 'delivery') {
            message += `Tipo: *Entrega*\n`
            if (deliveryAddress) {
              message += `📍 Endereço: ${deliveryAddress}\n`
            }
            if (freight > 0) {
              message += `💰 Frete calculado: R$ ${formattedFreight}\n`
            }
          } else {
            message += `Tipo: *Retirada no estabelecimento*\n`
            message += `Você pode retirar seu pedido no nosso estabelecimento.\n`
          }

          if (args.notes) {
            message += `\n📝 *Observações do Pedido:*\n`
            message += `${args.notes}\n`
          }

          message += `\n━━━━━━━━━━━━━━━━━━━━\n\n`

          // Adiciona informações de pagamento se houver
          message += `💳 *Informações de Pagamento:*\n\n`
          if (result.paymentLink) {
            message += `Método: *Pagamento Online*\n`
            message += `🔗 Link de pagamento:\n`
            message += `${result.paymentLink}\n\n`
            message += `Clique no link acima para realizar o pagamento.\n`
          } else if (result.paymentPixKey) {
            message += `Método: *PIX*\n`
            message += `🔑 Chave Pix:\n`
            message += `\`${result.paymentPixKey}\`\n\n`
            message += `💰 Valor Total: R$ ${formattedTotal}\n\n`
            message += `Copie a chave Pix acima e realize o pagamento no valor de R$ ${formattedTotal}.\n`
          } else {
            message += `Método: *Pagamento na Entrega/Retirada*\n`
            if (deliveryType === 'delivery') {
              message += `Você pode pagar no momento da entrega.\n`
            } else {
              message += `Você pode pagar na retirada do pedido.\n`
            }
          }

          message += `\n━━━━━━━━━━━━━━━━━━━━\n\n`
          message += `🎉 *Obrigado pela sua preferência!*\n\n`
          message += `Seu pedido foi registrado e em breve entraremos em contato.`

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
    
    // Intercepta resposta de view_cart para forçar uso da mensagem exata
    let viewCartExactMessage: string | null = null

    const interceptedFunctionCall = async (functionName: string, args: any) => {
      console.log(`🔧🔧🔧 [interceptedFunctionCall] ========== INTERCEPTANDO CHAMADA DE FUNÇÃO ==========`)
      console.log(`   functionName: "${functionName}"`)
      console.log(`   args:`, JSON.stringify(args, null, 2))
      console.log(`   userId: ${userId}`)
      console.log(`   instanceId: ${instanceId}`)
      console.log(`   contactNumber: "${contactNumber}"`)
      
      // CRÍTICO: Log especial para add_to_cart
      if (functionName === 'add_to_cart') {
        console.log(`🛒🛒🛒 [interceptedFunctionCall] ⚠️⚠️⚠️ ADD_TO_CART INTERCEPTADO! ⚠️⚠️⚠️`)
        console.log(`   Parâmetros:`)
        console.log(`     product_id: ${args?.product_id}`)
        console.log(`     product_type: ${args?.product_type}`)
        console.log(`     product_name: ${args?.product_name}`)
        console.log(`     quantity: ${args?.quantity || 1}`)
      }

      // GUARD RAIL: Impede que a IA encerre o chat se o usuário quiser finalizar o pedido
      if (functionName === 'close_chat') {
        const lastUserMessage = userMessage
        const checkoutTriggers = ['finalizar', 'fechar', 'comprar', 'só isso', 'por enquanto é só', 'tá bom assim', 'pode fechar', 'concluir']

        const hasCheckoutIntent = checkoutTriggers.some(trigger => lastUserMessage.includes(trigger))

        if (hasCheckoutIntent) {
          console.log(`🛡️ [interceptedFunctionCall] GUARD RAIL ATIVADO: Bloqueando close_chat pois detectou intenção de compra`)
          return {
            success: false,
            error: '⚠️ AÇÃO BLOQUEADA: O usuário indicou que quer FINALIZAR O PEDIDO ou COMPRAR. NÃO encerre o chat! Use a função "checkout" para prosseguir com a venda. Se faltar informações (como tipo de entrega), chame "checkout" mesmo assim ou pergunte ao usuário.',
          }
        }
      }

      try {
        const result = await handleFunctionCall(functionName, args)

        console.log(`✅ [interceptedFunctionCall] Função ${functionName} executada`)
        console.log(`📊 [interceptedFunctionCall] Resultado:`, JSON.stringify(result, null, 2))

        // Se view_cart retornou sucesso, armazena a mensagem exata para usar diretamente
        if (functionName === 'view_cart' && result && typeof result === 'object' && 'success' in result && result.success === true && 'message' in result) {
          viewCartExactMessage = result.message as string
          console.log(`🛒 [interceptedFunctionCall] Mensagem exata de view_cart armazenada para uso direto`)
        }

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
        /*
        {
          name: 'close_chat',
          description: 'Encerra a conversa com o cliente. Use APENAS quando o cliente pedir explicitamente para encerrar o chat (ex: "tchau", "até logo", "encerrar atendimento") ou quando a conversa já foi concluída e o cliente se despediu. ⚠️ IMPORTANTE: NÃO use esta função quando o cliente disser "finalizar pedido", "fechar compra" ou "só isso" - nesses casos, use a função CHECKOUT.',
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
        */
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
          description: '⚠️⚠️⚠️ CRÍTICO ABSOLUTO: Adiciona um produto ou serviço ao carrinho de compras. Você DEVE CHAMAR ESTA FUNÇÃO SEMPRE que o cliente pedir um produto! EXEMPLOS: "quero 9 figures da furina" → CHAME add_to_cart(product_name: "figure da furina", quantity: 9), "quero um chaveiro" → CHAME add_to_cart(product_name: "chaveiro"), "vou querer uma bolacha" → CHAME add_to_cart(product_name: "bolacha da nahida"). NUNCA diga "adicionei" ou "vou adicionar" SEM chamar esta função primeiro! Se você não chamar esta função, o produto NÃO será adicionado ao carrinho e o cliente ficará confuso! FLUXO OBRIGATÓRIO: Cliente pede produto → Você CHAMA add_to_cart → Função retorna → Você informa o cliente.',
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
          description: '⚠️⚠️⚠️ CRÍTICO: Visualiza o conteúdo atual do carrinho de compras. Retorna uma mensagem formatada com TODOS os itens, suas QUANTIDADES, preços unitários, subtotais e o total. Você DEVE usar EXATAMENTE a mensagem retornada por esta função, SEM reformular, SEM remover quantidades, SEM simplificar! A mensagem já está formatada corretamente com todas as informações necessárias. Use quando o cliente perguntar "o que tem no carrinho", "meu carrinho", "itens do pedido" ou quando quiser ver o resumo antes de finalizar.',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'remove_from_cart',
          description: '⚠️⚠️⚠️ ATENÇÃO: Remove um item ESPECÍFICO do carrinho COMPLETAMENTE (remove todas as unidades). Use APENAS quando o cliente quiser REMOVER TODAS as unidades de um produto (ex: "remove a figure", "tira a bolacha", "não quero mais esse produto"). ⚠️ NÃO use quando o cliente quiser REDUZIR quantidade (ex: "quero apenas uma, não duas") - nesse caso use update_cart_item_quantity! Você precisa do product_id e product_type do item que deseja remover.',
          parameters: {
            type: 'object',
            properties: {
              product_id: {
                type: 'string',
                description: 'ID do produto/serviço a ser removido do carrinho.',
              },
              product_type: {
                type: 'string',
                enum: ['service', 'catalog'],
                description: 'Tipo do produto: "service" para serviços ou "catalog" para produtos do catálogo.',
              },
            },
            required: ['product_id', 'product_type'],
          },
        },
        {
          name: 'update_cart_item_quantity',
          description: '⚠️⚠️⚠️⚠️⚠️ CRÍTICO ABSOLUTO: Atualiza a quantidade de um item no carrinho. ⚠️⚠️⚠️ USE ESTA FUNÇÃO quando o cliente disser: "remove uma X", "tira uma X", "reduz uma X", "quero apenas uma X, não duas", "muda para 3", "só quero 1". ⚠️⚠️⚠️ REGRA DE OURO: "remove uma X" = REDUZIR quantidade (use esta função), NÃO é "remove_from_cart"! Você precisa do product_id e product_type. O parâmetro quantity é OPCIONAL - se você omitir, a função reduzirá automaticamente 1 unidade. Se você souber a quantidade exata desejada, pode passar quantity. Se quantity for 0, o item é removido. ⚠️⚠️⚠️ NUNCA use remove_from_cart quando o cliente quiser reduzir quantidade - SEMPRE use esta função!',
          parameters: {
            type: 'object',
            properties: {
              product_id: {
                type: 'string',
                description: 'ID do produto/serviço cuja quantidade será atualizada.',
              },
              product_type: {
                type: 'string',
                enum: ['service', 'catalog'],
                description: 'Tipo do produto: "service" para serviços ou "catalog" para produtos do catálogo.',
              },
              quantity: {
                type: 'number',
                description: 'Nova quantidade desejada (deve ser >= 0). Se for 0, o item é removido. Se omitido, a função reduzirá automaticamente 1 unidade da quantidade atual.',
              },
            },
            required: ['product_id', 'product_type', 'quantity'],
          },
        },
        {
          name: 'clear_cart',
          description: 'Limpa completamente o carrinho de compras, removendo todos os itens. Use quando o cliente quiser cancelar o pedido, disser "cancela tudo", "limpa o carrinho", "não quero mais nada", "desiste do pedido".',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'checkout',
          description: '⚠️⚠️⚠️ CRÍTICO: Finaliza o pedido e cria a ordem de compra. VOCÊ DEVE CHAMAR ESTA FUNÇÃO quando: (1) O cliente disser "quero finalizar a compra", "finalizar", "fechar pedido", "completar pedido", "concluir compra", "confirmar compra", "confirmar pedido", "confirmar", "sim", "ok", "só isso", "por enquanto é só", "tá bom assim", "pode fechar". (2) Você acabou de mostrar o carrinho (via view_cart) e o cliente responde "confirmar", "sim", "ok", "finalizar" - CHAME checkout IMEDIATAMENTE! NUNCA liste produtos novamente quando o cliente quer finalizar - ele já tem itens no carrinho! Esta função mostra automaticamente o que está no carrinho e processa o pedido. Se não souber o tipo de entrega, use "pickup" como padrão.',
          parameters: {
            type: 'object',
            properties: {
              delivery_type: {
                type: 'string',
                enum: ['pickup', 'delivery'],
                description: 'Tipo de entrega: "pickup" para retirada no estabelecimento (PADRÃO se não especificado) ou "delivery" para entrega no endereço. Se o cliente não especificar, use "pickup".',
              },
              delivery_address: {
                type: 'string',
                description: 'Endereço completo de entrega (obrigatório APENAS se delivery_type for "delivery"). Inclua rua, número, bairro, cidade e CEP se possível. Se for pickup, pode omitir este campo.',
              },
              notes: {
                type: 'string',
                description: 'Observações gerais do pedido (opcional).',
              },
            },
            required: [],
          },
        },
      ],
      onFunctionCall: interceptedFunctionCall,
    })

    // Se view_cart retornou sucesso, usa a mensagem exata diretamente em vez da resposta da IA
    if (viewCartExactMessage) {
      console.log(`🛒 [executeAIOnlyWorkflow] Usando mensagem exata de view_cart em vez da resposta da IA`)
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, viewCartExactMessage!, 'service')
      })
      return
    }

    // Se há uma resposta de agendamento pendente, usa ela diretamente em vez da resposta da IA
    if (pendingAppointmentResponse) {
      const contactKey = `${instanceId}-${contactNumber}`

      if (isImageAttachment(pendingAppointmentMedia)) {
        const media: MediaAttachment = pendingAppointmentMedia
        await queueMessage(contactKey, async () => {
            await sendWhatsAppImage(
              instanceId,
              contactNumber,
              media.url,
              media.caption
            )
        })
      }

      // Envia mensagem de confirmação (em modo de teste, apenas salva no banco)
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, pendingAppointmentResponse!, 'service')
      })
      console.log(`📅 Mensagem de confirmação de agendamento enviada`)
      return
    }

    // Não força mais mencionar o nome do negócio em todas as mensagens para manter naturalidade

    // Envia a resposta gerada pela IA (em modo de teste, apenas salva no banco)
    const contactKey = `${instanceId}-${contactNumber}`
    await queueMessage(contactKey, async () => {
      await sendWhatsAppMessage(instanceId, contactNumber, aiResponse, 'service')
    })

    console.log(`🤖 Resposta de IA autônoma gerada para ${contactNumber}`)
  } catch (error) {
    console.error('Erro ao executar workflow IA-only:', error)
    log.error('Erro ao executar workflow IA-only', error)

    // Log detalhado do erro
    if (error instanceof Error) {
      console.error('Erro detalhado:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      })
    }

    // Envia mensagem de erro amigável (em modo de teste, apenas salva no banco)
    const errorMessage = 'Desculpe, ocorreu um erro ao processar sua mensagem. Nossa equipe foi notificada.'
    const contactKey = `${instanceId}-${contactNumber}`
    try {
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, errorMessage, 'service')
      })
    } catch (sendError) {
      console.error('Erro ao enviar mensagem de erro:', sendError)
    }
  }
}

/**
 * @deprecated Use buildSystemPrompt de lib/_prompts/build-system-prompt.ts
 * Mantido apenas para compatibilidade - será removido em versão futura
 */
function buildAISystemPrompt(businessDetails: any, contactName: string): string {
  // Redireciona para a nova função modular
  return buildSystemPrompt(businessDetails, contactName)
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