'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import WhatsAppCloudConfig from './WhatsAppCloudConfig'

interface WhatsAppInstance {
  id: string
  name: string
  phone: string | null
  phoneId: string | null
  status: string
  createdAt: string
}

export default function WhatsAppInstanceManager() {
  const { data: session } = useSession()
  const [instances, setInstances] = useState<WhatsAppInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [newInstanceName, setNewInstanceName] = useState('')
  const [creating, setCreating] = useState(false)
  const [configuringInstance, setConfiguringInstance] = useState<string | null>(null)
  const [localtunnelUrl, setLocaltunnelUrl] = useState('')

  // Função helper para copiar texto de forma segura
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      // Fallback: cria elemento temporário e copia
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      textArea.style.pointerEvents = 'none'
      document.body.appendChild(textArea)
      textArea.select()
      textArea.setSelectionRange(0, 99999) // Para mobile
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }

  useEffect(() => {
    fetchInstances()
    const interval = setInterval(() => {
      fetchInstances()
    }, 5000) // Atualiza a cada 5 segundos

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Carrega URL do servidor primeiro, depois do localStorage
    fetch('/api/config/localtunnel')
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setLocaltunnelUrl(data.url)
          localStorage.setItem('localtunnelUrl', data.url)
        } else {
          const savedUrl = localStorage.getItem('localtunnelUrl') || 'https://loose-symbols-fall.loca.lt'
          setLocaltunnelUrl(savedUrl)
          // Salva no servidor também
          fetch('/api/config/localtunnel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: savedUrl }),
          }).catch(() => {})
        }
      })
      .catch(() => {
        // Fallback para localStorage
        const savedUrl = localStorage.getItem('localtunnelUrl') || 'https://loose-symbols-fall.loca.lt'
        setLocaltunnelUrl(savedUrl)
      })
  }, [])

  const fetchInstances = async () => {
    try {
      const response = await fetch('/api/whatsapp/instances')
      if (response.ok) {
        const data = await response.json()
        setInstances(data)
      }
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error)
    } finally {
      setLoading(false)
    }
  }

  const createInstance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newInstanceName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/whatsapp/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newInstanceName }),
      })

      if (response.ok) {
        setNewInstanceName('')
        fetchInstances()
      } else {
        const data = await response.json()
        alert(data.error || 'Erro ao criar instância')
      }
    } catch (error) {
      console.error('Erro ao criar instância:', error)
      alert('Erro ao criar instância')
    } finally {
      setCreating(false)
    }
  }

  const disconnectInstance = async (id: string) => {
    if (!confirm('Tem certeza que deseja desconectar esta instância?')) return

    try {
      const response = await fetch(`/api/whatsapp/instances/${id}/disconnect`, {
        method: 'POST',
      })

      if (response.ok) {
        fetchInstances()
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error)
    }
  }

  const deleteInstance = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta instância?')) return

    try {
      const response = await fetch(`/api/whatsapp/instances/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchInstances()
      }
    } catch (error) {
      console.error('Erro ao excluir:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'verified':
        return 'bg-autozap-light text-autozap-dark'
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-autozap-gray-medium text-white'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'connected':
      case 'verified':
        return 'Conectado'
      case 'connecting':
        return 'Conectando...'
      default:
        return 'Não configurado'
    }
  }

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-autozap-gray-medium/20 border border-autozap-gray-medium rounded-lg p-4">
        <h3 className="font-semibold text-autozap-white mb-2">
          📱 WhatsApp Cloud API - Configuração
        </h3>
        <div className="mb-3">
          <label className="block text-sm font-medium text-autozap-white mb-1">
            URL do Localtunnel (ex: https://exemplo.loca.lt):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={localtunnelUrl}
              onChange={(e) => {
                setLocaltunnelUrl(e.target.value)
                localStorage.setItem('localtunnelUrl', e.target.value)
                // Salva no servidor também
                fetch('/api/config/localtunnel', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: e.target.value }),
                }).catch(() => {}) // Ignora erros silenciosamente
              }}
              placeholder="https://exemplo.loca.lt"
              className="flex-1 px-4 py-2 border border-autozap-gray-medium rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent bg-autozap-gray-dark text-autozap-white placeholder-autozap-gray-medium"
            />
            <button
              onClick={() => {
                const url = prompt('Cole a URL do localtunnel:', localtunnelUrl)
                if (url) {
                  setLocaltunnelUrl(url)
                  localStorage.setItem('localtunnelUrl', url)
                  // Salva no servidor também
                  fetch('/api/config/localtunnel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                  }).catch(() => {})
                }
              }}
              className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light text-sm transition-colors"
            >
              Atualizar
            </button>
          </div>
          <p className="text-xs text-autozap-gray-medium mt-1">
            Cole aqui a URL que aparece quando você roda o localtunnel
          </p>
        </div>
        <p className="text-sm text-autozap-gray-medium">
          Para usar a WhatsApp Cloud API, você precisa:
        </p>
        <ol className="list-decimal list-inside text-sm text-autozap-gray-medium mt-2 space-y-1">
          <li>Criar uma conta Meta Business</li>
          <li>Criar um app no Meta for Developers</li>
          <li>Configurar WhatsApp no app</li>
          <li>Obter Phone Number ID e Access Token</li>
          <li>Configurar o webhook nesta instância</li>
        </ol>
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
          target="_blank"
          rel="noopener noreferrer"
          className="text-autozap-primary hover:text-autozap-light hover:underline text-sm mt-2 inline-block transition-colors"
        >
          📖 Ver guia completo de configuração
        </a>
      </div>

      <form onSubmit={createInstance} className="flex gap-4">
        <input
          type="text"
          value={newInstanceName}
          onChange={(e) => setNewInstanceName(e.target.value)}
          placeholder="Nome da instância (ex: WhatsApp Principal)"
          className="flex-1 px-4 py-2 border border-autozap-gray-medium rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent bg-autozap-gray-dark text-autozap-white placeholder-autozap-gray-medium"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="px-6 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light disabled:opacity-50 transition-colors"
        >
          {creating ? 'Criando...' : 'Criar Instância'}
        </button>
      </form>

      <div className="space-y-4">
        {instances.length === 0 ? (
          <p className="text-center text-autozap-gray-medium py-8">
            Nenhuma instância criada ainda. Crie uma acima para começar.
          </p>
        ) : (
          instances.map((instance) => (
            <div
              key={instance.id}
              className="border border-autozap-gray-medium rounded-lg p-4 bg-autozap-gray-dark"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg text-autozap-white">{instance.name}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs ${getStatusColor(
                    instance.status
                  )}`}
                >
                  {getStatusLabel(instance.status)}
                </span>
              </div>
                <div className="text-sm text-autozap-gray-medium space-y-1">
                  <p>Telefone: {instance.phone || 'Não configurado'}</p>
                  {instance.phoneId && <p>Phone ID: {instance.phoneId}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-xs">Instance ID:</p>
                    <code className="text-xs bg-autozap-gray-medium/50 px-2 py-1 rounded text-autozap-white">
                      {instance.id}
                    </code>
                    <button
                      onClick={() => copyToClipboard(instance.id)}
                      className="text-xs px-2 py-1 bg-autozap-primary text-white rounded hover:bg-autozap-light transition-colors"
                    >
                      Copiar ID
                    </button>
                  </div>
                </div>
              <div className="flex gap-2 mt-4">
                {(instance.status === 'disconnected' || !instance.phoneId) && (
                  <button
                    onClick={() => setConfiguringInstance(instance.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Configurar API
                  </button>
                )}
                {(instance.status === 'connected' || instance.status === 'verified') && (
                  <>
                    <button
                      onClick={() => setConfiguringInstance(instance.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      Reconfigurar
                    </button>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/api/whatsapp/webhook?instanceId=${instance.id}`
                        copyToClipboard(url)
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                    >
                      Copiar URL Webhook
                    </button>
                    <button
                      onClick={() => disconnectInstance(instance.id)}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm"
                    >
                      Desconectar
                    </button>
                  </>
                )}
                <button
                  onClick={() => deleteInstance(instance.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  Excluir
                </button>
              </div>
              {instance.status === 'connected' || instance.status === 'verified' ? (
                <div className="mt-3 bg-autozap-gray-medium/20 border border-autozap-gray-medium rounded p-3 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-autozap-white mb-2">📋 Configuração do Webhook:</p>
                    
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-autozap-gray-medium mb-1">1️⃣ URL do Webhook (use se estiver usando localtunnel):</p>
                        <div className="flex gap-2 items-center">
                          <code className="flex-1 text-xs text-autozap-white break-all bg-autozap-gray-dark px-2 py-1 rounded">
                            {localtunnelUrl ? `${localtunnelUrl}/api/whatsapp/webhook?instanceId=${instance.id}` : 'Configure a URL do localtunnel acima'}
                          </code>
                          <button
                            onClick={() => {
                              const url = localtunnelUrl ? `${localtunnelUrl}/api/whatsapp/webhook?instanceId=${instance.id}` : ''
                              if (url) {
                                copyToClipboard(url)
                              } else {
                                alert('Configure a URL do localtunnel primeiro!')
                              }
                            }}
                            className="px-3 py-1 bg-autozap-primary text-white rounded text-xs hover:bg-autozap-light transition-colors whitespace-nowrap"
                          >
                            Copiar URL
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-autozap-gray-medium mb-1">2️⃣ Token de Verificação:</p>
                        <div className="flex gap-2 items-center">
                          <code className="flex-1 text-xs text-autozap-white break-all bg-autozap-gray-dark px-2 py-1 rounded">
                            {instance.webhookVerifyToken || 'Não configurado'}
                          </code>
                          <button
                            onClick={() => {
                              fetch(`/api/whatsapp/config?instanceId=${instance.id}`)
                                .then(res => res.json())
                                .then(async (data) => {
                                  const token = data.webhookVerifyToken || `verify_${instance.id}`
                                  await copyToClipboard(token)
                                })
                                .catch(async () => {
                                  const token = `verify_${instance.id}`
                                  await copyToClipboard(token)
                                })
                            }}
                            className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors whitespace-nowrap"
                          >
                            Copiar Token
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-autozap-gray-medium">
                        <button
                          onClick={async () => {
                            // Copia URL primeiro
                            const url = localtunnelUrl ? `${localtunnelUrl}/api/whatsapp/webhook?instanceId=${instance.id}` : ''
                            if (!url) {
                              alert('Configure a URL do localtunnel primeiro!')
                              return
                            }
                            await copyToClipboard(url)
                            
                            // Aguarda um pouco e copia o token
                            setTimeout(async () => {
                              try {
                                const res = await fetch(`/api/whatsapp/config?instanceId=${instance.id}`)
                                const data = await res.json()
                                const token = data.webhookVerifyToken || `verify_${instance.id}`
                                await copyToClipboard(token)
                              } catch {
                                const token = `verify_${instance.id}`
                                await copyToClipboard(token)
                              }
                            }, 500)
                          }}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors font-semibold"
                        >
                          📋 Copiar Tudo (URL → Token)
                        </button>
                        <p className="text-xs text-autozap-gray-medium mt-1 text-center">
                          Copia primeiro a URL, depois o Token automaticamente
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {configuringInstance && (
        <WhatsAppCloudConfig
          instanceId={configuringInstance}
          onClose={() => setConfiguringInstance(null)}
          onSuccess={() => {
            fetchInstances()
            setConfiguringInstance(null)
          }}
        />
      )}
    </div>
  )
}
