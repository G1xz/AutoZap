'use client'

import { useState, useEffect, useRef } from 'react'

interface WhatsAppFacebookConnectionProps {
  instanceId: string
  onClose: () => void
  onSuccess: () => void
}

export default function WhatsAppFacebookConnection({
  instanceId,
  onClose,
  onSuccess,
}: WhatsAppFacebookConnectionProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const popupRef = useRef<Window | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Limpa intervalos quando o componente desmonta
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close()
      }
    }
  }, [])

  // Listener para mensagens da janela popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verifica se a mensagem é do callback do Facebook
      if (event.data && event.data.type === 'FACEBOOK_OAUTH_SUCCESS') {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close()
        }
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current)
        }
        setConnecting(false)
        onSuccess()
        onClose()
      } else if (event.data && event.data.type === 'FACEBOOK_OAUTH_ERROR') {
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close()
        }
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current)
        }
        setConnecting(false)
        setError(event.data.message || 'Erro ao conectar')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onSuccess, onClose])

  const startConnection = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/whatsapp/connect-facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setAuthUrl(data.authUrl)
        setConnecting(true)
        
        // Abre em nova janela para o cliente autorizar
        popupRef.current = window.open(
          data.authUrl, 
          'facebook-auth', 
          'width=600,height=700,scrollbars=yes,resizable=yes'
        )
        
        if (!popupRef.current) {
          setError('Por favor, permita pop-ups para este site')
          setConnecting(false)
          return
        }
        
        // Verifica se a conexão foi estabelecida (polling)
        checkIntervalRef.current = setInterval(async () => {
          try {
            // Verifica se a janela foi fechada
            if (popupRef.current?.closed) {
              if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current)
              }
              setConnecting(false)
              return
            }

            const checkResponse = await fetch(`/api/whatsapp/instances`)
            const instances = await checkResponse.json()
            const instance = instances.find((i: any) => i.id === instanceId)
            
            if (instance && (instance.status === 'connected' || instance.status === 'verified')) {
              if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current)
              }
              if (popupRef.current && !popupRef.current.closed) {
                popupRef.current.close()
              }
              setConnecting(false)
              onSuccess()
              onClose()
            }
          } catch (err) {
            console.error('Erro ao verificar conexão:', err)
          }
        }, 1500) // Verifica a cada 1.5 segundos

        // Para o polling após 5 minutos
        setTimeout(() => {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current)
          }
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close()
          }
          setConnecting(false)
        }, 5 * 60 * 1000)
      } else {
        setError(data.error || 'Erro ao iniciar conexão')
      }
    } catch (err) {
      setError('Erro ao iniciar conexão')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Conectar via Facebook</h2>
        <p className="text-sm text-gray-600 mb-4">
          Cliente autoriza via Facebook e você obtém as credenciais automaticamente
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-900 mb-2">📱 Como funciona:</h3>
          <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
            <li>Cliente clica em "Conectar com Facebook"</li>
            <li>Cliente faz login no Facebook e autoriza o acesso</li>
            <li>Sistema obtém automaticamente Phone Number ID e Access Token</li>
            <li>Conexão estabelecida! Cliente não precisa colocar cartão</li>
          </ol>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-yellow-800">
            ⚠️ <strong>Importante:</strong> O cliente precisa ter uma conta Meta Business com WhatsApp Business configurado.
            A cobrança será feita na sua conta, não na conta do cliente.
          </p>
        </div>

        {authUrl && (
          <div className="mb-4">
            <p className="text-sm text-gray-700 mb-2">URL de autorização:</p>
            <a
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm break-all"
            >
              {authUrl}
            </a>
          </div>
        )}

        {connecting && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-800">
              ⏳ Aguardando autorização no Facebook... Verificando conexão a cada 1.5 segundos.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={startConnection}
            disabled={loading || connecting}
            className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading || connecting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {connecting ? 'Aguardando autorização...' : 'Conectando...'}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Conectar com Facebook
              </>
            )}
          </button>
          <button
            onClick={() => {
              if (popupRef.current && !popupRef.current.closed) {
                popupRef.current.close()
              }
              if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current)
              }
              setConnecting(false)
              onClose()
            }}
            disabled={connecting}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50"
          >
            {connecting ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}

