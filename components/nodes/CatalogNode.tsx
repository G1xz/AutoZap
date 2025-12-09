'use client'

import { NodeProps, Position } from '@xyflow/react'
import { useState, useRef, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { CustomHandle } from './CustomHandle'

interface CatalogNodeData {
  label: string
  name?: string
  description?: string
  imageUrl?: string
}

export default function CatalogNode(props: NodeProps) {
  const { data, selected } = props
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const nodeData = data as unknown as CatalogNodeData

  const [name, setName] = useState(nodeData.name || '')
  const [description, setDescription] = useState(nodeData.description || '')
  const [imageUrl, setImageUrl] = useState(nodeData.imageUrl || '')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Atualiza estado quando nodeData muda
  useEffect(() => {
    setName(nodeData.name || '')
    setDescription(nodeData.description || '')
    setImageUrl(nodeData.imageUrl || '')
  }, [nodeData])

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
    nodeData.imageUrl = imageUrl
    setIsEditing(false)
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 border-2 overflow-hidden ${
        selected ? 'border-yellow-400' : 'border-blue-300'
      } min-w-[220px] w-[220px]`}
      style={{ borderRadius: '8px', overflow: 'hidden' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">📋</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-white">{nodeData.label}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do catálogo..."
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
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white">
              Imagem do catálogo (cardápio/banner):
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
                <img src={imageUrl} alt={name || 'Catálogo'} className="w-full h-full object-cover" />
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
          {imageUrl && (
            <div className="w-full h-24 bg-white/10 rounded overflow-hidden">
              <img src={imageUrl} alt={name || 'Catálogo'} className="w-full h-full object-cover" />
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

