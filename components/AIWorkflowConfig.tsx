'use client'

import { useState, useEffect } from 'react'

interface BusinessDetails {
  businessName: string
  businessDescription: string
  businessType?: 'products' | 'services' | 'both' // Se vende produtos, serviços ou ambos
  products?: string[]
  services?: string[]
  pricingInfo?: string // Informações sobre preços
  howToBuy?: string // Como comprar/contratar
  contactInfo?: {
    phone?: string
    email?: string
    address?: string
  }
  tone?: 'formal' | 'casual' | 'friendly' | 'professional'
  greetingMessage?: string // Mensagem de boas-vindas personalizada
  closingMessage?: string // Mensagem de encerramento
  additionalInfo?: string
  aiInstructions?: string // Instruções específicas para a IA sobre como se comportar
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
      businessType: 'services',
      products: [],
      services: [],
      pricingInfo: '',
      howToBuy: '',
      contactInfo: {},
      tone: 'friendly',
      greetingMessage: '',
      closingMessage: '',
      additionalInfo: '',
      aiInstructions: '',
    }
  )

  const [newProduct, setNewProduct] = useState('')
  const [newService, setNewService] = useState('')
  const [catalogs, setCatalogs] = useState<any[]>([])
  const [showCatalogImport, setShowCatalogImport] = useState(false)
  const [selectedCatalogId, setSelectedCatalogId] = useState('')
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false)

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

  // Buscar catálogos disponíveis
  useEffect(() => {
    const fetchCatalogs = async () => {
      setIsLoadingCatalogs(true)
      try {
        const response = await fetch('/api/catalogs')
        if (response.ok) {
          const data = await response.json()
          setCatalogs(data)
        }
      } catch (error) {
        console.error('Erro ao buscar catálogos:', error)
      } finally {
        setIsLoadingCatalogs(false)
      }
    }
    fetchCatalogs()
  }, [])

  // Importar produtos/serviços do catálogo
  const handleImportFromCatalog = async () => {
    if (!selectedCatalogId) {
      alert('Selecione um catálogo para importar')
      return
    }

    try {
      const response = await fetch(`/api/catalogs/${selectedCatalogId}`)
      if (!response.ok) {
        throw new Error('Erro ao buscar catálogo')
      }

      const catalog = await response.json()
      
      // Extrair produtos e serviços dos nós do catálogo
      const importedProducts: string[] = []
      const importedServices: string[] = []

      catalog.nodes.forEach((node: any) => {
        try {
          const nodeData = JSON.parse(node.data)
          if (node.type === 'product' && nodeData.name) {
            // Formata: "Nome do Produto - R$ XX,XX" ou apenas "Nome do Produto"
            let productName = nodeData.name
            if (nodeData.price) {
              productName += ` - R$ ${nodeData.price.toFixed(2).replace('.', ',')}`
            }
            importedProducts.push(productName)
          } else if (node.type === 'service' && nodeData.name) {
            // Formata: "Nome do Serviço - R$ XX,XX" ou apenas "Nome do Serviço"
            let serviceName = nodeData.name
            if (nodeData.price) {
              serviceName += ` - R$ ${nodeData.price.toFixed(2).replace('.', ',')}`
            }
            importedServices.push(serviceName)
          }
        } catch (e) {
          console.error('Erro ao parsear dados do nó:', e)
        }
      })

      // Adicionar aos arrays existentes (sem duplicatas)
      const updatedProducts = [...new Set([...(details.products || []), ...importedProducts])]
      const updatedServices = [...new Set([...(details.services || []), ...importedServices])]

      setDetails({
        ...details,
        products: updatedProducts,
        services: updatedServices,
      })

      setShowCatalogImport(false)
      setSelectedCatalogId('')
      alert(`Importados ${importedProducts.length} produtos e ${importedServices.length} serviços do catálogo!`)
    } catch (error) {
      console.error('Erro ao importar do catálogo:', error)
      alert('Erro ao importar produtos/serviços do catálogo')
    }
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
              placeholder="Descreva seu negócio em detalhes: o que faz, qual o propósito, principais características, diferenciais..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Seja específico! A IA usará isso para explicar seu negócio aos clientes.
            </p>
          </div>

          {/* Tipo de Negócio */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Tipo de Negócio *
            </label>
            <select
              value={details.businessType || 'services'}
              onChange={(e) =>
                setDetails({ ...details, businessType: e.target.value as 'products' | 'services' | 'both' })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            >
              <option value="services">Apenas Serviços</option>
              <option value="products">Apenas Produtos</option>
              <option value="both">Produtos e Serviços</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Isso ajuda a IA a entender se você vende produtos, serviços ou ambos.
            </p>
          </div>

          {/* Produtos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">
                Produtos (opcional)
              </label>
              <button
                type="button"
                onClick={() => setShowCatalogImport(!showCatalogImport)}
                className="text-sm text-autozap-primary hover:text-autozap-light font-medium"
              >
                📦 Importar do Catálogo
              </button>
            </div>
            
            {/* Modal de importação do catálogo */}
            {showCatalogImport && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Importar do Catálogo</h3>
                  <button
                    onClick={() => {
                      setShowCatalogImport(false)
                      setSelectedCatalogId('')
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                {isLoadingCatalogs ? (
                  <p className="text-sm text-gray-600">Carregando catálogos...</p>
                ) : catalogs.length === 0 ? (
                  <p className="text-sm text-gray-600">Nenhum catálogo disponível. Crie um catálogo primeiro.</p>
                ) : (
                  <div className="space-y-3">
                    <select
                      value={selectedCatalogId}
                      onChange={(e) => setSelectedCatalogId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent text-sm"
                    >
                      <option value="">Selecione um catálogo...</option>
                      {catalogs.map((catalog) => (
                        <option key={catalog.id} value={catalog.id}>
                          {catalog.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={handleImportFromCatalog}
                        disabled={!selectedCatalogId}
                        className="flex-1 px-3 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Importar Produtos/Serviços
                      </button>
                      <button
                        onClick={() => {
                          setShowCatalogImport(false)
                          setSelectedCatalogId('')
                        }}
                        className="px-3 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">
                Serviços (opcional)
              </label>
              <button
                type="button"
                onClick={() => setShowCatalogImport(!showCatalogImport)}
                className="text-sm text-autozap-primary hover:text-autozap-light font-medium"
              >
                📦 Importar do Catálogo
              </button>
            </div>
            
            {/* Modal de importação do catálogo (mesmo da seção de produtos) */}
            {showCatalogImport && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Importar do Catálogo</h3>
                  <button
                    onClick={() => {
                      setShowCatalogImport(false)
                      setSelectedCatalogId('')
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </button>
                </div>
                {isLoadingCatalogs ? (
                  <p className="text-sm text-gray-600">Carregando catálogos...</p>
                ) : catalogs.length === 0 ? (
                  <p className="text-sm text-gray-600">Nenhum catálogo disponível. Crie um catálogo primeiro.</p>
                ) : (
                  <div className="space-y-3">
                    <select
                      value={selectedCatalogId}
                      onChange={(e) => setSelectedCatalogId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent text-sm"
                    >
                      <option value="">Selecione um catálogo...</option>
                      {catalogs.map((catalog) => (
                        <option key={catalog.id} value={catalog.id}>
                          {catalog.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={handleImportFromCatalog}
                        disabled={!selectedCatalogId}
                        className="flex-1 px-3 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Importar Produtos/Serviços
                      </button>
                      <button
                        onClick={() => {
                          setShowCatalogImport(false)
                          setSelectedCatalogId('')
                        }}
                        className="px-3 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
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

          {/* Informações de Preço */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Informações de Preço (opcional)
            </label>
            <textarea
              value={details.pricingInfo || ''}
              onChange={(e) =>
                setDetails({ ...details, pricingInfo: e.target.value })
              }
              placeholder="Ex: Preços a partir de R$ 50,00. Pacotes disponíveis. Descontos para compras em quantidade..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Como a IA deve falar sobre preços quando perguntado.
            </p>
          </div>

          {/* Como Comprar/Contratar */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Como Comprar/Contratar (opcional)
            </label>
            <textarea
              value={details.howToBuy || ''}
              onChange={(e) =>
                setDetails({ ...details, howToBuy: e.target.value })
              }
              placeholder="Ex: Entre em contato pelo WhatsApp, envie uma mensagem com seu pedido, aguarde nosso retorno..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Instruções sobre como o cliente pode comprar ou contratar seus produtos/serviços.
            </p>
          </div>

          {/* Instruções Específicas para a IA */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Instruções Específicas para a IA (opcional)
            </label>
            <textarea
              value={details.aiInstructions || ''}
              onChange={(e) =>
                setDetails({ ...details, aiInstructions: e.target.value })
              }
              placeholder="Ex: Sempre mencione que somos especialistas em... Não mencione preços exatos, apenas faixas. Seja entusiasmado sobre nossos diferenciais..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comportamentos específicos que você quer que a IA tenha durante as conversas.
            </p>
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

