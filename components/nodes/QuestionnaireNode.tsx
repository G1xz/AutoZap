'use client'

import { Position, NodeProps } from '@xyflow/react'
import { useState, useRef } from 'react'
import { CustomHandle } from './CustomHandle'

interface QuestionnaireNodeData {
  label: string
  question: string
  options: Array<{ id: string; label: string; nextNodeId?: string }>
}

export default function QuestionnaireNode(props: NodeProps) {
  const { data, selected } = props
  const nodeData = data as QuestionnaireNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [question, setQuestion] = useState(nodeData.question || '')
  const [options, setOptions] = useState(nodeData.options || [{ id: '1', label: '' }])
  const questionTextareaRef = useRef<HTMLTextAreaElement>(null)
  const optionInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const insertVariableInQuestion = (variable: string) => {
    const textarea = questionTextareaRef.current
    if (!textarea) return

    // Garante que o textarea está focado
    textarea.focus()
    
    const start = textarea.selectionStart || question.length
    const end = textarea.selectionEnd || question.length
    const text = question
    const newText = text.substring(0, start) + variable + text.substring(end)
    
    setQuestion(newText)
    
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + variable.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  const insertVariableInOption = (variable: string, optionId: string) => {
    const input = optionInputRefs.current[optionId]
    if (!input) return

    // Garante que o input está focado
    input.focus()
    
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    const currentOption = options.find(opt => opt.id === optionId)
    if (!currentOption) return

    const text = currentOption.label
    const newText = text.substring(0, start) + variable + text.substring(end)
    
    updateOption(optionId, newText)
    
    setTimeout(() => {
      input.focus()
      const newPosition = start + variable.length
      input.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  const handleSave = () => {
    nodeData.question = question
    nodeData.options = options.filter((opt) => opt.label.trim())
    setIsEditing(false)
  }

  const addOption = () => {
    setOptions([...options, { id: Date.now().toString(), label: '' }])
  }

  const removeOption = (id: string) => {
    setOptions(options.filter((opt) => opt.id !== id))
  }

  const updateOption = (id: string, label: string) => {
    setOptions(options.map((opt) => (opt.id === id ? { ...opt, label } : opt)))
  }

  // Calcular posição dos handles dinamicamente na lateral direita
  const getHandlePosition = (index: number, total: number) => {
    if (total === 1) return 50 // Centro se tiver apenas uma opção
    // Distribui verticalmente, começando um pouco abaixo do topo
    const startOffset = 20 // Offset do topo
    const spacing = (100 - startOffset * 2) / (total + 1)
    return startOffset + spacing * (index + 1)
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg bg-autozap-gray-dark border-2 ${
        selected ? 'border-autozap-primary' : 'border-autozap-gray-medium'
      } min-w-[250px] relative`}
      style={{ borderRadius: '8px', overflow: 'visible', position: 'relative' }}
    >
      <CustomHandle type="target" position={Position.Top} />
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">❓</span>
        <div className="flex-1">
          <div className="font-semibold text-sm text-autozap-white">{nodeData.label}</div>
        </div>
      </div>

        {isEditing ? (
          <div className="space-y-2">
            <div className="text-xs text-autozap-gray-medium bg-autozap-gray-medium/20 p-2 rounded">
              <strong>Variáveis:</strong> Clique para inserir
            </div>
            <div className="flex flex-wrap gap-1">
              {['{{nome}}', '{{telefone}}', '{{data}}', '{{hora}}'].map((varName) => (
                <button
                  key={varName}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    insertVariableInQuestion(varName)
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
              ref={questionTextareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Digite a pergunta... Use {{nome}} para personalizar!"
              className="nodrag w-full text-xs border border-autozap-gray-medium rounded p-2 bg-autozap-gray-dark text-autozap-white placeholder-autozap-gray-medium"
              rows={2}
            />
          <div className="text-xs font-semibold text-autozap-white">Opções:</div>
          {options.map((option, index) => {
            const filteredOptions = options.filter((opt) => opt.label.trim())
            const filteredIndex = filteredOptions.findIndex((opt) => opt.id === option.id)
            const position = getHandlePosition(filteredIndex, filteredOptions.length)
            
            return (
              <div key={option.id} className="space-y-1 relative">
                <div className="flex flex-wrap gap-1 mb-1">
                  {['{{nome}}', '{{telefone}}', '{{data}}', '{{hora}}'].map((varName) => (
                    <button
                      key={varName}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        insertVariableInOption(varName, option.id)
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      draggable={false}
                      className="nodrag px-1.5 py-0.5 bg-autozap-primary/20 hover:bg-autozap-primary/40 text-autozap-primary border border-autozap-primary/30 rounded text-xs cursor-pointer transition-colors select-none"
                    >
                      {varName}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center pr-8">
                  <input
                    ref={(el) => {
                      optionInputRefs.current[option.id] = el
                    }}
                    type="text"
                    value={option.label}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                    placeholder="Opção..."
                    className="nodrag flex-1 text-xs border border-autozap-gray-medium rounded p-2 bg-autozap-gray-dark text-autozap-white placeholder-autozap-gray-medium"
                  />
                  {options.length > 1 && (
                    <button
                      onClick={() => removeOption(option.id)}
                      className="nodrag px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      ×
                    </button>
                  )}
                </div>
                {/* Handle na lateral direita de cada opção */}
                {option.label.trim() && (
                  <CustomHandle
                    type="source"
                    position={Position.Right}
                    id={`option-${option.id}`}
                    style={{
                      top: `${position}%`,
                      right: '-5px',
                      transform: 'translateY(-50%)',
                      zIndex: 10,
                    }}
                  />
                )}
                <div className="text-xs text-autozap-gray-medium pl-2">
                  Conecte arrastando do ponto verde à direita
                </div>
              </div>
            )
          })}
          <button
            onClick={addOption}
            className="nodrag w-full px-2 py-1 bg-autozap-gray-medium text-white rounded text-xs hover:bg-autozap-gray-medium/80 transition-colors"
          >
            + Adicionar Opção
          </button>
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
            {question || 'Clique para editar...'}
          </div>
          {options.length > 0 && options[0].label && (
            <div className="space-y-1 relative">
              <div className="text-xs font-semibold text-autozap-white mb-2">Opções (cada uma conecta a um nó diferente):</div>
              {options.map((option, index) => {
                const filteredOptions = options.filter((opt) => opt.label.trim())
                const filteredIndex = filteredOptions.findIndex((opt) => opt.id === option.id)
                const position = getHandlePosition(filteredIndex, filteredOptions.length)
                
                return (
                  <div key={option.id} className="relative pr-8">
                    <div className="text-xs text-autozap-white bg-autozap-gray-medium/20 p-2 rounded flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-autozap-primary"></div>
                      <span className="flex-1">{option.label || 'Opção sem texto'}</span>
                    </div>
                    {/* Handle na lateral direita de cada opção */}
                    {option.label.trim() && (
                      <CustomHandle
                        type="source"
                        position={Position.Right}
                        id={`option-${option.id}`}
                        style={{
                          top: `${position}%`,
                          right: '-6px',
                          transform: 'translateY(-50%)',
                          zIndex: 10,
                        }}
                      />
                    )}
                  </div>
                )
              })}
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
    </div>
  )
}

