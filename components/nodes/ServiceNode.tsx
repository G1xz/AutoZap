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
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Promoções dinâmicas
  const [hasPromotions, setHasPromotions] = useState(nodeData.hasPromotions || false)
  const [promotions, setPromotions] = useState<Promotion[]>(
    nodeData.promotions || []
  )
  const [pixKeyId, setPixKeyId] = useState(nodeData.pixKeyId || '')
  const [pixKeys, setPixKeys] = useState<Array<{ id: string; name: string }>>([])
  const [showPromotions, setShowPromotions] = useState(false)

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
        toast({
          title: 'Imagem enviada',
          description: 'A imagem foi enviada com sucesso.',
        })
      } else {
        throw new Error('Erro ao enviar imagem')
      }
    } catch (error) {
      console.error('Erro ao enviar imagem:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar a imagem.',
        variant: 'destructive',
      })
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
                  Duração do agendamento (minutos):
                </label>
                <input
                  type="number"
                  min="1"
                  value={appointmentDuration}
                  onChange={(e) => setAppointmentDuration(e.target.value)}
                  placeholder="Ex: 30, 60, 90..."
                  className="w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800"
                />
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
