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
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              placeholder="Ex: 123456789012345"
            />
            <p className="mt-1 text-xs text-gray-500">
              Encontre em: Meta for Developers → WhatsApp → Configuração Inicial
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              placeholder="Token de acesso temporário ou permanente"
            />
            <p className="mt-1 text-xs text-gray-500">
              Token temporário (24h) ou permanente. Em: Meta for Developers → WhatsApp → Token
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de Telefone
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              placeholder="Ex: 5511999999999"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                App ID (opcional)
              </label>
              <input
                type="text"
                value={formData.appId}
                onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Account ID (opcional)
              </label>
              <input
                type="text"
                value={formData.businessAccountId}
                onChange={(e) =>
                  setFormData({ ...formData, businessAccountId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              />
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
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
            <h3 className="font-semibold text-blue-900 mb-2">URL do Webhook:</h3>
            <code className="text-sm text-blue-800 break-all">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/api/whatsapp/webhook?instanceId=${instanceId}`
                : 'Carregando...'}
            </code>
            <p className="mt-2 text-xs text-blue-700">
              Configure esta URL no Meta for Developers → WhatsApp → Configuração → Webhooks
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
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

