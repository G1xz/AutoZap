'use client'

import { Position, NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { CustomHandle } from './CustomHandle'

interface AINodeData {
  label: string
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export default function AINode(props: NodeProps) {
  const { data, selected } = props
  const nodeData = data as unknown as AINodeData
  const [isEditing, setIsEditing] = useState(false)
  const [prompt, setPrompt] = useState(nodeData.prompt || '')
  const [systemPrompt, setSystemPrompt] = useState(nodeData.systemPrompt || '')
  const [temperature, setTemperature] = useState(nodeData.temperature ?? 0.7)
  const [maxTokens, setMaxTokens] = useState(nodeData.maxTokens ?? 500)

  const handleSave = () => {
    nodeData.prompt = prompt
    nodeData.systemPrompt = systemPrompt
    nodeData.temperature = temperature
    nodeData.maxTokens = maxTokens
    setIsEditing(false)
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
        <span className="text-2xl">🤖</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-900">{nodeData.label}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-semibold text-gray-900">Prompt do Sistema:</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Instruções para personalizar a IA (ex: Você é um assistente de vendas...)"
              className="nodrag w-full text-xs border border-gray-300 rounded p-2 mt-1 bg-white text-gray-900 placeholder-gray-400"
              rows={2}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-900">Prompt:</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Prompt que será enviado para a IA..."
              className="nodrag w-full text-xs border border-gray-300 rounded p-2 mt-1 bg-white text-gray-900 placeholder-gray-400"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-900">Temperatura:</label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                min="0"
                max="2"
                step="0.1"
                className="nodrag w-full text-xs border border-gray-300 rounded p-2 bg-white text-gray-900"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-900">Max Tokens:</label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                min="100"
                max="2000"
                className="nodrag w-full text-xs border border-gray-300 rounded p-2 bg-white text-gray-900"
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
              className="nodrag flex-1 px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-gray-900 bg-gray-100 p-2 rounded">
            {prompt || 'Clique para editar...'}
          </div>
          {systemPrompt && (
            <div className="text-xs text-gray-600">🎯 Personalizado</div>
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

