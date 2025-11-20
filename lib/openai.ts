/**
 * Biblioteca de integração com OpenAI (ChatGPT)
 * Suporta ChatGPT Mini (gpt-3.5-turbo) e outros modelos
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Chama a API da OpenAI para gerar uma resposta usando ChatGPT
 */
export async function callChatGPT(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<OpenAIResponse> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada. Adicione a chave da API no arquivo .env')
  }

  const model = options?.model || 'gpt-3.5-turbo' // ChatGPT Mini
  const temperature = options?.temperature ?? 0.7
  const maxTokens = options?.maxTokens ?? 500

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Erro na API OpenAI: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`
      )
    }

    const data = await response.json()

    return {
      content: data.choices[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.',
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
 */
export async function generateAIResponse(
  userMessage: string,
  context?: {
    systemPrompt?: string
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
    variables?: Record<string, any>
    temperature?: number
    maxTokens?: number
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

  // Chama a API
  const response = await callChatGPT(messages, {
    temperature: context?.temperature,
    maxTokens: context?.maxTokens,
  })

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

