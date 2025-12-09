/**
 * Biblioteca de integração com OpenAI (ChatGPT)
 * Modelo padrão: gpt-4o-mini (mais barato e melhor)
 * Suporta outros modelos: gpt-3.5-turbo, gpt-4, gpt-4-turbo, gpt-4o, etc.
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string
  function_call?: {
    name: string
    arguments: string
  }
  name?: string // Nome da função quando role é 'function'
}

interface FunctionDefinition {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

interface OpenAIResponse {
  content: string
  functionCall?: {
    name: string
    arguments: any
  }
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Chama a API da OpenAI para gerar uma resposta usando ChatGPT
 * Suporta function calling para permitir que a IA execute ações
 */
export async function callChatGPT(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
    functions?: FunctionDefinition[]
  }
): Promise<OpenAIResponse> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada. Adicione a chave da API no arquivo .env')
  }

  const model = options?.model || 'gpt-4o-mini' // GPT-4o Mini (mais barato e melhor)
  const temperature = options?.temperature ?? 0.7
  const maxTokens = options?.maxTokens ?? 500

  const requestBody: any = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  }

  // Adiciona functions se fornecidas
  if (options?.functions && options.functions.length > 0) {
    requestBody.functions = options.functions
    requestBody.function_call = 'auto' // Permite que a IA escolha quando usar as funções
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Erro na API OpenAI: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`
      )
    }

    const data = await response.json()
    const message = data.choices[0]?.message

    // Verifica se a IA quer chamar uma função
    if (message.function_call) {
      let functionArgs: any = {}
      try {
        functionArgs = JSON.parse(message.function_call.arguments)
      } catch (e) {
        console.error('Erro ao parsear argumentos da função:', e)
      }

      return {
        content: message.content || '',
        functionCall: {
          name: message.function_call.name,
          arguments: functionArgs,
        },
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      }
    }

    return {
      content: message?.content || 'Desculpe, não consegui gerar uma resposta.',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    }
  } catch (error) {
    console.error('Erro ao chamar OpenAI:', error)
    throw error
  }
}

/**
 * Gera uma resposta de IA para uma mensagem do usuário
 * Usa o contexto da conversa e um prompt do sistema opcional
 * Suporta function calling para permitir ações automáticas
 * Implementa cache e métricas de uso
 */
export async function generateAIResponse(
  userMessage: string,
  context?: {
    systemPrompt?: string
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
    variables?: Record<string, any>
    temperature?: number
    maxTokens?: number
    functions?: FunctionDefinition[]
    onFunctionCall?: (functionName: string, args: any) => Promise<any>
    userId?: string
    instanceId?: string
    useCache?: boolean // Se deve usar cache (padrão: true)
  }
): Promise<string> {
  const startTime = Date.now()
  
  // Tenta obter do cache se habilitado
  if (context?.useCache !== false) {
    const { getCachedResponse } = await import('./ai-cache')
    const cached = getCachedResponse(userMessage, context?.systemPrompt, context?.variables)
    if (cached) {
      const duration = Date.now() - startTime
      const { recordAIMetric } = await import('./ai-metrics')
      // Registra métrica de cache de forma assíncrona
      recordAIMetric({
        userId: context?.userId,
        instanceId: context?.instanceId,
        model: 'gpt-4o-mini', // Modelo padrão
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        duration,
        cached: true,
        endpoint: 'chat',
      }).catch((error) => {
        console.error('Erro ao salvar métrica de cache (não bloqueia):', error)
      })
      return cached
    }
  }
  const messages: ChatMessage[] = []

  // Adiciona prompt do sistema se fornecido
  if (context?.systemPrompt) {
    messages.push({
      role: 'system',
      content: replaceVariables(context.systemPrompt, context.variables || {}),
    })
  } else {
    // Prompt padrão se não fornecido
    messages.push({
      role: 'system',
      content:
        'Você é um assistente virtual amigável e prestativo. Responda de forma clara, concisa e útil.',
    })
  }

  // Adiciona histórico da conversa se fornecido
  if (context?.conversationHistory) {
    for (const msg of context.conversationHistory) {
      messages.push({
        role: msg.role,
        content: replaceVariables(msg.content, context.variables || {}),
      })
    }
  }

  // Adiciona a mensagem atual do usuário
  messages.push({
    role: 'user',
    content: replaceVariables(userMessage, context?.variables || {}),
  })

  // Chama a API com function calling se disponível
  const { log } = await import('./logger')
  const model = 'gpt-4o-mini' // Modelo padrão usado
  
  log.debug('Chamando OpenAI', {
    messageCount: messages.length,
    hasFunctions: !!context?.functions && context.functions.length > 0,
    functions: context?.functions?.map(f => f.name) || [],
    model,
  })
  
  const response = await callChatGPT(messages, {
    model,
    temperature: context?.temperature,
    maxTokens: context?.maxTokens,
    functions: context?.functions,
  })

  log.debug('Resposta recebida da OpenAI', {
    hasFunctionCall: !!response.functionCall,
    functionName: response.functionCall?.name,
    tokens: response.usage?.totalTokens,
  })

  // Se não há function call, trata como resposta simples
  if (!response.functionCall || !context?.onFunctionCall) {
  // Registra métricas e armazena no cache para resposta simples
  const duration = Date.now() - startTime
  const { recordAIMetric } = await import('./ai-metrics')
  const { setCachedResponse, cacheConfig } = await import('./ai-cache')
  
  // Registra métricas de forma assíncrona (não bloqueia a resposta)
  recordAIMetric({
    userId: context?.userId,
    instanceId: context?.instanceId,
    model: model,
    promptTokens: response.usage?.promptTokens || 0,
    completionTokens: response.usage?.completionTokens || 0,
    totalTokens: response.usage?.totalTokens || 0,
    duration,
    cached: false,
    endpoint: 'chat',
  }).catch((error) => {
    console.error('Erro ao salvar métrica de IA (não bloqueia):', error)
  })

  // Armazena no cache
  if (context?.useCache !== false) {
    setCachedResponse(
      userMessage,
      response.content,
      context?.systemPrompt,
      context?.variables,
      cacheConfig.general
    )
  }

  return response.content
  }

  // Se a IA quer chamar uma função, executa e continua a conversa (com loop para múltiplas chamadas)
  let currentResponse = response
  let totalPromptTokens = response.usage?.promptTokens || 0
  let totalCompletionTokens = response.usage?.completionTokens || 0
  let totalTokens = response.usage?.totalTokens || 0
  const maxFunctionCalls = 10 // Limite de segurança para evitar loops infinitos
  
  for (let callCount = 0; callCount < maxFunctionCalls && currentResponse.functionCall && context?.onFunctionCall; callCount++) {
    const { log } = await import('./logger')
    log.debug('Executando função da IA', {
      functionName: currentResponse.functionCall.name,
      arguments: currentResponse.functionCall.arguments,
      callNumber: callCount + 1,
    })
    
    try {
      const functionResult = await context.onFunctionCall(
        currentResponse.functionCall.name,
        currentResponse.functionCall.arguments
      )
      
      log.debug('Função executada com sucesso', {
        functionName: currentResponse.functionCall.name,
        callNumber: callCount + 1,
      })

      // Adiciona a resposta da função e pede para a IA continuar
      messages.push({
        role: 'assistant',
        content: '',
        function_call: {
          name: currentResponse.functionCall.name,
          arguments: JSON.stringify(currentResponse.functionCall.arguments),
        },
      })

      messages.push({
        role: 'function',
        name: currentResponse.functionCall.name,
        content: JSON.stringify(functionResult),
      })

      // Chama novamente - a IA pode querer chamar outra função ou dar a resposta final
      currentResponse = await callChatGPT(messages, {
        temperature: context?.temperature,
        maxTokens: context?.maxTokens,
        functions: context?.functions,
      })

      // Acumula tokens
      totalPromptTokens += currentResponse.usage?.promptTokens || 0
      totalCompletionTokens += currentResponse.usage?.completionTokens || 0
      totalTokens += currentResponse.usage?.totalTokens || 0

      // Se a IA não quer mais chamar funções, sai do loop
      if (!currentResponse.functionCall) {
        break
      }
    } catch (error) {
      const { log } = await import('./logger')
      log.error('Erro ao executar função da IA', error, {
        functionName: currentResponse.functionCall?.name || 'unknown',
        arguments: currentResponse.functionCall?.arguments || '{}',
      })
      
      // Retorna mensagem de erro mais específica
      const errorMessage = error instanceof Error ? error.message : String(error)
      return `Desculpe, ocorreu um erro ao processar sua solicitação: ${errorMessage}. Por favor, tente novamente.`
    }
  }

  // Se saiu do loop porque ainda há function call (limite atingido), usa a última resposta
  if (currentResponse.functionCall) {
    const { log } = await import('./logger')
    log.warn('Limite de chamadas de função atingido', {
      functionName: currentResponse.functionCall.name,
      maxCalls: maxFunctionCalls,
    })
  }

  // Registra métricas e armazena no cache
  const duration = Date.now() - startTime
  const { recordAIMetric } = await import('./ai-metrics')
  const { setCachedResponse, cacheConfig } = await import('./ai-cache')
  
  // Registra métricas de forma assíncrona (não bloqueia a resposta)
  recordAIMetric({
    userId: context?.userId,
    instanceId: context?.instanceId,
    model: model,
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    totalTokens: totalTokens,
    duration,
    cached: false,
    endpoint: 'chat',
  }).catch((error) => {
    console.error('Erro ao salvar métrica de IA (não bloqueia):', error)
  })

  // Armazena no cache se não for função calling
  if (context?.useCache !== false && !currentResponse.functionCall) {
    setCachedResponse(
      userMessage,
      currentResponse.content,
      context?.systemPrompt,
      context?.variables,
      cacheConfig.general
    )
  }

  return currentResponse.content
}

/**
 * Substitui variáveis no texto (ex: {{nome}}, {{telefone}}, etc)
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

