/**
 * Biblioteca de integração com OpenAI (ChatGPT)
 * Suporta ChatGPT Mini (gpt-3.5-turbo) e outros modelos
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

  const model = options?.model || 'gpt-3.5-turbo' // ChatGPT Mini
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
  }
): Promise<string> {
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
  console.log(`🤖 [generateAIResponse] Chamando OpenAI com ${messages.length} mensagens`)
  console.log(`🤖 [generateAIResponse] Funções disponíveis:`, context?.functions?.map(f => f.name).join(', ') || 'nenhuma')
  
  const response = await callChatGPT(messages, {
    temperature: context?.temperature,
    maxTokens: context?.maxTokens,
    functions: context?.functions,
  })

  console.log(`🤖 [generateAIResponse] Resposta recebida da OpenAI:`)
  console.log(`   - Tem função call? ${!!response.functionCall}`)
  if (response.functionCall) {
    console.log(`   - Nome da função: ${response.functionCall.name}`)
    console.log(`   - Argumentos:`, JSON.stringify(response.functionCall.arguments, null, 2))
  } else {
    console.log(`   - Conteúdo da resposta: ${response.content?.substring(0, 200)}...`)
  }

  // Se a IA quer chamar uma função, executa e continua a conversa
  if (response.functionCall && context?.onFunctionCall) {
    console.log(`🔧 [generateAIResponse] IA quer chamar função: ${response.functionCall.name}`)
    console.log(`🔧 [generateAIResponse] Argumentos:`, JSON.stringify(response.functionCall.arguments, null, 2))
    
    try {
      const functionResult = await context.onFunctionCall(
        response.functionCall.name,
        response.functionCall.arguments
      )
      
      console.log(`✅ [generateAIResponse] Função ${response.functionCall.name} executada com sucesso`)
      console.log(`📊 [generateAIResponse] Resultado:`, JSON.stringify(functionResult, null, 2))

      // Adiciona a resposta da função e pede para a IA continuar
      messages.push({
        role: 'assistant',
        content: '',
        function_call: {
          name: response.functionCall.name,
          arguments: JSON.stringify(response.functionCall.arguments),
        },
      })

      messages.push({
        role: 'function',
        name: response.functionCall.name,
        content: JSON.stringify(functionResult),
      })

      // Chama novamente para obter a resposta final
      const finalResponse = await callChatGPT(messages, {
        temperature: context?.temperature,
        maxTokens: context?.maxTokens,
        functions: context?.functions,
      })

      console.log(`✅ [generateAIResponse] Resposta final gerada após função`)
      return finalResponse.content
    } catch (error) {
      console.error('❌ [generateAIResponse] Erro ao executar função:', error)
      console.error('❌ [generateAIResponse] Stack trace:', error instanceof Error ? error.stack : 'N/A')
      console.error('❌ [generateAIResponse] Nome da função:', response.functionCall.name)
      console.error('❌ [generateAIResponse] Argumentos:', JSON.stringify(response.functionCall.arguments, null, 2))
      
      // Retorna mensagem de erro mais específica
      const errorMessage = error instanceof Error ? error.message : String(error)
      return `Desculpe, ocorreu um erro ao processar sua solicitação: ${errorMessage}. Por favor, tente novamente.`
    }
  }

  return response.content
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

