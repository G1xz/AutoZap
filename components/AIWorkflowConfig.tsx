'use client'

import { useState } from 'react'

interface BusinessDetails {
  businessName: string
  businessDescription: string
  products?: string[]
  services?: string[]
  contactInfo?: {
    phone?: string
    email?: string
    address?: string
  }
  tone?: 'formal' | 'casual' | 'friendly' | 'professional'
  additionalInfo?: string
}

interface AIWorkflowConfigProps {
  businessDetails: BusinessDetails | null
  onSave: (details: BusinessDetails) => void
  onCancel?: () => void
}

export default function AIWorkflowConfig({
  businessDetails,
  onSave,
  onCancel,
}: AIWorkflowConfigProps) {
  const [details, setDetails] = useState<BusinessDetails>(
    businessDetails || {
      businessName: '',
      businessDescription: '',
      products: [],
      services: [],
      contactInfo: {},
      tone: 'friendly',
      additionalInfo: '',
    }
  )

  const [newProduct, setNewProduct] = useState('')
  const [newService, setNewService] = useState('')

  const handleAddProduct = () => {
    if (newProduct.trim()) {
      setDetails({
        ...details,
        products: [...(details.products || []), newProduct.trim()],
      })
      setNewProduct('')
    }
  }

  const handleRemoveProduct = (index: number) => {
    setDetails({
      ...details,
      products: details.products?.filter((_, i) => i !== index) || [],
    })
  }

  const handleAddService = () => {
    if (newService.trim()) {
      setDetails({
        ...details,
        services: [...(details.services || []), newService.trim()],
      })
      setNewService('')
    }
  }

  const handleRemoveService = (index: number) => {
    setDetails({
      ...details,
      services: details.services?.filter((_, i) => i !== index) || [],
    })
  }

  const handleSave = () => {
    if (!details.businessName.trim() || !details.businessDescription.trim()) {
      alert('Por favor, preencha pelo menos o nome e a descrição do negócio.')
      return
    }
    onSave(details)
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          🤖 Configurar Assistente de IA
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure os detalhes do seu negócio para que a IA possa conversar de forma inteligente e personalizada com seus clientes.
        </p>

        <div className="space-y-6">
          {/* Nome do Negócio */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Nome do Negócio *
            </label>
            <input
              type="text"
              value={details.businessName}
              onChange={(e) =>
                setDetails({ ...details, businessName: e.target.value })
              }
              placeholder="Ex: Loja de Roupas Fashion"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
          </div>

          {/* Descrição do Negócio */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Descrição do Negócio *
            </label>
            <textarea
              value={details.businessDescription}
              onChange={(e) =>
                setDetails({ ...details, businessDescription: e.target.value })
              }
              placeholder="Descreva seu negócio, o que você oferece, seus diferenciais..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
          </div>

          {/* Produtos */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Produtos (opcional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newProduct}
                onChange={(e) => setNewProduct(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddProduct()}
                placeholder="Adicionar produto..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              />
              <button
                onClick={handleAddProduct}
                className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors"
              >
                Adicionar
              </button>
            </div>
            {details.products && details.products.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {details.products.map((product, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                  >
                    {product}
                    <button
                      onClick={() => handleRemoveProduct(index)}
                      className="text-purple-700 hover:text-purple-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Serviços */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Serviços (opcional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddService()}
                placeholder="Adicionar serviço..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              />
              <button
                onClick={handleAddService}
                className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors"
              >
                Adicionar
              </button>
            </div>
            {details.services && details.services.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {details.services.map((service, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {service}
                    <button
                      onClick={() => handleRemoveService(index)}
                      className="text-blue-700 hover:text-blue-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tom de Conversa */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Tom de Conversa
            </label>
            <select
              value={details.tone}
              onChange={(e) =>
                setDetails({
                  ...details,
                  tone: e.target.value as BusinessDetails['tone'],
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            >
              <option value="friendly">Amigável e Descontraído</option>
              <option value="professional">Profissional</option>
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
            </select>
          </div>

          {/* Informações Adicionais */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Informações Adicionais (opcional)
            </label>
            <textarea
              value={details.additionalInfo || ''}
              onChange={(e) =>
                setDetails({ ...details, additionalInfo: e.target.value })
              }
              placeholder="Horários de funcionamento, políticas, promoções especiais, etc..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors font-medium"
          >
            Salvar Configuração
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

