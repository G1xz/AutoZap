'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface Conversation {
  contactNumber: string
  contactName: string | null
  profilePictureUrl?: string | null
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  instanceId: string
  instanceName: string
  status?: string
}

interface Message {
  id: string
  from: string
  to: string
  body: string
  timestamp: Date
  isFromMe: boolean
  messageId: string
  messageType?: string
  interactiveData?: string | null
}

type ChatTab = 'active' | 'waiting_human' | 'closed'

export default function ChatManager() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<ChatTab>('active')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const previousConversationsRef = useRef<Conversation[]>([])

  // Notificação sonora quando conversa vai para "aguardando resposta"
  useEffect(() => {
    if (conversations.length > 0 && previousConversationsRef.current.length > 0) {
      // Verifica se alguma conversa mudou para "waiting_human"
      const newWaitingHuman = conversations.filter(c => c.status === 'waiting_human')
      const previousWaitingHuman = previousConversationsRef.current.filter(c => c.status === 'waiting_human')
      
      // Se há uma nova conversa em "waiting_human" que não estava antes
      const newConversations = newWaitingHuman.filter(newConv => 
        !previousWaitingHuman.some(prevConv => 
          prevConv.instanceId === newConv.instanceId && 
          prevConv.contactNumber === newConv.contactNumber
        )
      )
      
      if (newConversations.length > 0) {
        // Toca notificação sonora
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZijcIGWi77+efTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yo3CBlou+/nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC')
          audio.volume = 0.5
          audio.play().catch(err => console.log('Erro ao tocar notificação:', err))
        } catch (error) {
          // Fallback: usa beep do sistema
          if (typeof window !== 'undefined' && 'AudioContext' in window) {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()
            
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)
            
            oscillator.frequency.value = 800
            oscillator.type = 'sine'
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
            
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + 0.3)
          }
        }
      }
    }
    previousConversationsRef.current = conversations
  }, [conversations])

  // Carrega conversas quando muda a aba
  useEffect(() => {
    fetchConversations(activeTab)
    // Atualiza a cada 5 segundos
    const interval = setInterval(() => fetchConversations(activeTab), 5000)
    return () => clearInterval(interval)
  }, [activeTab])

  // Carrega mensagens quando seleciona uma conversa
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.instanceId, selectedConversation.contactNumber)
      // Atualiza mensagens a cada 3 segundos quando uma conversa está aberta
      const interval = setInterval(() => {
        fetchMessages(selectedConversation.instanceId, selectedConversation.contactNumber)
      }, 3000)
      // Em mobile, oculta a sidebar quando uma conversa é selecionada
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setShowSidebar(false)
      }
      return () => clearInterval(interval)
    }
  }, [selectedConversation])

  // Ajusta showSidebar quando a janela é redimensionada
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setShowSidebar(true)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Scroll automático para a última mensagem
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (messages.length > 0 && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [messages])

  const fetchConversations = async (status?: ChatTab) => {
    try {
      const statusParam = status || activeTab
      const url = statusParam === 'active' 
        ? '/api/chat/conversations?status=active'
        : `/api/chat/conversations?status=${statusParam}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setConversations(data)
      }
    } catch (error) {
      console.error('Erro ao buscar conversas:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (instanceId: string, contactNumber: string) => {
    try {
      const response = await fetch(
        `/api/chat/messages?instanceId=${instanceId}&contactNumber=${contactNumber}&limit=100`
      )
      if (response.ok) {
        const data = await response.json()
        // Se a API retornar objeto com messages, usa ele, senão usa o array direto
        if (data.messages) {
          setMessages(data.messages)
        } else {
          setMessages(data)
        }
      }
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error)
    }
  }

  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return

    setSending(true)
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedConversation.instanceId,
          to: selectedConversation.contactNumber,
          message: newMessage,
        }),
      })

      if (response.ok) {
        setNewMessage('')
        // Atualiza mensagens imediatamente
        await fetchMessages(selectedConversation.instanceId, selectedConversation.contactNumber)
        // Atualiza conversas para mostrar a última mensagem
        await fetchConversations(activeTab)
      } else {
        const error = await response.json()
        alert(error.error || 'Erro ao enviar mensagem')
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      alert('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Ontem'
    } else if (days < 7) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }
  }

  const formatMessageTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatPhoneNumber = (phone: string) => {
    // Formata número brasileiro: (XX) XXXXX-XXXX
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const ddd = cleaned.substring(2, 4)
      const firstPart = cleaned.substring(4, 9)
      const secondPart = cleaned.substring(9, 13)
      return `+55 (${ddd}) ${firstPart}-${secondPart}`
    } else if (cleaned.length === 11) {
      const ddd = cleaned.substring(0, 2)
      const firstPart = cleaned.substring(2, 7)
      const secondPart = cleaned.substring(7, 11)
      return `(${ddd}) ${firstPart}-${secondPart}`
    }
    return phone
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-700">Carregando conversas...</div>
  }

  return (
    <div className="flex h-[calc(100vh-200px)] sm:h-[calc(100vh-200px)] bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm relative">
      {/* Lista de conversas */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} sm:flex absolute sm:relative inset-0 sm:inset-auto z-20 sm:z-auto w-full sm:w-1/3 border-r border-gray-200 flex-col bg-gray-50`}>
        {/* Abas de status */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'active'
                  ? 'bg-autozap-primary text-white border-b-2 border-autozap-primary'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">Em Atendimento</span>
              <span className="sm:hidden">Ativos</span>
            </button>
            <button
              onClick={() => setActiveTab('waiting_human')}
              className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'waiting_human'
                  ? 'bg-orange-600 text-white border-b-2 border-orange-400'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">Aguardando Resposta</span>
              <span className="sm:hidden">Aguardando</span>
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={`flex-1 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'closed'
                  ? 'bg-gray-700 text-white border-b-2 border-gray-500'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Encerrados
            </button>
          </div>
        </div>
        
        <div className="p-4 border-b border-gray-200 bg-white">
          <p className="text-sm text-gray-600">
            {conversations.length} {conversations.length === 1 ? 'conversa' : 'conversas'}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Nenhuma conversa ainda
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={`${conv.instanceId}-${conv.contactNumber}`}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 text-left border-b border-gray-200 hover:bg-gray-100 transition-colors ${
                  selectedConversation?.contactNumber === conv.contactNumber &&
                  selectedConversation?.instanceId === conv.instanceId
                    ? 'bg-gray-200'
                    : 'bg-white'
                }`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  {/* Avatar */}
                  {conv.profilePictureUrl ? (
                    <img
                      src={conv.profilePictureUrl}
                      alt={conv.contactName || conv.contactNumber}
                      className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover"
                      onError={(e) => {
                        // Fallback para inicial se a imagem falhar
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const fallback = target.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div 
                    className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-autozap-primary flex items-center justify-center text-white font-semibold text-base sm:text-lg ${conv.profilePictureUrl ? 'hidden' : ''}`}
                  >
                    {(conv.contactName || conv.contactNumber).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                        {conv.contactName || formatPhoneNumber(conv.contactNumber)}
                      </h3>
                      {conv.unreadCount > 0 && (
                        <span className="bg-autozap-primary text-white text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 truncate mt-1">
                      {conv.lastMessage}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 truncate">
                        {conv.instanceName}
                      </span>
                      <span className="text-xs text-gray-500 hidden sm:inline">
                        • {formatTime(conv.lastMessageTime)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Área de chat */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header do chat */}
            <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2 sm:gap-3">
              {/* Botão voltar (mobile) */}
              <button
                onClick={() => {
                  setSelectedConversation(null)
                  setShowSidebar(true)
                }}
                className="sm:hidden mr-1 p-1 hover:bg-gray-200 rounded transition-colors"
                aria-label="Voltar para lista de conversas"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {selectedConversation.profilePictureUrl ? (
                <img
                  src={selectedConversation.profilePictureUrl}
                  alt={selectedConversation.contactName || selectedConversation.contactNumber}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0"
                  onError={(e) => {
                    // Fallback para inicial se a imagem falhar
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const fallback = target.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
              ) : null}
              <div 
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-autozap-primary flex items-center justify-center text-white font-semibold text-base sm:text-lg flex-shrink-0 ${selectedConversation.profilePictureUrl ? 'hidden' : ''}`}
              >
                {(selectedConversation.contactName || selectedConversation.contactNumber).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                  {selectedConversation.contactName || formatPhoneNumber(selectedConversation.contactNumber)}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  {selectedConversation.instanceName}
                </p>
              </div>
              {/* Botão excluir chat */}
              <button
                onClick={async () => {
                  if (!selectedConversation) return
                  
                  const confirmDelete = window.confirm(
                    `Tem certeza que deseja excluir todas as mensagens desta conversa com ${selectedConversation.contactName || formatPhoneNumber(selectedConversation.contactNumber)}?\n\nEsta ação não pode ser desfeita.`
                  )
                  
                  if (!confirmDelete) return
                  
                  try {
                    const response = await fetch(
                      `/api/chat/conversations?instanceId=${selectedConversation.instanceId}&contactNumber=${selectedConversation.contactNumber}`,
                      {
                        method: 'DELETE',
                      }
                    )
                    
                    if (response.ok) {
                      // Atualiza a lista de conversas
                      fetchConversations(activeTab)
                      // Fecha o chat atual
                      setSelectedConversation(null)
                      setMessages([])
                    } else {
                      const error = await response.json()
                      alert(`Erro ao excluir conversa: ${error.error || 'Erro desconhecido'}`)
                    }
                  } catch (error) {
                    console.error('Erro ao excluir conversa:', error)
                    alert('Erro ao excluir conversa. Tente novamente.')
                  }
                }}
                className="p-2 hover:bg-red-100 rounded transition-colors text-red-600"
                aria-label="Excluir conversa"
                title="Excluir todas as mensagens desta conversa"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Nenhuma mensagem ainda
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    // Tenta parsear dados interativos se existirem
                    let buttons: Array<{ id: string; title: string }> | null = null
                    if (msg.messageType === 'interactive' && msg.interactiveData) {
                      try {
                        const interactiveData = JSON.parse(msg.interactiveData)
                        buttons = interactiveData.buttons || null
                      } catch (e) {
                        console.error('Erro ao parsear interactiveData:', e)
                      }
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 ${
                            msg.isFromMe
                              ? 'bg-autozap-primary text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}
                        >
                          <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          
                          {/* Mostra botões se for mensagem interativa */}
                          {buttons && buttons.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {buttons.map((button) => (
                                <div
                                  key={button.id}
                                  className={`px-3 py-1.5 rounded text-xs border ${
                                    msg.isFromMe
                                      ? 'bg-white/10 border-white/20 text-white'
                                      : 'bg-gray-50 border-gray-300 text-gray-700'
                                  }`}
                                >
                                  {button.title}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <p
                            className={`text-xs mt-1 ${
                              msg.isFromMe ? 'text-white/70' : 'text-gray-500'
                            }`}
                          >
                            {formatMessageTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input de mensagem */}
            <div className="p-2 sm:p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent bg-white text-gray-900 placeholder-gray-400"
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="px-4 sm:px-6 py-1.5 sm:py-2 text-sm sm:text-base bg-autozap-primary text-white rounded-md hover:bg-autozap-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? '...' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50">
            Selecione uma conversa para começar
          </div>
        )}
      </div>
    </div>
  )
}

