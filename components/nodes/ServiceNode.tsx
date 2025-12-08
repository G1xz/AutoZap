'use client'

import { NodeProps, Position } from '@xyflow/react'
import { useState, useRef, useEffect } from 'react'
import { CustomHandle } from './CustomHandle'
import { useToast } from '@/hooks/use-toast'

interface Promotion {
  value: number
  type: 'percent' | 'value'
  gatewayLink?: string
}

interface ServiceNodeData {
  label: string
  name?: string
  description?: string
  price?: number
  imageUrl?: string
  requiresAppointment?: boolean
  appointmentDuration?: number // Duração em minutos
  // Promoções
  hasPromotions?: boolean
  promotions?: Promotion[] // Array dinâmico de promoções
  pixKeyId?: string
  // Entrega e pagamento
  deliveryAvailable?: boolean
  pickupAvailable?: boolean
  paymentLink?: string
  paymentPixKeyId?: string
}

export default function ServiceNode(props: NodeProps) {
  const { data, selected } = props
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const nodeData = data as unknown as ServiceNodeData

  const [name, setName] = useState(nodeData.name || '')
  const [description, setDescription] = useState(nodeData.description || '')
  const [price, setPrice] = useState(nodeData.price?.toString() || '')
  const [imageUrl, setImageUrl] = useState(nodeData.imageUrl || '')
  const [requiresAppointment, setRequiresAppointment] = useState(nodeData.requiresAppointment || false)
  const [appointmentDuration, setAppointmentDuration] = useState(nodeData.appointmentDuration?.toString() || '')
  const [slotSize, setSlotSize] = useState(15) // Tamanho do slot padrão
  const [showCustomDuration, setShowCustomDuration] = useState(false) // SEMPRE começa como false para mostrar o select
  const [customDuration, setCustomDuration] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Busca configuração de slot do usuário
  useEffect(() => {
    const fetchSlotConfig = async () => {
      try {
        const response = await fetch('/api/slot-config')
        if (response.ok) {
          const data = await response.json()
          if (data.slotConfig?.slotSizeMinutes) {
            setSlotSize(data.slotConfig.slotSizeMinutes)
          }
        }
      } catch (error) {
        console.error('Erro ao buscar configuração de slot:', error)
      }
    }
    fetchSlotConfig()
  }, [])

  // Verifica se a duração salva precisa ser mostrada como personalizada
  useEffect(() => {
    const savedDuration = nodeData.appointmentDuration?.toString() || ''
    if (savedDuration && slotSize > 0) {
      const duration = Number(savedDuration)
      // Só mostra como personalizado se:
      // 1. A duração é maior que 120 min (fora das opções padrão)
      // 2. OU não é múltiplo do slot (incompatível)
      if (duration > 120 || duration % slotSize !== 0) {
        setShowCustomDuration(true)
        setCustomDuration(savedDuration)
      } else {
        // Se está nas opções padrão (até 120 min e múltiplo do slot), mostra no select
        setShowCustomDuration(false)
        setCustomDuration('')
        // Garante que o appointmentDuration está setado para aparecer no select
        if (appointmentDuration !== savedDuration) {
          setAppointmentDuration(savedDuration)
        }
      }
    } else {
      // Se não há duração salva, garante que está no modo select
      setShowCustomDuration(false)
      setCustomDuration('')
    }
  }, [nodeData.appointmentDuration, slotSize])
  
  // Promoções dinâmicas
  const [hasPromotions, setHasPromotions] = useState(nodeData.hasPromotions || false)
  const [promotions, setPromotions] = useState<Promotion[]>(
    nodeData.promotions || []
  )
  const [pixKeyId, setPixKeyId] = useState(nodeData.pixKeyId || '')
  const [pixKeys, setPixKeys] = useState<Array<{ id: string; name: string }>>([])
  const [showPromotions, setShowPromotions] = useState(false)
  
  // Entrega e pagamento
  const [deliveryAvailable, setDeliveryAvailable] = useState(nodeData.deliveryAvailable || false)
  const [pickupAvailable, setPickupAvailable] = useState(nodeData.pickupAvailable !== undefined ? nodeData.pickupAvailable : true)
  const [paymentLink, setPaymentLink] = useState(nodeData.paymentLink || '')
  const [paymentPixKeyId, setPaymentPixKeyId] = useState(nodeData.paymentPixKeyId || '')
  const [showDeliveryPayment, setShowDeliveryPayment] = useState(false)

  // Carrega chaves Pix disponíveis
  useEffect(() => {
    const loadPixKeys = async () => {
      try {
        const response = await fetch('/api/pix-keys')
        if (response.ok) {
          const data = await response.json()
          setPixKeys(data.pixKeys || [])
        }
      } catch (error) {
        console.error('Erro ao carregar chaves Pix:', error)
      }
    }
    loadPixKeys()
  }, [])

  // Sincroniza estados quando os dados do nó mudarem (ao carregar catálogo existente)
  useEffect(() => {
    setName(nodeData.name || '')
    setDescription(nodeData.description || '')
    setPrice(nodeData.price?.toString() || '')
    setImageUrl(nodeData.imageUrl || '')
    setRequiresAppointment(nodeData.requiresAppointment || false)
    setAppointmentDuration(nodeData.appointmentDuration?.toString() || '')
    // Promoções
    setHasPromotions(nodeData.hasPromotions || false)
    // Parse promotions se for string JSON (do banco) ou usar array direto (do nodeData)
    if (nodeData.promotions) {
      if (typeof nodeData.promotions === 'string') {
        try {
          setPromotions(JSON.parse(nodeData.promotions))
        } catch {
          setPromotions([])
        }
      } else {
        setPromotions(nodeData.promotions)
      }
    } else {
      setPromotions([])
    }
    setPixKeyId(nodeData.pixKeyId || '')
    // Entrega e pagamento
    setDeliveryAvailable(nodeData.deliveryAvailable || false)
    setPickupAvailable(nodeData.pickupAvailable !== undefined ? nodeData.pickupAvailable : true)
    setPaymentLink(nodeData.paymentLink || '')
    setPaymentPixKeyId(nodeData.paymentPixKeyId || '')
  }, [nodeData])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setImageUrl(data.url)
        toast.success('A imagem foi enviada com sucesso.')
      } else {
        throw new Error('Erro ao enviar imagem')
      }
    } catch (error) {
      console.error('Erro ao enviar imagem:', error)
      toast.error('Não foi possível enviar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setImageUrl('')
    nodeData.imageUrl = undefined
  }

  const addPromotion = () => {
    setPromotions([...promotions, { value: 0, type: 'percent' }])
  }

  const removePromotion = (index: number) => {
    setPromotions(promotions.filter((_, i) => i !== index))
  }

  const updatePromotion = (index: number, field: keyof Promotion, value: any) => {
    const updated = [...promotions]
    updated[index] = { ...updated[index], [field]: value }
    setPromotions(updated)
  }

  const handleSave = () => {
    nodeData.name = name
    nodeData.description = description
    nodeData.price = price ? parseFloat(price) : undefined
    nodeData.imageUrl = imageUrl
    nodeData.requiresAppointment = requiresAppointment
    nodeData.appointmentDuration = appointmentDuration ? parseInt(appointmentDuration) : undefined
    // Promoções
    nodeData.hasPromotions = hasPromotions
    nodeData.promotions = hasPromotions && promotions.length > 0 ? promotions : undefined
    nodeData.pixKeyId = pixKeyId || undefined
    // Entrega e pagamento
    nodeData.deliveryAvailable = deliveryAvailable
    nodeData.pickupAvailable = pickupAvailable
    nodeData.paymentLink = paymentLink || undefined
    nodeData.paymentPixKeyId = paymentPixKeyId || undefined
    setIsEditing(false)
  }

  return (
    <div
      className={`bg-gradient-to-br from-blue-600 to-purple-600 text-white p-3 rounded-lg shadow-lg w-[280px] max-w-[280px] ${
        selected ? 'ring-2 ring-yellow-400' : ''
      }`}
      style={{ borderRadius: '8px', overflow: 'hidden' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🛠️</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-white">{nodeData.label}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do serviço..."
            className="w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição..."
            className="w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800 resize-none"
            rows={2}
          />
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Preço (R$)..."
            className="w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
          />
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white">
              Imagem do serviço:
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="nodrag flex-1 px-2 py-1 bg-autozap-primary text-white rounded text-xs hover:bg-autozap-light disabled:opacity-50 transition-colors"
              >
                {uploading ? 'Enviando...' : 'Escolher imagem'}
              </button>
              {imageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="nodrag px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                >
                  ×
                </button>
              )}
            </div>
            {imageUrl && (
              <div className="w-full h-20 bg-white/10 rounded overflow-hidden">
                <img src={imageUrl} alt={name || 'Serviço'} className="w-full h-full object-cover" />
              </div>
            )}
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Ou cole a URL da imagem..."
              className="w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
            />
          </div>
          <div className="space-y-2 pt-2 border-t border-white/20">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresAppointment}
                onChange={(e) => setRequiresAppointment(e.target.checked)}
                className="nodrag w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
              />
              <span className="text-xs font-semibold text-white">
                Precisa de agendamento?
              </span>
            </label>
            {requiresAppointment && (
              <div>
                <label className="text-xs font-semibold text-white block mb-1">
                  Duração do agendamento:
                </label>
                {showCustomDuration ? (
                  <div className="space-y-2">
                    <input
                      type="number"
                      min={slotSize}
                      step={slotSize}
                      value={customDuration}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === '') {
                          setCustomDuration('')
                          return
                        }
                        const numValue = Number(value)
                        // Valida que é múltiplo do slot
                        if (numValue % slotSize === 0) {
                          setCustomDuration(value)
                          setAppointmentDuration(value)
                        } else {
                          // Arredonda para o próximo múltiplo
                          const rounded = Math.ceil(numValue / slotSize) * slotSize
                          setCustomDuration(rounded.toString())
                          setAppointmentDuration(rounded.toString())
                          toast({
                            title: 'Duração ajustada',
                            description: `A duração foi ajustada para ${rounded} minutos (múltiplo de ${slotSize} minutos)`,
                            variant: 'default',
                          })
                        }
                      }}
                      placeholder={`Múltiplo de ${slotSize} minutos`}
                      className="w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowCustomDuration(false)
                          // Se havia uma duração salva que está nas opções, mantém ela
                          // Se não, volta para vazio
                          if (appointmentDuration) {
                            const duration = Number(appointmentDuration)
                            // Verifica se está nas opções padrão (até 120 min e múltiplo do slot)
                            if (duration <= 120 && duration % slotSize === 0) {
                              // Mantém o valor
                            } else {
                              // Se não está nas opções, limpa
                              setAppointmentDuration('')
                            }
                          }
                          setCustomDuration('')
                        }}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (customDuration) {
                            const numValue = Number(customDuration)
                            if (numValue > 0 && numValue % slotSize === 0) {
                              setAppointmentDuration(customDuration)
                              setShowCustomDuration(false)
                            } else {
                              // Arredonda para o próximo múltiplo válido
                              const rounded = Math.ceil(numValue / slotSize) * slotSize
                              setCustomDuration(rounded.toString())
                              setAppointmentDuration(rounded.toString())
                              setShowCustomDuration(false)
                              toast({
                                title: 'Duração ajustada',
                                description: `A duração foi ajustada para ${rounded} minutos (múltiplo de ${slotSize} minutos)`,
                                variant: 'default',
                              })
                            }
                          } else {
                            setShowCustomDuration(false)
                          }
                        }}
                        className="px-2 py-1 text-xs bg-autozap-primary text-white rounded hover:bg-autozap-light"
                      >
                        Confirmar
                      </button>
                    </div>
                    <p className="text-xs text-gray-300">
                      Deve ser múltiplo de {slotSize} minutos (ex: {slotSize}, {slotSize * 2}, {slotSize * 3}, {slotSize * 4}...)
                    </p>
                  </div>
                ) : slotSize > 0 ? (
                  <>
                    <select
                      value={appointmentDuration || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        if (value === 'custom') {
                          setShowCustomDuration(true)
                          setCustomDuration(appointmentDuration || '')
                        } else {
                          setAppointmentDuration(value)
                          setShowCustomDuration(false)
                        }
                      }}
                      className="w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
                    >
                      <option value="">Selecione...</option>
                      {(() => {
                        const options: Array<{ duration: number; label: string }> = []
                        const currentDuration = Number(appointmentDuration || 0)
                        
                        // Primeiras 4 opções sempre aparecem
                        for (let i = 1; i <= 4; i++) {
                          const duration = slotSize * i
                          let label = ''
                          
                          if (duration === 15) {
                            label = '15 minutos'
                          } else if (duration === 30) {
                            label = 'Meia hora (30 minutos)'
                          } else if (duration === 45) {
                            label = '45 minutos'
                          } else if (duration === 60) {
                            label = 'Uma hora (60 minutos)'
                          } else if (duration < 60) {
                            label = `${duration} minutos`
                          } else {
                            const hours = Math.floor(duration / 60)
                            const minutes = duration % 60
                            if (minutes === 0) {
                              label = `${hours} ${hours === 1 ? 'hora' : 'horas'} (${duration} minutos)`
                            } else {
                              label = `${hours}h ${minutes}min (${duration} minutos)`
                            }
                          }
                          
                          options.push({ duration, label })
                        }
                        
                        // Adiciona mais opções até 2 horas (120 minutos)
                        let multiplier = 5
                        while (slotSize * multiplier <= 120) {
                          const duration = slotSize * multiplier
                          const hours = Math.floor(duration / 60)
                          const minutes = duration % 60
                          
                          let label = ''
                          if (duration === 60) {
                            label = 'Uma hora (60 minutos)'
                          } else if (duration === 90) {
                            label = '1h 30min (90 minutos)'
                          } else if (duration === 120) {
                            label = 'Duas horas (120 minutos)'
                          } else if (hours > 0) {
                            label = minutes === 0 
                              ? `${hours} ${hours === 1 ? 'hora' : 'horas'} (${duration} minutos)`
                              : `${hours}h ${minutes}min (${duration} minutos)`
                          } else {
                            label = `${duration} minutos`
                          }
                          
                          // Evita duplicatas
                          if (!options.find(opt => opt.duration === duration)) {
                            options.push({ duration, label })
                          }
                          multiplier++
                        }
                        
                        // Se há uma duração salva que não está nas opções padrão, adiciona ela também
                        if (currentDuration > 0 && currentDuration % slotSize === 0 && !options.find(opt => opt.duration === currentDuration)) {
                          const hours = Math.floor(currentDuration / 60)
                          const minutes = currentDuration % 60
                          let label = ''
                          if (hours > 0) {
                            label = minutes === 0 
                              ? `${hours} ${hours === 1 ? 'hora' : 'horas'} (${currentDuration} minutos)`
                              : `${hours}h ${minutes}min (${currentDuration} minutos)`
                          } else {
                            label = `${currentDuration} minutos`
                          }
                          options.push({ duration: currentDuration, label })
                          options.sort((a, b) => a.duration - b.duration)
                        }
                        
                        return options.map(opt => (
                          <option key={opt.duration} value={opt.duration.toString()}>
                            {opt.label}
                          </option>
                        ))
                      })()}
                      <option value="custom">Personalizado...</option>
                    </select>
                    <p className="text-xs text-gray-300 mt-1">
                      Opções baseadas no slot de {slotSize} minutos
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-300">Carregando opções...</p>
                )}
              </div>
            )}
          </div>
          
          {/* Seção de Entrega e Pagamento */}
          <div className="space-y-2 pt-2 border-t border-white/20">
            <button
              type="button"
              onClick={() => setShowDeliveryPayment(!showDeliveryPayment)}
              className="nodrag w-full flex items-center justify-between px-2 py-1 bg-green-600/80 text-white rounded text-xs hover:bg-green-600 transition-colors"
            >
              <span className="font-semibold">🚚 Entrega e Pagamento</span>
              <span>{showDeliveryPayment ? '−' : '+'}</span>
            </button>
            {showDeliveryPayment && (
              <div className="space-y-2 bg-white/10 p-2 rounded">
                {/* Opções de entrega/retirada */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pickupAvailable}
                      onChange={(e) => setPickupAvailable(e.target.checked)}
                      className="nodrag w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                    />
                    <span className="text-xs font-semibold text-white">Permitir retirada no estabelecimento</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deliveryAvailable}
                      onChange={(e) => setDeliveryAvailable(e.target.checked)}
                      className="nodrag w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                    />
                    <span className="text-xs font-semibold text-white">Permitir entrega</span>
                  </label>
                </div>
                
                {/* Pagamento */}
                <div className="space-y-2 pt-2 border-t border-white/20">
                  <label className="text-xs font-semibold text-white block">Link de Pagamento (Gateway):</label>
                  <input
                    type="url"
                    value={paymentLink}
                    onChange={(e) => setPaymentLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
                  />
                  <label className="text-xs font-semibold text-white block">Ou Chave Pix para Pagamento:</label>
                  <select
                    value={paymentPixKeyId}
                    onChange={(e) => setPaymentPixKeyId(e.target.value)}
                    className="nodrag w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
                  >
                    <option value="">Nenhuma</option>
                    {pixKeys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/70">
                    Se não preencher nenhum, o cliente não receberá link de pagamento.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Seção de Promoções */}
          <div className="space-y-2 pt-2 border-t border-white/20">
            <button
              type="button"
              onClick={() => setShowPromotions(!showPromotions)}
              className="nodrag w-full flex items-center justify-between px-2 py-1 bg-purple-600/80 text-white rounded text-xs hover:bg-purple-600 transition-colors"
            >
              <span className="font-semibold">🎯 Promoções e Descontos</span>
              <span>{showPromotions ? '−' : '+'}</span>
            </button>
            {showPromotions && (
              <div className="space-y-2 bg-white/10 p-2 rounded">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPromotions}
                    onChange={(e) => setHasPromotions(e.target.checked)}
                    className="nodrag w-4 h-4 rounded border-gray-300 text-autozap-primary focus:ring-autozap-primary"
                  />
                  <span className="text-xs font-semibold text-white">Ativar promoções</span>
                </label>
                {hasPromotions && (
                  <>
                    {/* Chave Pix */}
                    <div>
                      <label className="text-xs font-semibold text-white block mb-1">Chave Pix:</label>
                      <select
                        value={pixKeyId}
                        onChange={(e) => setPixKeyId(e.target.value)}
                        className="nodrag w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
                      >
                        <option value="">Nenhuma</option>
                        {pixKeys.map((key) => (
                          <option key={key.id} value={key.id}>
                            {key.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Lista de Promoções */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-white">Promoções:</label>
                        <button
                          type="button"
                          onClick={addPromotion}
                          className="nodrag px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          + Adicionar
                        </button>
                      </div>
                      {promotions.map((promo, index) => (
                        <div key={index} className="bg-white/5 p-2 rounded space-y-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-white">Promoção {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => removePromotion(index)}
                              className="nodrag px-1 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                            >
                              ×
                            </button>
                          </div>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={promo.value || ''}
                              onChange={(e) => updatePromotion(index, 'value', parseFloat(e.target.value) || 0)}
                              placeholder="Valor"
                              className="flex-1 px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
                            />
                            <select
                              value={promo.type}
                              onChange={(e) => updatePromotion(index, 'type', e.target.value as 'percent' | 'value')}
                              className="nodrag px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
                            >
                              <option value="percent">%</option>
                              <option value="value">R$</option>
                            </select>
                          </div>
                          <input
                            type="url"
                            value={promo.gatewayLink || ''}
                            onChange={(e) => updatePromotion(index, 'gatewayLink', e.target.value)}
                            placeholder="Link gateway (opcional)"
                            className="w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
                          />
                        </div>
                      ))}
                      {promotions.length === 0 && (
                        <p className="text-xs text-white/70 text-center py-2">
                          Nenhuma promoção adicionada. Clique em "+ Adicionar" para criar uma.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="nodrag flex-1 px-2 py-1 bg-autozap-primary text-white rounded text-xs hover:bg-autozap-light transition-colors"
            >
              Salvar
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="nodrag flex-1 px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {name && <div className="text-xs text-white/90 font-medium">{name}</div>}
          {description && <div className="text-xs text-white/80 bg-white/10 p-2 rounded">{description}</div>}
          {price && <div className="text-xs text-white/90 font-bold">R$ {parseFloat(price).toFixed(2)}</div>}
          {requiresAppointment && (
            <div className="text-xs text-white/90 bg-white/10 px-2 py-1 rounded flex items-center gap-1">
              <span>📅</span>
              <span>Agendamento necessário</span>
              {appointmentDuration && (
                <span className="text-white/70">({appointmentDuration} min)</span>
              )}
            </div>
          )}
          {hasPromotions && promotions && promotions.length > 0 && (
            <div className="text-xs text-white/90 bg-purple-600/50 px-2 py-1 rounded flex items-center gap-1">
              <span>🎯</span>
              <span>{promotions.length} promoção{promotions.length !== 1 ? 'ões' : ''} ativa{promotions.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {imageUrl && (
            <div className="w-full h-16 bg-white/10 rounded overflow-hidden">
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            </div>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="nodrag w-full px-2 py-1 bg-white/20 text-white rounded text-xs hover:bg-white/30 transition-colors"
          >
            Editar
          </button>
        </div>
      )}

      <CustomHandle type="target" position={Position.Top} />
      <CustomHandle type="source" position={Position.Bottom} />
    </div>
  )
}
