'use client'

import { useState, useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'

interface BusinessDetails {
  businessName: string
  businessDescription: string
  businessType?: 'products' | 'services' | 'both' // Se vende produtos, serviços ou ambos
  products?: string[]
  services?: string[]
  catalogId?: string // ID do catálogo selecionado para usar
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
  businessImage?: string // URL da imagem do negócio
  sendImageInFirstMessage?: boolean // Se deve enviar imagem na primeira mensagem
  targetAudience?: string // Público-alvo
  mainBenefits?: string // Principais benefícios/diferenciais
  businessValues?: string // Valores do negócio
  workingHours?: string // Horários de funcionamento (texto livre - legado, apenas para exibição)
}

interface AIWorkflowConfigProps {
  businessDetails: BusinessDetails | null
  onSave?: (details: BusinessDetails) => void // Opcional agora
  onCancel?: () => void
  onChange?: (details: BusinessDetails) => void // Novo: callback para mudanças em tempo real
}

export default function AIWorkflowConfig({
  businessDetails,
  onSave,
  onCancel,
  onChange,
}: AIWorkflowConfigProps) {
  const { toast } = useToast()
  const [details, setDetails] = useState<BusinessDetails>(
    businessDetails || {
      businessName: '',
      businessDescription: '',
      businessType: 'services',
      products: [],
      services: [],
      catalogId: undefined,
      pricingInfo: '',
      howToBuy: '',
      contactInfo: {},
      tone: 'friendly',
      greetingMessage: '',
      closingMessage: '',
      additionalInfo: '',
      aiInstructions: '',
      businessImage: '',
      sendImageInFirstMessage: false,
      targetAudience: '',
      mainBenefits: '',
      businessValues: '',
      workingHours: '',
    }
  )

  const [newProduct, setNewProduct] = useState('')
  const [newService, setNewService] = useState('')
  const [catalogs, setCatalogs] = useState<any[]>([])
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Atualiza o estado quando businessDetails mudar externamente
  useEffect(() => {
    if (businessDetails) {
      setDetails(businessDetails)
    }
  }, [businessDetails])

  // Notifica mudanças em tempo real para o componente pai
  useEffect(() => {
    if (onChange) {
      onChange(details)
    }
  }, [details, onChange])

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

  // Função para upload de imagem do negócio
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setDetails({ ...details, businessImage: data.url })
        toast.success('A imagem do negócio foi enviada com sucesso.')
      } else {
        throw new Error('Erro ao enviar imagem')
      }
    } catch (error) {
      console.error('Erro ao enviar imagem:', error)
      toast.error('Não foi possível enviar a imagem.')
    } finally {
      setUploadingImage(false)
    }
  }


  // Validação dos dados (usado pelo WorkflowEditor ao salvar)
  const validateDetails = (): boolean => {
    return !!(details.businessName?.trim() && details.businessDescription?.trim())
  }

  const handleSave = () => {
    if (!validateDetails()) {
      alert('Por favor, preencha pelo menos o nome e a descrição do negócio.')
      return
    }
    if (onSave) {
      onSave(details)
    }
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

          {/* Imagem do Negócio */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Foto do Negócio (opcional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <div className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light disabled:opacity-50 transition-colors"
              >
                {uploadingImage ? 'Enviando...' : details.businessImage ? 'Trocar Imagem' : 'Escolher Imagem'}
              </button>
              {details.businessImage && (
                <>
                  <button
                    type="button"
                    onClick={() => setDetails({ ...details, businessImage: '', sendImageInFirstMessage: false })}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Remover
                  </button>
                  <div className="w-16 h-16 rounded-md overflow-hidden border border-gray-300">
                    <img src={details.businessImage} alt="Negócio" className="w-full h-full object-cover" />
                  </div>
                </>
              )}
            </div>
            {details.businessImage && (
              <div className="mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={details.sendImageInFirstMessage || false}
                    onChange={(e) =>
                      setDetails({ ...details, sendImageInFirstMessage: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                  />
                  <span className="text-sm text-gray-700">
                    Enviar esta imagem na primeira mensagem (atrativo visual)
                  </span>
                </label>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Uma imagem do seu negócio pode tornar a primeira impressão mais atrativa.
            </p>
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

          {/* Seleção de Catálogo */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Usar Catálogo (opcional)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Selecione um catálogo existente para que a IA use os produtos/serviços dele automaticamente.
            </p>
            {isLoadingCatalogs ? (
              <p className="text-sm text-gray-600">Carregando catálogos...</p>
            ) : (
              <select
                value={details.catalogId || ''}
                onChange={(e) =>
                  setDetails({ ...details, catalogId: e.target.value || undefined })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              >
                <option value="">Nenhum catálogo (usar produtos/serviços manuais abaixo)</option>
                {catalogs.map((catalog) => (
                  <option key={catalog.id} value={catalog.id}>
                    {catalog.name}
                  </option>
                ))}
              </select>
            )}
            {details.catalogId && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Catálogo selecionado. A IA usará os produtos/serviços deste catálogo.
              </p>
            )}
          </div>

          {/* Produtos */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Produtos (opcional - use apenas se não selecionou um catálogo)
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
              Serviços (opcional - use apenas se não selecionou um catálogo)
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

          {/* Público-Alvo */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Público-Alvo (opcional)
            </label>
            <textarea
              value={details.targetAudience || ''}
              onChange={(e) =>
                setDetails({ ...details, targetAudience: e.target.value })
              }
              placeholder="Ex: Profissionais de 25-45 anos, empresas de pequeno e médio porte, estudantes universitários..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Descreva quem é seu público-alvo. Isso ajuda a IA a adaptar o tom e a abordagem.
            </p>
          </div>

          {/* Principais Benefícios/Diferenciais */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Principais Benefícios e Diferenciais (opcional)
            </label>
            <textarea
              value={details.mainBenefits || ''}
              onChange={(e) =>
                setDetails({ ...details, mainBenefits: e.target.value })
              }
              placeholder="Ex: Atendimento personalizado, entrega rápida, garantia de qualidade, preços competitivos, experiência de 10 anos..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Liste os principais diferenciais e benefícios do seu negócio. A IA usará isso para destacar seus pontos fortes.
            </p>
          </div>

          {/* Valores do Negócio */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Valores do Negócio (opcional)
            </label>
            <textarea
              value={details.businessValues || ''}
              onChange={(e) =>
                setDetails({ ...details, businessValues: e.target.value })
              }
              placeholder="Ex: Compromisso com qualidade, transparência, sustentabilidade, inovação, respeito ao cliente..."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Quais são os valores que guiam seu negócio? Isso ajuda a IA a transmitir a identidade da marca.
            </p>
          </div>

          {/* Horários de Funcionamento (Texto Livre - Apenas para exibição) */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Horários de Funcionamento - Texto Livre (opcional, para exibição)
            </label>
            <textarea
              value={details.workingHours || ''}
              onChange={(e) =>
                setDetails({ ...details, workingHours: e.target.value })
              }
              placeholder="Ex: Segunda a Sexta: 9h às 18h | Sábado: 9h às 13h | Domingo: Fechado"
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Este campo é apenas para exibição na conversa. Os horários estruturados que bloqueiam agendamentos devem ser configurados em <strong>Configurações → Horários de Funcionamento</strong>.
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
              placeholder="Políticas, promoções especiais, informações sobre garantia, formas de pagamento, etc..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Qualquer outra informação relevante que a IA deve conhecer sobre seu negócio.
            </p>
          </div>
        </div>

        {/* Nota informativa */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
            💡 <strong>Dica:</strong> As alterações são salvas automaticamente. Clique em "Salvar Fluxo" no topo da página para finalizar.
          </p>
        </div>
      </div>
    </div>
  )
}

