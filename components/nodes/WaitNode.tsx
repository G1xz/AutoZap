'use client'

import { Position, NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { CustomHandle } from './CustomHandle'

interface WaitNodeData {
  label: string
  duration: number
  unit: 'seconds' | 'minutes' | 'hours'
}

export default function WaitNode(props: NodeProps) {
  const { data, selected } = props
  const nodeData = data as WaitNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [duration, setDuration] = useState(nodeData.duration || 60)
  const [unit, setUnit] = useState(nodeData.unit || 'seconds')

  const handleSave = () => {
    nodeData.duration = duration
    nodeData.unit = unit
    setIsEditing(false)
  }

  const getDurationText = () => {
    const unitText = unit === 'seconds' ? 'segundos' : unit === 'minutes' ? 'minutos' : 'horas'
    return `${duration} ${unitText}`
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
        <span className="text-2xl">⏱️</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-autozap-white">{nodeData.label}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="nodrag flex-1 text-xs border border-autozap-gray-medium rounded p-2 bg-autozap-gray-dark text-autozap-white"
              min="1"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as 'seconds' | 'minutes' | 'hours')}
              className="nodrag text-xs border border-autozap-gray-medium rounded p-2 bg-autozap-gray-dark text-autozap-white"
            >
              <option value="seconds">Segundos</option>
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
            </select>
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
            Aguardar: {getDurationText()}
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

