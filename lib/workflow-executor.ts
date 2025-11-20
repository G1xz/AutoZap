import { prisma } from './prisma'
import { sendWhatsAppMessage, sendWhatsAppInteractiveMessage, sendWhatsAppImage, sendWhatsAppVideo, sendWhatsAppDocument, getUserProfileName } from './whatsapp-cloud-api'
import { generateAIResponse } from './openai'

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
      // Continua execução existente (ex: resposta de questionário)
      await processQuestionnaireResponse(instanceId, contactNumber, messageBody)
      return
    }

    // Procura workflow que corresponde ao trigger
    for (const workflow of workflows) {
      const trigger = workflow.trigger.toLowerCase().trim()
      
      if (messageBody.includes(trigger)) {
        console.log(`🔄 Workflow "${workflow.name}" acionado para ${contactNumber}`)
        
        // Se for fluxo IA-only, executar de forma autônoma
        if (workflow.isAIOnly) {
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

    // Parse dos detalhes do negócio
    let businessDetails: any = {}
    if (workflow.aiBusinessDetails) {
      try {
        businessDetails = JSON.parse(workflow.aiBusinessDetails)
      } catch {
        console.error('Erro ao parsear detalhes do negócio')
      }
    }

    // Monta o prompt do sistema com os detalhes do negócio
    const systemPrompt = buildAISystemPrompt(businessDetails, contactNameFinal || formattedPhoneFormatted)

    // Gera resposta usando IA
    const { generateAIResponse } = await import('./openai')
    const aiResponse = await generateAIResponse(userMessage, {
      systemPrompt,
      conversationHistory,
      variables: {
        nome: contactNameFinal || formattedPhoneFormatted || 'Usuário',
        telefone: formattedPhoneFormatted || contactNumber,
        telefoneNumero: formattedPhone || contactNumber,
      },
      temperature: 0.7,
      maxTokens: 500,
    })

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
  const products = businessDetails.products || []
  const services = businessDetails.services || []
  const tone = businessDetails.tone || 'friendly'
  const additionalInfo = businessDetails.additionalInfo || ''

  const toneDescriptions: Record<string, string> = {
    friendly: 'amigável, descontraído e prestativo',
    professional: 'profissional, educado e eficiente',
    casual: 'casual, descontraído e próximo',
    formal: 'formal, respeitoso e polido',
  }
  
  const toneDescription = toneDescriptions[tone] || 'amigável e prestativo'

  let prompt = `Você é um assistente virtual de ${businessName}. `

  if (businessDescription) {
    prompt += `${businessDescription} `
  }

  prompt += `Seu papel é conversar com clientes de forma ${toneDescription} e ajudá-los da melhor forma possível. `

  if (products.length > 0) {
    prompt += `\n\nProdutos oferecidos:\n${products.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`
  }

  if (services.length > 0) {
    prompt += `\n\nServiços oferecidos:\n${services.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`
  }

  if (additionalInfo) {
    prompt += `\n\nInformações adicionais:\n${additionalInfo}`
  }

  prompt += `\n\nVocê está conversando com ${contactName}. Seja natural, útil e sempre mantenha o tom ${toneDescription}. Se não souber algo, seja honesto e ofereça ajuda de outras formas.`

  return prompt
}

