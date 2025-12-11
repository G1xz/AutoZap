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
  initialMessage?: string // Mensagem inicial customizada
  initialImageUrl?: string // URL da imagem a ser enviada junto com a mensagem inicial
  sendInitialMessage?: boolean // Se deve enviar a mensagem inicial (mesmo que esteja definida)
  sendInitialImage?: boolean // Se deve enviar a imagem inicial junto com a mensagem inicial
  sendCatalogInInitialMessage?: boolean // Se deve enviar o catálogo junto com a mensagem inicial
  sendCatalogImageInInitialMessage?: boolean // Se deve enviar a imagem do catálogo junto com o catálogo na mensagem inicial
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
      catalogId: undefined,
      howToBuy: '',
      contactInfo: {},
      tone: 'friendly',
      greetingMessage: '',
      closingMessage: '',
      additionalInfo: '',
      aiInstructions: '',
      businessImage: '',
      sendImageInFirstMessage: false,
      initialMessage: '',
      initialImageUrl: '',
      sendInitialMessage: true, // Por padrão, envia a mensagem inicial se estiver definida
      sendInitialImage: true, // Por padrão, envia a imagem se estiver definida
      sendCatalogInInitialMessage: false,
      sendCatalogImageInInitialMessage: false,
      targetAudience: '',
      mainBenefits: '',
      businessValues: '',
      workingHours: '',
    }
  )

  const [catalogs, setCatalogs] = useState<any[]>([])
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Atualiza o estado quando businessDetails mudar externamente
  // Usa uma comparação para evitar loops infinitos
  const prevBusinessDetailsRef = useRef<string>('')
  useEffect(() => {
    if (businessDetails) {
      const newStr = JSON.stringify(businessDetails)
      // Só atualiza se realmente mudou
      if (prevBusinessDetailsRef.current !== newStr) {
        prevBusinessDetailsRef.current = newStr
        setDetails(businessDetails)
      }
    }
  }, [businessDetails])

  // Notifica mudanças em tempo real para o componente pai
  // Usa useRef para evitar chamadas desnecessárias
  const prevDetailsRef = useRef<string>('')
  useEffect(() => {
    if (onChange) {
      const currentStr = JSON.stringify(details)
      // Só notifica se realmente mudou
      if (prevDetailsRef.current !== currentStr) {
        prevDetailsRef.current = currentStr
        onChange(details)
      }
    }
  }, [details, onChange])

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

          {/* Mensagem Inicial Customizada */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Mensagem Inicial Customizada (opcional)
              </label>
              <textarea
                value={details.initialMessage || ''}
                onChange={(e) =>
                  setDetails({ ...details, initialMessage: e.target.value })
                }
                placeholder="Ex: Olá! 👋 Bem-vindo à nossa lanchonete! Temos os melhores lanches da região..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-autozap-primary focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Esta mensagem será enviada automaticamente quando um cliente iniciar uma conversa. Se deixar em branco, a IA gerará uma mensagem automaticamente.
              </p>
            </div>

            {/* Opção de Enviar Mensagem Inicial */}
            {details.initialMessage && (
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={details.sendInitialMessage !== undefined ? details.sendInitialMessage : true}
                    onChange={(e) =>
                      setDetails({ ...details, sendInitialMessage: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                  />
                  <span className="text-sm text-gray-700">
                    Enviar mensagem inicial
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Se marcado, a mensagem inicial será enviada quando um cliente iniciar uma conversa.
                </p>
              </div>
            )}

            {/* Imagem da Mensagem Inicial */}
            {details.initialMessage && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Imagem para Mensagem Inicial (opcional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
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
                        setDetails({ ...details, initialImageUrl: data.url })
                        toast.success('Imagem enviada com sucesso.')
                      } else {
                        throw new Error('Erro ao enviar imagem')
                      }
                    } catch (error) {
                      console.error('Erro ao enviar imagem:', error)
                      toast.error('Não foi possível enviar a imagem.')
                    } finally {
                      setUploadingImage(false)
                    }
                  }}
                  className="hidden"
                  id="initial-image-input"
                />
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => document.getElementById('initial-image-input')?.click()}
                    disabled={uploadingImage}
                    className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light disabled:opacity-50 transition-colors"
                  >
                    {uploadingImage ? 'Enviando...' : details.initialImageUrl ? 'Trocar Imagem' : 'Escolher Imagem'}
                  </button>
                  {details.initialImageUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => setDetails({ ...details, initialImageUrl: '' })}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      >
                        Remover
                      </button>
                      <div className="w-16 h-16 rounded-md overflow-hidden border border-gray-300">
                        <img src={details.initialImageUrl} alt="Mensagem inicial" className="w-full h-full object-cover" />
                      </div>
                    </>
                  )}
                </div>
                
                {/* Opção de Enviar Imagem Inicial */}
                {details.initialImageUrl && (
                  <div className="mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={details.sendInitialImage !== undefined ? details.sendInitialImage : true}
                        onChange={(e) =>
                          setDetails({ ...details, sendInitialImage: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                      />
                      <span className="text-sm text-gray-700">
                        Enviar imagem junto com a mensagem inicial
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      Se marcado, a imagem será enviada junto com a mensagem inicial.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Opção de Enviar Catálogo na Mensagem Inicial */}
          {details.catalogId && (
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={details.sendCatalogInInitialMessage || false}
                    onChange={(e) =>
                      setDetails({ ...details, sendCatalogInInitialMessage: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                  />
                  <span className="text-sm text-gray-700">
                    Enviar catálogo junto com a mensagem inicial
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Se marcado, o catálogo completo será enviado automaticamente quando um cliente iniciar uma conversa. {details.initialMessage ? 'Será enviado logo após a mensagem inicial customizada.' : 'Será enviado como primeira mensagem (ou após a mensagem inicial, se você configurar uma).'}
                </p>
              </div>
              
              {/* Opção de Enviar Imagem do Catálogo */}
              {details.sendCatalogInInitialMessage && (
                <div className="ml-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={details.sendCatalogImageInInitialMessage || false}
                      onChange={(e) =>
                        setDetails({ ...details, sendCatalogImageInInitialMessage: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                    />
                    <span className="text-sm text-gray-700">
                      Enviar imagem do catálogo junto com o catálogo
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Se marcado, a imagem do catálogo (se houver uma configurada) será enviada antes do catálogo formatado.
                  </p>
                </div>
              )}
            </div>
          )}

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
              Instruções sobre como o cliente pode comprar ou contratar seus produtos/serviços. Ex: "Entre em contato pelo WhatsApp, envie uma mensagem com seu pedido, aguarde nosso retorno" ou "Você pode fazer o pedido aqui mesmo pelo chat, depois enviamos o link de pagamento".
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

