'use client'

import { NodeProps, Position } from '@xyflow/react'
import { useState } from 'react'
import { CustomHandle } from './CustomHandle'

interface CategoryNodeData {
  label: string
  name?: string
  description?: string
}

export default function CategoryNode(props: NodeProps) {
  const { data, selected } = props
  const [isEditing, setIsEditing] = useState(false)
  const nodeData = data as CategoryNodeData

  const [name, setName] = useState(nodeData.name || '')
  const [description, setDescription] = useState(nodeData.description || '')

  const handleSave = () => {
    nodeData.name = name
    nodeData.description = description
    setIsEditing(false)
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 border-2 overflow-hidden ${
        selected ? 'border-yellow-400' : 'border-purple-300'
      } min-w-[220px] w-[220px]`}
      style={{ borderRadius: '8px', overflow: 'hidden' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">📁</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-white">{nodeData.label}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da categoria..."
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

