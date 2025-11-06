'use client'

import { Position, NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { CustomHandle } from './CustomHandle'

interface ConditionNodeData {
  label: string
  condition: string
  trueLabel?: string
  falseLabel?: string
}

export default function ConditionNode(props: NodeProps) {
  const { data, selected } = props
  const nodeData = data as ConditionNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [condition, setCondition] = useState(nodeData.condition || '')
  const [trueLabel, setTrueLabel] = useState(nodeData.trueLabel || 'Sim')
  const [falseLabel, setFalseLabel] = useState(nodeData.falseLabel || 'Não')

  const handleSave = () => {
    nodeData.condition = condition
    nodeData.trueLabel = trueLabel
    nodeData.falseLabel = falseLabel
    setIsEditing(false)
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-autozap-gray-dark border-2 overflow-hidden ${
        selected ? 'border-autozap-primary' : 'border-autozap-gray-medium'
      } min-w-[200px]`}
      style={{ borderRadius: '8px', overflow: 'hidden' }}
    >
      <CustomHandle type="target" position={Position.Top} />
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🔀</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-autozap-white">{nodeData.label}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="Ex: resposta.includes('sim')"
            className="nodrag w-full text-xs border border-autozap-gray-medium rounded p-2 bg-autozap-gray-dark text-autozap-white placeholder-autozap-gray-medium"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-autozap-white">Verdadeiro:</label>
              <input
                type="text"
                value={trueLabel}
                onChange={(e) => setTrueLabel(e.target.value)}
                className="nodrag w-full text-xs border border-autozap-gray-medium rounded p-2 bg-autozap-gray-dark text-autozap-white placeholder-autozap-gray-medium"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-autozap-white">Falso:</label>
              <input
                type="text"
                value={falseLabel}
                onChange={(e) => setFalseLabel(e.target.value)}
                className="nodrag w-full text-xs border border-autozap-gray-medium rounded p-2 bg-autozap-gray-dark text-autozap-white placeholder-autozap-gray-medium"
              />
            </div>
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
              className="nodrag flex-1 px-2 py-1 bg-autozap-gray-medium text-white rounded text-xs hover:bg-autozap-gray-medium/80 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-autozap-white bg-autozap-gray-medium/20 p-2 rounded">
            {condition || 'Clique para editar...'}
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="nodrag w-full px-2 py-1 bg-autozap-primary text-white rounded text-xs hover:bg-autozap-light transition-colors"
          >
            Editar
          </button>
        </div>
      )}

      <CustomHandle type="source" position={Position.Bottom} id="true" label={trueLabel} />
      <CustomHandle type="source" position={Position.Bottom} id="false" label={falseLabel} style={{ left: 'auto', right: 10 }} />
    </div>
  )
}

