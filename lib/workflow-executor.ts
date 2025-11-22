import { prisma } from './prisma'
import { sendWhatsAppMessage, sendWhatsAppInteractiveMessage, sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppDocument, getUserProfileName } from './whatsapp-cloud-api'
import { generateAIResponse } from './openai'
import { createAppointment, checkAvailability } from './appointments'

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
      console.error(`Erro ao enviar mensagem na fila para ${contactKey}:`, error)
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
    })

    // Verifica se há uma execução em andamento para este contato
    const executionKey = `${instanceId}-${contactNumber}`
    const currentExecution = workflowExecutions.get(executionKey)

    if (currentExecution) {
      // Se há execução IA-only em andamento, sempre responde
      if (currentExecution.workflowId) {
        const workflow = workflows.find(w => w.id === currentExecution.workflowId)
        if (workflow?.isAIOnly) {
          await executeAIOnlyWorkflow(workflow, instanceId, contactNumber, messageBody, message.contactName)
          return
        }
      }
      // Continua execução existente (ex: resposta de questionário)
      await processQuestionnaireResponse(instanceId, contactNumber, messageBody)
      return
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
        console.log(`🤖 Workflow IA-only "${workflow.name}" respondendo para ${contactNumber} (interação: ${hasRecentInteraction}, trigger: ${matchesTrigger})`)
        
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
        console.log(`🔄 Workflow "${workflow.name}" acionado para ${contactNumber}`)
        
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
          console.log('⚠️ Nenhum nó trigger encontrado no workflow')
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
    console.error('Erro ao executar workflows:', error)
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
    console.error('Erro ao continuar execução:', error)
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
        console.log(`⚠️ Nó ${currentNodeId} não encontrado`)
        break
      }

      console.log(`▶️ Executando nó: ${currentNode.type} (${currentNodeId})`)

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
    console.error('Erro ao executar workflow:', error)
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
              console.error('Erro ao enviar arquivo:', error)
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
        
        console.log(`🤖 Resposta de IA gerada para ${contactNumber}`)
      } catch (error) {
        console.error('Erro ao gerar resposta de IA:', error)
        
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
        console.error('Erro ao avaliar condição:', e)
      }

      const handleId = conditionResult ? 'true' : 'false'
      return getNextNode(node.id, connections, handleId)

    default:
      console.log(`⚠️ Tipo de nó desconhecido: ${type}`)
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
    console.log('⚠️ Nenhuma execução encontrada para processar resposta')
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
        console.log(`✅ Opção identificada pelo buttonId do interactiveData: ${optionId}`)
      }
    }
    
    // PRIORIDADE 2: Se a mensagem é um ID de botão (começa com "option-"), usa diretamente
    if (!optionId && messageBody.startsWith('option-')) {
      const extractedId = messageBody.replace('option-', '')
      const foundOption = options.find((opt: any) => opt.id === extractedId)
      if (foundOption) {
        optionId = extractedId
        console.log(`✅ Opção identificada pelo ID do botão: ${optionId}`)
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
        console.log(`✅ Opção identificada pelo título: ${optionId}`)
      }
    }
    
    // PRIORIDADE 4: Verifica se respondeu com número (ex: "1", "2", etc)
    if (!optionId) {
      const numberMatch = messageLower.match(/^(\d+)/)
      if (numberMatch) {
        const optionIndex = parseInt(numberMatch[1]) - 1
        if (options[optionIndex]) {
          optionId = options[optionIndex].id
          console.log(`✅ Opção identificada pelo número: ${optionId} (índice ${optionIndex})`)
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

    // Buscar userId do workflow para criar agendamentos e buscar catálogo
    const fullWorkflow = await prisma.workflow.findUnique({
      where: { id: workflow.id },
      select: { userId: true },
    })
    const userId = fullWorkflow?.userId

    if (!userId) {
      console.error('❌ userId não encontrado para o workflow')
      return
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

          catalog.nodes.forEach((node: any) => {
            try {
              const nodeData = JSON.parse(node.data)
              console.log(`🔍 Processando nó do catálogo:`, {
                type: node.type,
                name: nodeData.name,
                hasPrice: !!nodeData.price,
                price: nodeData.price
              })
              
              if (node.type === 'product' && nodeData.name) {
                let productName = nodeData.name
                if (nodeData.price) {
                  productName += ` - R$ ${nodeData.price.toFixed(2).replace('.', ',')}`
                }
                catalogProducts.push(productName)
                console.log(`✅ Produto adicionado: ${productName}`)
              } else if (node.type === 'service' && nodeData.name) {
                let serviceName = nodeData.name
                if (nodeData.price) {
                  serviceName += ` - R$ ${nodeData.price.toFixed(2).replace('.', ',')}`
                }
                catalogServices.push(serviceName)
                console.log(`✅ Serviço adicionado: ${serviceName}`)
              } else {
                console.log(`⚠️ Nó ignorado: tipo=${node.type}, tem nome=${!!nodeData.name}`)
              }
            } catch (e) {
              console.error('❌ Erro ao parsear dados do nó do catálogo:', e, 'Node data:', node.data)
            }
          })

          // Se há catalogId, SEMPRE usar produtos/serviços do catálogo (substitui os manuais)
          // Limpa produtos/serviços manuais quando há catálogo
          businessDetails.products = catalogProducts.length > 0 ? catalogProducts : []
          businessDetails.services = catalogServices.length > 0 ? catalogServices : []
          
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

    // Monta o prompt do sistema com os detalhes do negócio
    const systemPrompt = buildAISystemPrompt(businessDetails, contactNameFinal || formattedPhoneFormatted)

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
        predefinedResponse = `Olá! Sou assistente da ${businessDetails.businessName}.`
      }
      
      if (businessDesc) {
        predefinedResponse += ` ${businessDesc}`
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
      
      // Envia a resposta pré-definida primeiro
      const contactKey = `${instanceId}-${contactNumber}`
      await queueMessage(contactKey, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, predefinedResponse.trim(), 'service')
      })
      
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
      
      userMessageWithContext = `[CONTEXTO: Você é assistente de vendas da ${businessDetails.businessName}. Seja NATURAL e CONVERSACIONAL. Mencione o negócio quando relevante, mas não seja repetitivo. Varie suas respostas - não termine sempre com "Como posso te ajudar?". Seja direto e objetivo, como em uma conversa normal. NUNCA seja genérico como "teste de eco".${listFormatting}]\n\nMensagem do cliente: ${userMessage}`
    }

    // Gera resposta usando IA
    const { generateAIResponse } = await import('./openai')
    
    // Se for primeira interação, não usa histórico para forçar seguir o template
    // E aumenta temperatura para ser mais criativo seguindo as instruções
    const finalConversationHistory = isFirstInteraction ? [] : conversationHistory
    const temperature = isFirstInteraction ? 0.9 : 0.8 // Mais criativo e natural
    
    console.log(`🤖 Gerando resposta IA-only. Primeira interação: ${isFirstInteraction}, Histórico: ${finalConversationHistory.length} mensagens`)
    
    // Define função de agendamento para a IA usar quando necessário
    const appointmentFunction = {
      name: 'create_appointment',
      description: 'Cria um agendamento na agenda quando o cliente quer marcar um horário. Use esta função quando o cliente expressar interesse em agendar algo, marcar uma consulta, ou definir um horário.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Data e hora do agendamento no formato ISO 8601 (ex: 2024-12-25T14:30:00). Se o cliente não especificar hora, use um horário padrão como 14:00.',
          },
          description: {
            type: 'string',
            description: 'Descrição do agendamento, incluindo o que será feito, serviço solicitado, ou motivo do agendamento.',
          },
        },
        required: ['date', 'description'],
      },
    }

    // Handler para quando a IA chamar a função de agendamento
    const handleFunctionCall = async (functionName: string, args: any) => {
      if (functionName === 'create_appointment' && userId) {
        try {
          const appointmentDate = new Date(args.date)
          
          // Valida se a data é válida e não é no passado
          if (isNaN(appointmentDate.getTime())) {
            return {
              success: false,
              error: 'Data inválida. Por favor, forneça uma data válida.',
            }
          }

          if (appointmentDate < new Date()) {
            return {
              success: false,
              error: 'Não é possível agendar para uma data no passado. Por favor, escolha uma data futura.',
            }
          }

          const result = await createAppointment({
            userId,
            instanceId,
            contactNumber,
            contactName: contactNameFinal,
            date: appointmentDate,
            description: args.description || `Agendamento solicitado via WhatsApp`,
          })

          if (result.success) {
            const formattedDate = appointmentDate.toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return {
              success: true,
              message: `Agendamento criado com sucesso para ${formattedDate}.`,
              appointment: result.appointment,
            }
          } else {
            return {
              success: false,
              error: result.error || 'Erro ao criar agendamento.',
            }
          }
        } catch (error) {
          console.error('Erro ao criar agendamento:', error)
          return {
            success: false,
            error: 'Ocorreu um erro ao criar o agendamento. Por favor, tente novamente.',
          }
        }
      }

      return {
        success: false,
        error: 'Função não reconhecida.',
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
      functions: [appointmentFunction],
      onFunctionCall: handleFunctionCall,
    })
    
    // Validação CRÍTICA: Se a resposta não mencionar o negócio, força mencionar
    if (businessDetails.businessName && !aiResponse.toLowerCase().includes(businessDetails.businessName.toLowerCase())) {
      console.warn(`⚠️ Resposta da IA não mencionou o negócio "${businessDetails.businessName}"! Forçando correção...`)
      const correctedResponse = `Olá! Sou assistente de vendas da ${businessDetails.businessName}.\n\n${aiResponse}`
      await queueMessage(`${instanceId}-${contactNumber}`, async () => {
        await sendWhatsAppMessage(instanceId, contactNumber, correctedResponse, 'service')
      })
      return
    }

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
 * Constrói o prompt do sistema para a IA baseado nos detalhes do negócio
 */
function buildAISystemPrompt(businessDetails: any, contactName: string): string {
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

  // Determina o que o negócio oferece
  const sellsProducts = businessType === 'products' || businessType === 'both'
  const sellsServices = businessType === 'services' || businessType === 'both'

  let prompt = `Você é um ASSISTENTE DE VENDAS da ${businessName}. Seu objetivo é APRESENTAR e VENDER os produtos/serviços do negócio de forma natural e persuasiva. Você NÃO é um chatbot genérico - você é um VENDEDOR especializado. `

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
  prompt += `\n\n📅 FUNCIONALIDADE DE AGENDAMENTO:\n`
  prompt += `- Quando o cliente quiser agendar algo, marcar uma consulta, ou definir um horário, use a função create_appointment\n`
  prompt += `- Pergunte ao cliente a data e hora desejada, e o motivo/descrição do agendamento\n`
  prompt += `- Se o cliente não especificar a hora, sugira um horário padrão (ex: 14:00)\n`
  prompt += `- Após criar o agendamento, confirme os detalhes para o cliente de forma clara e amigável\n`
  prompt += `- Se houver erro ao criar o agendamento, informe o cliente e peça para tentar novamente\n`
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

