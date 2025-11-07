'use client'

import { NodeProps, Position } from '@xyflow/react'
import { useState } from 'react'
import { CustomHandle } from './CustomHandle'

interface CloseChatNodeData {
  label: string
  message?: string
}

export default function CloseChatNode(props: NodeProps) {
  const { data, selected } = props
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState(data.message || 'Obrigado pelo contato! Esta conversa foi encerrada. Se precisar de mais alguma coisa, é só nos chamar novamente.')

  const nodeData = data as unknown as CloseChatNodeData

  const handleSave = () => {
    nodeData.message = message
    setIsEditing(false)
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-gradient-to-br from-gray-600 to-gray-800 border-2 overflow-hidden ${
        selected ? 'border-gray-400' : 'border-gray-500'
      } min-w-[220px] w-[220px]`}
      style={{ borderRadius: '8px', overflow: 'hidden' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">✓</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-white">{nodeData.label}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mensagem de encerramento..."
            className="w-full px-2 py-1 text-xs bg-white/90 rounded border border-gray-300 text-gray-800 resize-none"
            rows={3}
            autoFocus
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
          <div className="text-xs text-white/90 bg-white/10 p-2 rounded">
            {message || 'Clique para editar...'}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="nodrag w-full px-2 py-1 bg-autozap-primary text-white rounded text-xs hover:bg-autozap-light transition-colors"
          >
            Editar
          </button>
        </div>
      )}

      <CustomHandle type="target" position={Position.Top} />
    </div>
  )
}

