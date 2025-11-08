'use client'

import { useState, useEffect } from 'react'

interface WhatsAppCloudConfigProps {
  instanceId: string
  onClose: () => void
  onSuccess: () => void
}

export default function WhatsAppCloudConfig({
  instanceId,
  onClose,
  onSuccess,
}: WhatsAppCloudConfigProps) {
  const [formData, setFormData] = useState({
    phoneId: '',
    accessToken: '',
    appId: '',
    appSecret: '',
    businessAccountId: '',
    phone: '',
    webhookVerifyToken: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [localtunnelUrl, setLocaltunnelUrl] = useState('')

  // Carrega URL do localtunnel
  useEffect(() => {
    fetch('/api/config/localtunnel')
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          setLocaltunnelUrl(data.url)
        } else {
          const savedUrl = localStorage.getItem('localtunnelUrl') || ''
          setLocaltunnelUrl(savedUrl)
        }
      })
      .catch(() => {
        const savedUrl = localStorage.getItem('localtunnelUrl') || ''
        setLocaltunnelUrl(savedUrl)
      })
  }, [])

  // Carrega configuração existente ao abrir
  useEffect(() => {
    fetch(`/api/whatsapp/config?instanceId=${instanceId}`)
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setFormData({
            phoneId: data.phoneId || '',
            accessToken: '', // Não mostrar token por segurança
            appId: data.appId || '',
            appSecret: '', // Não mostrar secret por segurança
            businessAccountId: data.businessAccountId || '',
            phone: data.phone || '',
            webhookVerifyToken: data.webhookVerifyToken || '',
          })
        }
      })
      .catch(() => {
        // Ignora erro se não houver configuração
      })
  }, [instanceId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId,
          ...formData,
        }),
      })

      if (response.ok) {
        onSuccess()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || 'Erro ao configurar')
      }
    } catch (err) {
      setError('Erro ao configurar instância')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Configurar WhatsApp Cloud API</h2>
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            <strong>💡 Como funciona:</strong> Você já adicionou o número do cliente na <strong>sua conta Meta Business</strong> (via Gerenciador do WhatsApp). 
            Agora você só precisa do <strong>Phone Number ID</strong> específico daquele número. Use o mesmo <strong>Access Token</strong> que você já tem (mesmo para todos os números).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number ID *
            </label>
            <input
              type="text"
              value={formData.phoneId}
              onChange={(e) => setFormData({ ...formData, phoneId: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary"
              placeholder="Ex: 123456789012345"
            />
            <p className="mt-1 text-xs text-gray-500">
              Encontre em: <strong>Meta for Developers</strong> → Seu App → <strong>WhatsApp</strong> → <strong>Configuração Inicial</strong> → <strong>ID do número de telefone</strong>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Token *
            </label>
            <input
              type="password"
              value={formData.accessToken}
              onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary"
              placeholder="Token de acesso permanente"
            />
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-xs font-semibold text-yellow-900 mb-2">
              ⚠️ Para usar em produção (definitivo):
              </p>
              <ol className="text-xs text-yellow-800 list-decimal list-inside space-y-1">
                <li>Acesse: <strong>Meta for Developers</strong> → Seu App → <strong>WhatsApp</strong> → <strong>Configuração Inicial</strong></li>
                <li>Role até a seção <strong>"Token de acesso"</strong></li>
                <li>Clique em <strong>"Gerar token"</strong> ou <strong>"Renovar token"</strong></li>
                <li>Selecione sua <strong>Meta Business Account</strong> e <strong>WhatsApp Business Account</strong></li>
                <li>Copie o token gerado e cole aqui</li>
                <li><strong>Importante:</strong> Tokens temporários expiram em 24h. Use tokens permanentes para produção!</li>
              </ol>
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#get-access-token"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-yellow-900 underline mt-2 inline-block"
              >
                📖 Ver guia oficial da Meta →
              </a>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de Telefone
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary"
              placeholder="Ex: 5511999999999"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App ID (recomendado)
              </label>
              <input
                type="text"
                value={formData.appId}
                onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary"
                placeholder="ID do seu app Meta"
              />
              <p className="mt-1 text-xs text-gray-500">
                Encontre em: <strong>Meta for Developers</strong> → Seu App → <strong>Configurações</strong> → <strong>Básico</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Account ID (recomendado)
              </label>
              <input
                type="text"
                value={formData.businessAccountId}
                onChange={(e) =>
                  setFormData({ ...formData, businessAccountId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary"
                placeholder="ID da conta de negócios"
              />
              <p className="mt-1 text-xs text-gray-500">
                Encontre em: <strong>Meta Business Suite</strong> → <strong>Configurações</strong> → <strong>Contas</strong>
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Webhook Verify Token
            </label>
            <input
              type="text"
              value={formData.webhookVerifyToken}
              onChange={(e) =>
                setFormData({ ...formData, webhookVerifyToken: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary"
              placeholder="Deixe em branco para gerar automaticamente"
            />
            <p className="mt-1 text-xs text-gray-500">
              Use este token ao configurar o webhook no Meta for Developers
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">📡 URL do Webhook:</h3>
            <code className="text-sm text-blue-800 break-all block bg-blue-100 p-2 rounded mb-2">
              {typeof window !== 'undefined'
                ? (window.location.hostname === 'localhost' && localtunnelUrl
                    ? `${localtunnelUrl}/api/whatsapp/webhook?instanceId=${instanceId}`
                    : `${window.location.origin}/api/whatsapp/webhook?instanceId=${instanceId}`)
                : 'Carregando...'}
            </code>
            <div className="mt-2 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Como configurar o webhook na Meta:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Acesse: <strong>Meta for Developers</strong> → Seu App → <strong>WhatsApp</strong> → <strong>Configuração</strong></li>
                <li>Role até a seção <strong>"Webhooks"</strong></li>
                <li>Clique em <strong>"Configurar webhooks"</strong> ou <strong>"Editar"</strong></li>
                <li>Cole a URL acima no campo <strong>"URL de retorno de chamada"</strong></li>
                <li>Cole o <strong>Webhook Verify Token</strong> (gerado acima) no campo correspondente</li>
                <li>Marque os eventos: <strong>messages</strong> e <strong>messaging_postbacks</strong></li>
                <li>Clique em <strong>"Verificar e salvar"</strong></li>
              </ol>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-dark disabled:opacity-50"
            >
              {loading ? 'Configurando...' : 'Salvar Configuração'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

