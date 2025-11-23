'use client'

import { NodeProps, Position } from '@xyflow/react'
import { useState, useRef, useEffect } from 'react'
import { CustomHandle } from './CustomHandle'
import { useToast } from '@/hooks/use-toast'

interface ServiceNodeData {
  label: string
  name?: string
  description?: string
  price?: number
  imageUrl?: string
  requiresAppointment?: boolean
  appointmentDuration?: number // Duração em minutos
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

  // Sincroniza estados quando os dados do nó mudarem (ao carregar catálogo existente)
  useEffect(() => {
    setName(nodeData.name || '')
    setDescription(nodeData.description || '')
    setPrice(nodeData.price?.toString() || '')
    setImageUrl(nodeData.imageUrl || '')
    setRequiresAppointment(nodeData.requiresAppointment || false)
    setAppointmentDuration(nodeData.appointmentDuration?.toString() || '')
  }, [nodeData.name, nodeData.description, nodeData.price, nodeData.imageUrl, nodeData.requiresAppointment, nodeData.appointmentDuration])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar se é imagem
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas arquivos de imagem')
      return
    }

    setUploading(true)
    try {
      // Cria FormData para enviar o arquivo
      const formData = new FormData()
      formData.append('file', file)

      // Envia para API de upload
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        setImageUrl(result.url)
        
        // Atualiza os dados do nó
        nodeData.imageUrl = result.url
        toast.success('Imagem enviada com sucesso!')
      } else {
        toast.error('Erro ao fazer upload da imagem')
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error)
      toast.error('Erro ao fazer upload da imagem')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setImageUrl('')
    nodeData.imageUrl = undefined
  }

  const handleSave = () => {
    nodeData.name = name
    nodeData.description = description
    nodeData.price = price ? parseFloat(price) : undefined
    nodeData.imageUrl = imageUrl
    nodeData.requiresAppointment = requiresAppointment
    nodeData.appointmentDuration = appointmentDuration ? parseInt(appointmentDuration) : undefined
    setIsEditing(false)
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-br from-green-500 to-green-600 border-2 overflow-hidden ${
        selected ? 'border-yellow-400' : 'border-green-300'
      } min-w-[220px] w-[220px]`}
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
          {imageUrl && (
            <div className="w-full h-16 bg-white/10 rounded overflow-hidden">
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
            </div>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="nodrag w-full px-2 py-1 bg-autozap-primary text-white rounded text-xs hover:bg-autozap-light transition-colors"
          >
            {name ? 'Editar' : 'Configurar'}
          </button>
        </div>
      )}

      <CustomHandle type="target" position={Position.Top} />
      <CustomHandle type="source" position={Position.Bottom} />
    </div>
  )
}

