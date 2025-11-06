'use client'

import { useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Connection,
  Edge,
  Node,
  NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import MessageNode from './nodes/MessageNode'
import WaitNode from './nodes/WaitNode'
import QuestionnaireNode from './nodes/QuestionnaireNode'
import AINode from './nodes/AINode'
import ConditionNode from './nodes/ConditionNode'
import TriggerNode from './nodes/TriggerNode'

const nodeTypes: NodeTypes = {
  trigger: TriggerNode as any,
  message: MessageNode as any,
  wait: WaitNode as any,
  questionnaire: QuestionnaireNode as any,
  ai: AINode as any,
  condition: ConditionNode as any,
}

interface WorkflowEditorProps {
  workflowId?: string
  onSave?: (workflow: any) => void
}

// Componente interno que usa useReactFlow para calcular posições
function FlowCanvasWrapper({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onPaneClick,
  onPaneContextMenu,
  nodeTypes,
  onGetCenterPosition,
}: {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: any
  onEdgesChange: any
  onConnect: (params: Connection) => void
  onPaneClick: () => void
  onPaneContextMenu: (event: React.MouseEvent, position: { x: number; y: number }) => void
  nodeTypes: NodeTypes
  onGetCenterPosition: (getCenter: () => { x: number; y: number }) => void
}) {
  const { screenToFlowPosition } = useReactFlow()

  const handlePaneContextMenu = (event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    const clientX = 'clientX' in event ? event.clientX : (event as MouseEvent).clientX
    const clientY = 'clientY' in event ? event.clientY : (event as MouseEvent).clientY
    const position = screenToFlowPosition({
      x: clientX,
      y: clientY,
    })
    onPaneContextMenu(event as React.MouseEvent, position)
  }

  // Expõe função para obter posição central do viewport
  useEffect(() => {
    const getCenter = () => {
      const viewport = document.querySelector('.react-flow__viewport')
      if (viewport) {
        const rect = viewport.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        return screenToFlowPosition({
          x: centerX,
          y: centerY,
        })
      }
      return { x: 400, y: 300 }
    }
    onGetCenterPosition(getCenter)
  }, [screenToFlowPosition, onGetCenterPosition])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onPaneClick={onPaneClick}
      onPaneContextMenu={handlePaneContextMenu}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  )
}

export default function WorkflowEditor({ workflowId, onSave }: WorkflowEditorProps) {
  const router = useRouter()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [workflowName, setWorkflowName] = useState('')
  const [workflowTrigger, setWorkflowTrigger] = useState('')
  const [workflowDescription, setWorkflowDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showNodeMenu, setShowNodeMenu] = useState(false)
  const [nodeMenuPosition, setNodeMenuPosition] = useState({ x: 0, y: 0 })
  const [canvasNodePosition, setCanvasNodePosition] = useState({ x: 0, y: 0 })
  const [getCenterPosition, setGetCenterPosition] = useState<(() => { x: number; y: number }) | null>(null)

  // Carregar workflow existente
  useEffect(() => {
    if (workflowId) {
      loadWorkflow(workflowId)
    } else {
      // Criar nó inicial (trigger)
      const initialNode: Node = {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 100 },
        data: { label: 'Início', trigger: '' },
      }
      setNodes([initialNode])
    }
  }, [workflowId])

  const loadWorkflow = async (id: string) => {
    try {
      const response = await fetch(`/api/workflows/${id}`)
      if (response.ok) {
        const workflow = await response.json()
        setWorkflowName(workflow.name)
        setWorkflowTrigger(workflow.trigger)
        setWorkflowDescription(workflow.description || '')
        
        // Converter nós do banco para formato ReactFlow
        const flowNodes: Node[] = workflow.nodes.map((node: any) => ({
          id: node.id,
          type: node.type,
          position: { x: node.positionX, y: node.positionY },
          data: JSON.parse(node.data),
        }))
        
        // Converter conexões do banco para formato ReactFlow
        const flowEdges: Edge[] = workflow.connections.map((conn: any) => ({
          id: conn.id,
          source: conn.sourceNodeId,
          target: conn.targetNodeId,
          sourceHandle: conn.sourceHandle || undefined,
          targetHandle: conn.targetHandle || undefined,
        }))
        
        setNodes(flowNodes)
        setEdges(flowEdges)
      }
    } catch (error) {
      console.error('Erro ao carregar workflow:', error)
    }
  }

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds))
    },
    [setEdges]
  )

  const addNode = (type: NodeType) => {
    // Usa a posição do canvas salva quando o menu foi aberto
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: canvasNodePosition,
      data: getDefaultNodeData(type),
    }
    setNodes((nds) => [...nds, newNode])
    setShowNodeMenu(false)
  }

  const getDefaultNodeData = (type: NodeType): any => {
    switch (type) {
      case 'message':
        return { label: 'Mensagem', message: '', fileUrl: '', fileName: '', fileType: 'image' }
      case 'wait':
        return { label: 'Aguardar', duration: 60, unit: 'seconds' }
      case 'questionnaire':
        return { label: 'Questionário', question: '', options: [] }
      case 'ai':
        return { label: 'IA', prompt: '', systemPrompt: '' }
      case 'condition':
        return { label: 'Condição', condition: '' }
      default:
        return { label: type }
    }
  }

  const handlePaneContextMenu = (event: MouseEvent | React.MouseEvent, position: { x: number; y: number }) => {
    event.preventDefault()
    // Salva posição do canvas para criar o nó (onde o usuário clicou)
    setCanvasNodePosition(position)
    // Posição do menu na tela (exatamente onde o mouse está)
    setNodeMenuPosition({ x: event.clientX, y: event.clientY })
    setShowNodeMenu(true)
  }

  const handlePaneClick = () => {
    // Fechar menu ao clicar fora
    setShowNodeMenu(false)
  }

  const handleSave = async () => {
    if (!workflowName.trim() || !workflowTrigger.trim()) {
      alert('Preencha o nome e o trigger do fluxo')
      return
    }

    setIsSaving(true)
    try {
      const workflowData = {
        id: workflowId,
        name: workflowName,
        description: workflowDescription,
        trigger: workflowTrigger,
        isActive: true,
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          positionX: node.position.x,
          positionY: node.position.y,
          data: JSON.stringify(node.data),
        })),
        edges: edges.map((edge) => ({
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
        })),
      }

      const url = workflowId ? `/api/workflows/${workflowId}` : '/api/workflows'
      const method = workflowId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowData),
      })

      if (response.ok) {
        const saved = await response.json()
        alert('Fluxo salvo com sucesso!')
        if (onSave) {
          onSave(saved)
        } else {
          // Navegar para o dashboard se não houver callback
          router.push('/dashboard')
        }
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}` 
          : errorData.error || 'Erro ao salvar fluxo'
        console.error('Erro ao salvar workflow:', errorData)
        alert(errorMessage)
      }
    } catch (error) {
      console.error('Erro ao salvar workflow:', error)
      alert('Erro ao salvar fluxo')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Barra superior */}
      <div className="bg-autozap-gray-dark border-b border-autozap-gray-medium p-4 flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-3 py-1 bg-autozap-gray-medium text-white rounded text-sm hover:bg-autozap-gray-medium/80 transition-colors"
            >
              ← Voltar
            </button>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Nome do Fluxo"
              className="flex-1 text-xl font-semibold border-none outline-none bg-transparent text-autozap-white placeholder-autozap-gray-medium"
            />
          </div>
          <input
            type="text"
            value={workflowTrigger}
            onChange={(e) => {
              setWorkflowTrigger(e.target.value)
              // Atualiza o trigger no nó inicial se existir
              setNodes((nds) =>
                nds.map((node) =>
                  node.type === 'trigger'
                    ? { ...node, data: { ...node.data, trigger: e.target.value } }
                    : node
                )
              )
            }}
            placeholder="Palavra-chave que inicia este fluxo (ex: olá, oi)"
            className="text-sm text-autozap-gray-medium border-none outline-none w-full bg-transparent placeholder-autozap-gray-medium"
          />
        </div>
        <div className="flex gap-2 ml-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-autozap-primary text-white rounded-md hover:bg-autozap-light disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Salvando...' : 'Salvar Fluxo'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlowProvider>
          <FlowCanvasWrapper
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={handlePaneClick}
            onPaneContextMenu={handlePaneContextMenu}
            nodeTypes={nodeTypes}
            onGetCenterPosition={setGetCenterPosition}
          />
        </ReactFlowProvider>

        {/* Menu de adicionar nó */}
        {showNodeMenu && (
          <div
            className="fixed bg-autozap-gray-dark border border-autozap-gray-medium rounded-lg shadow-lg p-2 z-50"
            style={{ 
              left: `${nodeMenuPosition.x}px`, 
              top: `${nodeMenuPosition.y}px`,
            }}
          >
            <div className="text-xs font-semibold text-autozap-white mb-2 px-2">
              Adicionar Nó:
            </div>
            <button
              onClick={() => addNode('message')}
              className="block w-full text-left px-3 py-2 hover:bg-autozap-gray-medium rounded text-sm text-autozap-white transition-colors"
            >
              💬 Mensagem
            </button>
            <button
              onClick={() => addNode('wait')}
              className="block w-full text-left px-3 py-2 hover:bg-autozap-gray-medium rounded text-sm text-autozap-white transition-colors"
            >
              ⏱️ Aguardar
            </button>
            <button
              onClick={() => addNode('questionnaire')}
              className="block w-full text-left px-3 py-2 hover:bg-autozap-gray-medium rounded text-sm text-autozap-white transition-colors"
            >
              ❓ Questionário
            </button>
            <button
              onClick={() => addNode('ai')}
              className="block w-full text-left px-3 py-2 hover:bg-autozap-gray-medium rounded text-sm text-autozap-white transition-colors"
            >
              🤖 IA
            </button>
            <button
              onClick={() => addNode('condition')}
              className="block w-full text-left px-3 py-2 hover:bg-autozap-gray-medium rounded text-sm text-autozap-white transition-colors"
            >
              🔀 Condição
            </button>
          </div>
        )}
      </div>

      {/* Painel lateral */}
      <div className="bg-autozap-gray-dark border-t border-autozap-gray-medium p-4 flex items-center justify-center">
        <div className="text-xs text-autozap-white">
          💡 Dica: Clique com o botão direito no canvas para adicionar nós
        </div>
      </div>
    </div>
  )
}

// Tipo auxiliar
type NodeType = 'message' | 'wait' | 'questionnaire' | 'ai' | 'condition' | 'trigger'
