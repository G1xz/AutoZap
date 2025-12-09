'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  mediaUrl?: string | null // URL da imagem se houver
}

export default function TestChatPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [contactNumber, setContactNumber] = useState('5511999999999')
  const [contactName, setContactName] = useState('Teste')
  const [logs, setLogs] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])


  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR')
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    addLog(`📤 Enviando mensagem: "${input}"`)

    try {
      const response = await fetch('/api/test-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactNumber,
          contactName,
          message: input,
        }),
      })

      const data = await response.json()

      if (data.error) {
        addLog(`❌ Erro: ${data.error}`)
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ Erro: ${data.error}`,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMessage])
      } else {
        addLog(`✅ Resposta recebida: ${data.response.substring(0, 50)}...`)
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          mediaUrl: data.mediaUrl || null, // Inclui URL da imagem se houver
        }
        setMessages(prev => [...prev, assistantMessage])

        // Adiciona logs do servidor se disponíveis
        if (data.logs && Array.isArray(data.logs)) {
          data.logs.forEach((log: string) => addLog(log))
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      addLog(`❌ Erro ao enviar mensagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Erro ao processar mensagem. Verifique os logs.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setLogs([])
    addLog('🧹 Chat limpo')
  }

  if (status === 'loading') {
    return <div className="p-4">Carregando...</div>
  }

  if (!session) {
    return null
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">🧪 Chat de Teste - IA</h1>
        <button
          onClick={clearChat}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
        >
          Limpar Chat
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>💡 Como usar:</strong> Configure as credenciais abaixo e teste a IA como se fosse o WhatsApp.
          Os logs aparecem em tempo real na área de logs abaixo.
        </p>
      </div>

      {/* Configurações */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">⚙️ Configurações</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número (apenas dígitos)
            </label>
            <input
              type="text"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="5511999999999"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Contato
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nome do teste"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Área de Chat */}
        <div className="bg-white border border-gray-200 rounded-lg flex flex-col" style={{ height: '600px' }}>
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">💬 Chat</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>Nenhuma mensagem ainda.</p>
                <p className="text-sm mt-2">Digite uma mensagem abaixo para começar!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {/* Exibe imagem se houver */}
                    {message.mediaUrl && (
                      <div className="mb-2 rounded overflow-hidden">
                        <img
                          src={message.mediaUrl}
                          alt="Anexo"
                          className="max-w-full h-auto max-h-64 object-contain rounded"
                          onError={(e) => {
                            // Se a imagem falhar ao carregar, esconde o elemento
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs mt-1 opacity-70">
                      {message.timestamp.toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <p className="text-sm text-gray-500">Digitando...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Digite sua mensagem..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>

        {/* Área de Logs */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg flex flex-col" style={{ height: '600px' }}>
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-semibold text-white">📋 Logs do Sistema</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
            {logs.length === 0 ? (
              <div className="text-gray-500 mt-8 text-center">
                <p>Nenhum log ainda.</p>
                <p className="text-sm mt-2">Os logs aparecerão aqui quando você enviar mensagens.</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-green-400 mb-1">
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Dica:</strong> Procure nos logs por <code className="bg-blue-100 px-1 rounded">🛒 [add_to_cart]</code> ou <code className="bg-blue-100 px-1 rounded">🔧 [interceptedFunctionCall]</code> para ver se a função está sendo chamada.
        </p>
      </div>
    </div>
  )
}

