'use client'

import { Position, NodeProps } from '@xyflow/react'
import { useState, useRef } from 'react'
import { CustomHandle } from './CustomHandle'
import { useToast } from '@/hooks/use-toast'

interface MessageNodeData {
  label: string
  message: string
  fileUrl?: string
  fileName?: string
  fileType?: 'image' | 'video' | 'document'
}

export default function MessageNode(props: NodeProps) {
  const { data, selected } = props
  const { toast } = useToast()
  const nodeData = data as unknown as MessageNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState(nodeData.message || '')
  const [fileUrl, setFileUrl] = useState(nodeData.fileUrl || '')
  const [fileName, setFileName] = useState(nodeData.fileName || '')
  const [fileType, setFileType] = useState(nodeData.fileType || 'image')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Garante que o textarea está focado
    textarea.focus()
    
    const start = textarea.selectionStart || message.length
    const end = textarea.selectionEnd || message.length
    const text = message
    const newText = text.substring(0, start) + variable + text.substring(end)
    
    setMessage(newText)
    
    // Move o cursor para depois da variável inserida
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + variable.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
        setFileUrl(result.url)
        setFileName(file.name)
        
        // Detecta tipo de arquivo
        if (file.type.startsWith('image/')) {
          setFileType('image')
        } else if (file.type.startsWith('video/')) {
          setFileType('video')
        } else {
          setFileType('document')
        }

        // Atualiza os dados do nó
        nodeData.fileUrl = result.url
        nodeData.fileName = file.name
        nodeData.fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document'
      } else {
        toast.error('Erro ao fazer upload do arquivo')
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error)
      alert('Erro ao fazer upload do arquivo')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = () => {
    nodeData.message = message
    nodeData.fileUrl = fileUrl
    nodeData.fileName = fileName
    nodeData.fileType = fileType
    setIsEditing(false)
  }

  const handleRemoveFile = () => {
    setFileUrl('')
    setFileName('')
    setFileType('image')
    nodeData.fileUrl = undefined
    nodeData.fileName = undefined
    nodeData.fileType = undefined
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-white border-2 overflow-hidden ${
        selected ? 'border-autozap-primary' : 'border-gray-300'
      } min-w-[220px] w-[220px]`}
      style={{ borderRadius: '8px', overflow: 'hidden' }}
    >
      <CustomHandle type="target" position={Position.Top} />
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">💬</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-900">{nodeData.label}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
            <strong>Variáveis disponíveis:</strong> Clique para inserir
          </div>
          <div className="flex flex-wrap gap-1">
            {['{{nome}}', '{{telefone}}', '{{data}}', '{{hora}}', '{{datahora}}'].map((varName) => (
              <button
                key={varName}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  insertVariable(varName)
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                draggable={false}
                className="nodrag px-2 py-1 bg-autozap-primary/20 hover:bg-autozap-primary/40 text-autozap-primary border border-autozap-primary/30 rounded text-xs cursor-pointer transition-colors select-none"
              >
                {varName}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite a mensagem... Use {{nome}} para personalizar!"
            className="nodrag w-full text-xs border border-gray-300 rounded p-2 bg-white text-gray-900 placeholder-gray-400"
            rows={3}
          />
          
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-900">
              Anexar arquivo (imagem, vídeo ou documento):
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx"
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
                {uploading ? 'Fazendo upload...' : 'Escolher arquivo'}
              </button>
              {fileUrl && (
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="nodrag px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                >
                  ×
                </button>
              )}
            </div>
            {fileName && (
              <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
                📎 {fileName}
                {fileType === 'image' && ' 🖼️'}
                {fileType === 'video' && ' 🎥'}
                {fileType === 'document' && ' 📄'}
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
          <div className="text-xs text-gray-900 bg-gray-100 p-2 rounded">
            {message || 'Clique para editar...'}
          </div>
          {fileUrl && fileName && (
            <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
              📎 {fileName}
              {fileType === 'image' && ' 🖼️'}
              {fileType === 'video' && ' 🎥'}
              {fileType === 'document' && ' 📄'}
            </div>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="nodrag w-full px-2 py-1 bg-autozap-primary text-white rounded text-xs hover:bg-autozap-light transition-colors"
          >
            Editar
          </button>
        </div>
      )}

      <CustomHandle type="source" position={Position.Bottom} />
    </div>
  )
}
