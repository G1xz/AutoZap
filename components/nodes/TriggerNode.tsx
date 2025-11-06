'use client'

import { Position, NodeProps } from '@xyflow/react'
import { useState, useRef } from 'react'
import { CustomHandle } from './CustomHandle'

interface TriggerNodeData {
  label: string
  trigger: string
}

export default function TriggerNode(props: NodeProps) {
  const { data, selected } = props
  const nodeData = data as unknown as TriggerNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [trigger, setTrigger] = useState(nodeData.trigger || '')
  const inputRef = useRef<HTMLInputElement>(null)

  const insertVariable = (variable: string) => {
    const input = inputRef.current
    if (!input) return

    // Garante que o input está focado
    input.focus()
    
    const start = input.selectionStart || trigger.length
    const end = input.selectionEnd || trigger.length
    const text = trigger
    const newText = text.substring(0, start) + variable + text.substring(end)
    
    setTrigger(newText)
    
    // Move o cursor para depois da variável inserida
    setTimeout(() => {
      input.focus()
      const newPosition = start + variable.length
      input.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  const handleSave = () => {
    nodeData.trigger = trigger
    setIsEditing(false)
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-autozap-gray-dark border-2 overflow-hidden ${
        selected ? 'border-autozap-primary' : 'border-autozap-gray-medium'
      } min-w-[200px]`}
      style={{ borderRadius: '8px', overflow: 'hidden' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🚀</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-autozap-white">{nodeData.label}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <div className="text-xs text-autozap-gray-medium bg-autozap-gray-medium/20 p-2 rounded">
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
          <input
            ref={inputRef}
            type="text"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="Palavra-chave (ex: olá, oi)"
            className="nodrag w-full text-xs border border-autozap-gray-medium rounded p-2 bg-autozap-gray-dark text-autozap-white placeholder-autozap-gray-medium"
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
              className="nodrag flex-1 px-2 py-1 bg-autozap-gray-medium text-white rounded text-xs hover:bg-autozap-gray-medium/80 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-autozap-white bg-autozap-gray-medium/20 p-2 rounded">
            {trigger || 'Clique para editar...'}
          </div>
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

